import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createInvoiceSourceClient } from "@/lib/supabase/invoice-source"
import { ensurePartnerExists } from "@/lib/invoice-partner-handler"
import { createTransferFromInvoice } from "@/lib/invoice-transfer-handler"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const DEFAULT_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const PAGE_LIMIT = 500

function toIso(anchor: unknown): string {
  if (typeof anchor === "string" && anchor) {
    // Already ISO from previous run.
    return anchor
  }
  if (typeof anchor === "number" && Number.isFinite(anchor)) {
    return new Date(anchor).toISOString()
  }
  return new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString()
}

export async function POST(_req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get our TIN from settings.tax_service
  const { data: credsRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "tax_service")
    .maybeSingle()
  const tin = credsRow?.value?.tin
  if (!tin) {
    return NextResponse.json({ error: "TIN not configured in settings.tax_service" }, { status: 400 })
  }

  // Read last anchor
  const { data: syncRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "tax_service_sync")
    .maybeSingle()
  const startAnchor = toIso(syncRow?.value?.lastAnchor)

  const source = createInvoiceSourceClient()

  // Pull new invoices since anchor (paged loop so we don't get stuck if there's a backlog)
  const errors: string[] = []
  let newCount = 0
  let processed = 0
  let cursor = startAnchor
  let pagesProcessed = 0
  const MAX_PAGES = 10 // hard cap ~ 5000 invoices per sync

  while (pagesProcessed < MAX_PAGES) {
    const { data: srcInvoices, error: invErr } = await source
      .from("invoices")
      .select("*")
      .or(`buyer_tin.eq.${tin},supplier_tin.eq.${tin}`)
      .gt("synced_at", cursor)
      .order("synced_at", { ascending: true })
      .limit(PAGE_LIMIT)

    if (invErr) {
      errors.push(`Source query failed: ${invErr.message}`)
      break
    }
    if (!srcInvoices || srcInvoices.length === 0) break

    for (const inv of srcInvoices) {
      processed++
      try {
        // Track furthest synced_at — that's our next anchor
        if (inv.synced_at && inv.synced_at > cursor) cursor = inv.synced_at

        const { data: existing } = await supabase
          .from("invoice")
          .select("id")
          .eq("id", inv.id)
          .maybeSingle()

        // For supplier invoices (we're buyer), make sure partner exists.
        if (!existing && inv.supplier_tin && inv.supplier_tin !== tin) {
          const partner = await ensurePartnerExists(
            supabase,
            {
              supplierTin: inv.supplier_tin,
              supplierName: inv.supplier_name || inv.supplier_tin,
              supplierAddress: inv.supplier_address || inv.delivery_address || "",
              supplierBank: inv.supplier_bank,
              supplierAccNo: inv.supplier_acc_no,
              invoiceType: inv.type,
            },
            tin
          )
          if (!partner) {
            errors.push(`Partner ensure failed for supplier ${inv.supplier_tin}`)
            continue
          }
        }

        if (!existing) {
          const invoiceData = {
            id: inv.id,
            serial_no: inv.serial_no || null,
            type: inv.type || null,
            sort: inv.sort || null,
            approval_state: inv.approval_state || null,
            status: inv.status || null,
            correction_state: inv.correction_state || null,
            correction_type: inv.correction_type || null,
            created_at: inv.created_at || null,
            issued_at: inv.issued_at || null,
            approved_at: inv.approved_at || null,
            delivered_at: inv.delivered_at || null,
            dealt_at: inv.dealt_at || null,
            cancelled_at: inv.cancelled_at || null,
            supplier_tin: inv.supplier_tin || null,
            buyer_tin: inv.buyer_tin || null,
            delivery_address: inv.delivery_address || null,
            destination_address: inv.destination_address || null,
            env_tax: inv.env_tax ?? null,
            total_value: inv.total_value ?? null,
            total_vat_amount: inv.total_vat_amount ?? 0,
            total: inv.total ?? ((inv.total_value || 0) + (inv.total_vat_amount ?? 0)),
            cancellation_reason: inv.cancellation_reason || null,
            canceled_notified: inv.canceled_notified || null,
            ben_canceled_notified: inv.ben_canceled_notified || null,
            ben_issued_notified: inv.ben_issued_notified || null,
            user_name: inv.user_name || null,
            final_use: inv.final_use ?? null,
            has_codes: inv.has_codes ?? null,
            additional_info: inv.additional_info || null,
            other_data: inv.other_data ?? null,
            seen: false,
          }
          const { error: insErr } = await supabase.from("invoice").insert(invoiceData)
          if (insErr) {
            errors.push(`Insert invoice ${inv.id}: ${insErr.message}`)
            continue
          }
          newCount++
        }

        // Sync items: pull from source, replace ours
        const { data: srcItems, error: itemsErr } = await source
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", inv.id)
          .order("seq_no", { ascending: true })

        if (itemsErr) {
          errors.push(`Items fetch ${inv.id}: ${itemsErr.message}`)
          continue
        }

        if (srcItems && srcItems.length > 0) {
          await supabase.from("invoice_items").delete().eq("invoice_id", inv.id)
          const itemsData = srcItems.map((item: any, idx: number) => ({
            invoice_id: inv.id,
            seq_no: item.seq_no || idx + 1,
            name: item.name || null,
            unit: item.unit || null,
            quantity: item.quantity ?? null,
            unit_price: item.unit_price ?? null,
            total_value: item.total_value ?? null,
            classifier_id: item.classifier_id || null,
            deal_type: item.deal_type || null,
            vat_rate: item.vat_rate ?? null,
            vat_amount: item.vat_amount ?? 0,
            total: item.total ?? ((item.total_value || 0) + (item.vat_amount ?? 0)),
            inc_env_tax: null,
            other_data: null,
          }))
          const { error: itemsInsErr } = await supabase.from("invoice_items").insert(itemsData)
          if (itemsInsErr) {
            errors.push(`Insert items ${inv.id}: ${itemsInsErr.message}`)
            continue
          }

          // First time we saw this buyer-side invoice with items → make a transfer
          if (!existing && inv.buyer_tin === tin && inv.supplier_tin) {
            const { data: partner } = await supabase
              .from("partner")
              .select("warehouse_id")
              .eq("tin", inv.supplier_tin)
              .maybeSingle()
            if (partner?.warehouse_id) {
              await createTransferFromInvoice(supabase, inv.id, partner.warehouse_id)
            }
          }
        }
      } catch (err: any) {
        errors.push(`Process ${inv.id}: ${err?.message || err}`)
      }
    }

    pagesProcessed++
    if (srcInvoices.length < PAGE_LIMIT) break // last page
  }

  // Persist new anchor and last-sync timestamp
  await supabase
    .from("settings")
    .upsert({
      key: "tax_service_sync",
      value: { lastSyncDate: new Date().toISOString(), lastAnchor: cursor },
    })

  return NextResponse.json({
    processed,
    newCount,
    pagesProcessed,
    anchor: cursor,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  })
}

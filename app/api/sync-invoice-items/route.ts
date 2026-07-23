import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createInvoiceSourceClient } from "@/lib/supabase/invoice-source"
import { fetchTaxServiceItems, getTaxServiceToken, hasTaxServiceItemsEndpoint } from "@/lib/tax-service"

export const dynamic = "force-dynamic"

const MAX_INVOICES = 100

// Re-pull line items from the invoice source for specific invoices —
// used by the problems page for invoices whose items are missing.
// When the source has no items either, falls back to the tax service directly.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const invoiceIds = body?.invoiceIds
  if (
    !Array.isArray(invoiceIds) ||
    invoiceIds.length === 0 ||
    invoiceIds.length > MAX_INVOICES ||
    !invoiceIds.every((id) => typeof id === "string")
  ) {
    return NextResponse.json(
      { error: `invoiceIds must be a non-empty string array (max ${MAX_INVOICES})` },
      { status: 400 }
    )
  }

  const source = createInvoiceSourceClient()
  const results: {
    invoiceId: string
    status: "synced" | "no_items" | "error"
    source?: "invoice_source" | "tax_service"
    count?: number
    message?: string
  }[] = []

  // Invoice types are needed for the tax service endpoints
  const { data: invoiceRows } = await supabase
    .from("invoice")
    .select("id, type")
    .in("id", invoiceIds)
  const typeById = new Map<string, string | null>((invoiceRows || []).map((r) => [r.id, r.type]))

  // Fetched lazily on the first tax-service fallback; null = auth failed
  let taxToken: string | null | undefined

  const insertItems = async (invoiceId: string, itemsData: any[]) => {
    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId)
    const { error } = await supabase.from("invoice_items").insert(itemsData)
    return error
  }

  for (const invoiceId of invoiceIds) {
    try {
      const { data: srcItems, error: itemsErr } = await source
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("seq_no", { ascending: true })

      if (itemsErr) {
        results.push({ invoiceId, status: "error", message: itemsErr.message })
        continue
      }

      if (srcItems && srcItems.length > 0) {
        const itemsData = srcItems.map((item: any, idx: number) => ({
          invoice_id: invoiceId,
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
        const insErr = await insertItems(invoiceId, itemsData)
        if (insErr) {
          results.push({ invoiceId, status: "error", message: insErr.message })
        } else {
          results.push({ invoiceId, status: "synced", source: "invoice_source", count: itemsData.length })
        }
        continue
      }

      // Source has nothing — go straight to the tax service
      const invoiceType = typeById.get(invoiceId)
      if (!hasTaxServiceItemsEndpoint(invoiceType)) {
        results.push({ invoiceId, status: "no_items" })
        continue
      }

      if (taxToken === undefined) {
        const { token, error } = await getTaxServiceToken(supabase)
        taxToken = token
        if (!token) console.error("[SyncItems] Tax service auth failed:", error)
      }
      if (!taxToken) {
        results.push({ invoiceId, status: "no_items", message: "tax service unavailable" })
        continue
      }

      let fetched = await fetchTaxServiceItems(taxToken, invoiceId, invoiceType!)
      if (fetched.needsReauth) {
        const { token } = await getTaxServiceToken(supabase, { forceRefresh: true })
        taxToken = token
        if (token) fetched = await fetchTaxServiceItems(token, invoiceId, invoiceType!)
      }
      if (fetched.error || !fetched.items) {
        results.push({ invoiceId, status: "error", message: fetched.error || "tax service auth failed" })
        continue
      }
      if (fetched.items.length === 0) {
        results.push({ invoiceId, status: "no_items" })
        continue
      }

      // Tax service items are camelCase (same mapping as the taxservice sync page)
      const itemsData = fetched.items.map((item: any, index: number) => ({
        invoice_id: invoiceId,
        seq_no: item.seqNo || index + 1,
        name: item.name || null,
        unit: item.unit || null,
        quantity: item.quantity || null,
        unit_price: item.unitPrice || null,
        total_value: item.totalValue || null,
        classifier_id: item.classifierId || null,
        deal_type: item.dealType || null,
        vat_rate: item.vatRate || null,
        vat_amount: item.vatAmount ?? 0,
        total: item.total ?? ((item.totalValue || 0) + (item.vatAmount ?? 0)),
        inc_env_tax: item.incEnvTax || null,
        other_data: item.otherData || null,
      }))
      const insErr = await insertItems(invoiceId, itemsData)
      if (insErr) {
        results.push({ invoiceId, status: "error", message: insErr.message })
      } else {
        results.push({ invoiceId, status: "synced", source: "tax_service", count: itemsData.length })
      }
    } catch (err: any) {
      results.push({ invoiceId, status: "error", message: err?.message || String(err) })
    }
  }

  return NextResponse.json({ results })
}

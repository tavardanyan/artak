import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createInvoiceSourceClient } from "@/lib/supabase/invoice-source"

export const dynamic = "force-dynamic"

const MAX_INVOICES = 100

// Re-pull line items from the invoice source for specific invoices —
// used by the problems page for invoices whose items are missing.
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
  const results: { invoiceId: string; status: "synced" | "no_items" | "error"; count?: number; message?: string }[] = []

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
      if (!srcItems || srcItems.length === 0) {
        results.push({ invoiceId, status: "no_items" })
        continue
      }

      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId)
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
      const { error: insErr } = await supabase.from("invoice_items").insert(itemsData)
      if (insErr) {
        results.push({ invoiceId, status: "error", message: insErr.message })
        continue
      }
      results.push({ invoiceId, status: "synced", count: itemsData.length })
    } catch (err: any) {
      results.push({ invoiceId, status: "error", message: err?.message || String(err) })
    }
  }

  return NextResponse.json({ results })
}

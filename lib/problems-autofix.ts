import { SupabaseClient } from "@supabase/supabase-js"
import { createInvoiceSourceClient } from "@/lib/supabase/invoice-source"
import { createWarehouseForPartner } from "@/lib/invoice-partner-handler"
import { createTransferFromInvoice, rebuildTransferItemsFromInvoice } from "@/lib/invoice-transfer-handler"
import { fetchTaxServiceItems, getTaxServiceToken, hasTaxServiceItemsEndpoint } from "@/lib/tax-service"

// Automatic problem fixing: performs the same actions as the manual bulk
// buttons on the Problems page — create missing supplier warehouses, fill
// missing invoice items (source DB, then tax service), create missing
// transfers, and rebuild mismatched transfers. Batch-limited per run so it
// converges over repeated sync cycles without blowing time budgets.

const LOCK_KEY = "problems_autofix_lock"
const LOCK_TTL_MS = 10 * 60 * 1000
const BATCH = 30

export interface AutofixSummary {
  skipped?: boolean
  warehousesCreated: number
  itemsSynced: number
  transfersCreated: number
  transfersRebuilt: number
  errors: string[]
}

async function claimLock(supabase: SupabaseClient): Promise<boolean> {
  const now = new Date()
  await supabase.from("settings").upsert(
    { key: LOCK_KEY, value: { lockedUntil: new Date(0).toISOString() } },
    { ignoreDuplicates: true }
  )
  const { data } = await supabase
    .from("settings")
    .update({ value: { lockedUntil: new Date(now.getTime() + LOCK_TTL_MS).toISOString() } })
    .eq("key", LOCK_KEY)
    .lt("value->>lockedUntil", now.toISOString())
    .select("key")
  return (data?.length ?? 0) > 0
}

async function releaseLock(supabase: SupabaseClient) {
  await supabase
    .from("settings")
    .update({ value: { lockedUntil: new Date(0).toISOString() } })
    .eq("key", LOCK_KEY)
}

export async function autofixProblems(supabase: SupabaseClient): Promise<AutofixSummary> {
  const summary: AutofixSummary = {
    warehousesCreated: 0,
    itemsSynced: 0,
    transfersCreated: 0,
    transfersRebuilt: 0,
    errors: [],
  }

  if (!(await claimLock(supabase))) {
    return { ...summary, skipped: true }
  }

  try {
    // 1. Partners without warehouses
    const { data: partners } = await supabase
      .from("problem_partner_no_warehouse")
      .select("id, name, address")
      .limit(BATCH)
    for (const partner of partners || []) {
      const { warehouseId, error } = await createWarehouseForPartner(supabase, partner)
      if (warehouseId) summary.warehousesCreated++
      else if (error) summary.errors.push(`warehouse ${partner.name}: ${error}`)
    }

    // 2. Invoices without items: source DB first, tax service as fallback
    const { data: noItems } = await supabase
      .from("problem_invoice_no_items")
      .select("id, type")
      .limit(BATCH)
    if (noItems && noItems.length > 0) {
      const source = createInvoiceSourceClient()
      let taxToken: string | null | undefined
      for (const inv of noItems) {
        try {
          const { data: srcItems } = await source
            .from("invoice_items")
            .select("*")
            .eq("invoice_id", inv.id)
            .order("seq_no", { ascending: true })

          let itemsData: any[] | null = null
          if (srcItems && srcItems.length > 0) {
            itemsData = srcItems.map((item: any, idx: number) => ({
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
          } else if (hasTaxServiceItemsEndpoint(inv.type)) {
            if (taxToken === undefined) taxToken = (await getTaxServiceToken(supabase)).token
            if (taxToken) {
              let fetched = await fetchTaxServiceItems(taxToken, inv.id, inv.type!)
              if (fetched.needsReauth) {
                taxToken = (await getTaxServiceToken(supabase, { forceRefresh: true })).token
                if (taxToken) fetched = await fetchTaxServiceItems(taxToken, inv.id, inv.type!)
              }
              if (fetched.items && fetched.items.length > 0) {
                itemsData = fetched.items.map((item: any, index: number) => ({
                  invoice_id: inv.id,
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
              }
            }
          }

          if (itemsData) {
            await supabase.from("invoice_items").delete().eq("invoice_id", inv.id)
            const { error } = await supabase.from("invoice_items").insert(itemsData)
            if (error) summary.errors.push(`items ${inv.id}: ${error.message}`)
            else summary.itemsSynced++
          }
        } catch (err: any) {
          summary.errors.push(`items ${inv.id}: ${err?.message || err}`)
        }
      }
    }

    // 3. Invoices without transfers (warehouses ensured above / on the fly)
    const { data: noTransfer } = await supabase
      .from("problem_invoice_no_transfer")
      .select("id, serial_no, supplier_tin, supplier_warehouse_id")
      .limit(BATCH)
    const warehouseByTin = new Map<string, number>()
    for (const inv of noTransfer || []) {
      try {
        let warehouseId =
          inv.supplier_warehouse_id ??
          (inv.supplier_tin ? warehouseByTin.get(inv.supplier_tin) : undefined) ??
          null
        if (!warehouseId && inv.supplier_tin) {
          const { data: partner } = await supabase
            .from("partner")
            .select("id, name, address, warehouse_id")
            .eq("tin", inv.supplier_tin)
            .maybeSingle()
          if (partner) {
            warehouseId = partner.warehouse_id
            if (!warehouseId) {
              const { warehouseId: newId } = await createWarehouseForPartner(supabase, partner)
              if (newId) {
                warehouseId = newId
                summary.warehousesCreated++
              }
            }
            if (warehouseId) warehouseByTin.set(inv.supplier_tin, warehouseId)
          }
        }
        if (!warehouseId) {
          summary.errors.push(`transfer ${inv.serial_no || inv.id}: no supplier warehouse`)
          continue
        }
        const { transferId, errors } = await createTransferFromInvoice(supabase, inv.id, warehouseId)
        if (transferId) summary.transfersCreated++
        else summary.errors.push(`transfer ${inv.serial_no || inv.id}: ${errors[0] || "failed"}`)
      } catch (err: any) {
        summary.errors.push(`transfer ${inv.id}: ${err?.message || err}`)
      }
    }

    // 4. Transfers whose totals mismatch the invoice (> 50 AMD)
    const { data: mismatches } = await supabase
      .from("problem_transfer_mismatch")
      .select("transfer_id")
      .limit(BATCH)
    for (const row of mismatches || []) {
      try {
        const { rebuilt, errors } = await rebuildTransferItemsFromInvoice(supabase, row.transfer_id)
        if (rebuilt) summary.transfersRebuilt++
        else summary.errors.push(`rebuild #${row.transfer_id}: ${errors[0] || "failed"}`)
      } catch (err: any) {
        summary.errors.push(`rebuild #${row.transfer_id}: ${err?.message || err}`)
      }
    }

    return summary
  } finally {
    await releaseLock(supabase)
  }
}

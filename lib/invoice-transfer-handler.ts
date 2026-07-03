import { SupabaseClient } from "@supabase/supabase-js"
// import { findBestMatch } from "./levenshtein" // Keep for future use

interface InvoiceItem {
  id?: string
  invoice_id: string
  seq_no: number
  name: string
  unit?: string
  quantity: number
  unit_price: number
  vat_amount?: number
  total?: number
  item_id?: number | null
}

interface Item {
  id: number
  name: string
  code: string
  unit: string
}

// const SIMILARITY_THRESHOLD = 70 // 70% similarity - for future Levenshtein use

// Items are identified by name + unit: the same name in different units
// (e.g. "Ամրան" in կգ vs հատ) must stay separate items
const DEFAULT_UNIT = "հատ"

function normalizeUnit(unit?: string | null): string {
  return (unit || "").toLowerCase().trim() || DEFAULT_UNIT.toLowerCase()
}

function isSameItem(name1: string, unit1: string | null | undefined, name2: string, unit2: string | null | undefined): boolean {
  return (
    name1.toLowerCase().trim() === name2.toLowerCase().trim() &&
    normalizeUnit(unit1) === normalizeUnit(unit2)
  )
}

/**
 * Get the default transfer warehouse ID from settings
 */
async function getDefaultTransferWarehouse(supabase: SupabaseClient): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "default_transfer_warehouse")
      .single()

    if (!error && data?.value) {
      return Number(data.value)
    }
  } catch (error) {
    console.error("[Transfer] Error fetching default warehouse:", error)
  }

  // Fallback to 114 if setting not found
  return 114
}

/**
 * Generate a unique code for a new item based on its name
 */
function generateItemCode(name: string, existingCodes: string[]): string {
  // Create a base code from the first 3 letters of the name
  const baseCode = name
    .replace(/[^a-zA-Zա-ևԱ-Ֆ0-9]/g, "")
    .substring(0, 3)
    .toUpperCase() || "ITM"

  let counter = 1
  let code = `${baseCode}${String(counter).padStart(3, "0")}`

  // Increment until we find a unique code
  while (existingCodes.includes(code)) {
    counter++
    code = `${baseCode}${String(counter).padStart(3, "0")}`
  }

  return code
}

/**
 * Match invoice items with existing items in the database
 * Creates new items if no match is found
 * Updates invoice_items with item_id
 */
export async function matchAndLinkInvoiceItems(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{ matched: number; created: number; errors: string[] }> {
  const errors: string[] = []
  let matchedCount = 0
  let createdCount = 0

  try {
    console.log(`[Transfer] Matching items for invoice ${invoiceId}`)

    // Fetch all invoice items for this invoice
    const { data: invoiceItems, error: fetchError } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)

    if (fetchError) {
      console.error("[Transfer] Error fetching invoice items:", fetchError)
      errors.push(`Failed to fetch invoice items: ${fetchError.message}`)
      return { matched: 0, created: 0, errors }
    }

    if (!invoiceItems || invoiceItems.length === 0) {
      console.log("[Transfer] No invoice items found")
      return { matched: 0, created: 0, errors }
    }

    console.log(`[Transfer] Found ${invoiceItems.length} invoice items to match`)

    // Fetch all existing items from the database
    const { data: allItems, error: itemsError } = await supabase
      .from("item")
      .select("id, name, code, unit")

    if (itemsError) {
      console.error("[Transfer] Error fetching items:", itemsError)
      errors.push(`Failed to fetch items: ${itemsError.message}`)
      return { matched: 0, created: 0, errors }
    }

    const items: Item[] = allItems || []
    const existingCodes = items.map((item) => item.code)

    console.log(`[Transfer] Database has ${items.length} existing items`)

    // Process each invoice item
    for (const invoiceItem of invoiceItems) {
      try {
        if (!invoiceItem.name) {
          console.log(`[Transfer] Skipping item with no name (seq: ${invoiceItem.seq_no})`)
          continue
        }

        // Try to find an exact match by name AND unit
        const exactMatch = items.find(
          (item) => isSameItem(item.name, item.unit, invoiceItem.name, invoiceItem.unit)
        )

        if (exactMatch) {
          // Found an exact match - update invoice_item with item_id
          console.log(`[Transfer] ✓ Exact match found for "${invoiceItem.name}" (${invoiceItem.unit || DEFAULT_UNIT}) (ID: ${exactMatch.id})`)

          // Update by primary key — seq_no is NOT unique within an invoice
          const { error: updateError } = await supabase
            .from("invoice_items")
            .update({ item_id: exactMatch.id })
            .eq("id", invoiceItem.id)

          if (updateError) {
            console.error(`[Transfer] Error updating invoice_item:`, updateError)
            errors.push(`Failed to link item "${invoiceItem.name}": ${updateError.message}`)
          } else {
            matchedCount++
          }
        } else {
          // No match found - create a new item
          console.log(`[Transfer] ✗ No match for "${invoiceItem.name}" (${invoiceItem.unit || DEFAULT_UNIT}), creating new item`)

          const newCode = generateItemCode(invoiceItem.name, existingCodes)
          existingCodes.push(newCode) // Add to list to avoid duplicates

          let resolvedItemId: number | null = null
          let resolvedCode = newCode

          const { data: newItem, error: createError } = await supabase
            .from("item")
            .insert({
              name: invoiceItem.name,
              code: newCode,
              unit: invoiceItem.unit || "հատ",
            })
            .select("id")
            .single()

          if (createError) {
            // Item already exists (race / stale local cache / etc.) — fetch it.
            // Same name can exist with different units, so pick the one matching this unit.
            if ((createError as any).code === "23505") {
              const { data: existingList } = await supabase
                .from("item")
                .select("id, name, code, unit")
                .eq("name", invoiceItem.name)
              const existing = (existingList || []).find(
                (it) => normalizeUnit(it.unit) === normalizeUnit(invoiceItem.unit)
              )
              if (existing) {
                console.log(`[Transfer] Item already exists, reusing: ${invoiceItem.name} (${existing.unit || DEFAULT_UNIT}) (ID: ${existing.id})`)
                resolvedItemId = existing.id
                resolvedCode = existing.code
                items.push(existing)
              } else {
                errors.push(`Failed to create item "${invoiceItem.name}": ${createError.message}`)
                continue
              }
            } else {
              console.error(`[Transfer] Error creating item:`, createError)
              errors.push(`Failed to create item "${invoiceItem.name}": ${createError.message}`)
              continue
            }
          } else if (newItem) {
            console.log(`[Transfer] ✓ Created new item: ${invoiceItem.name} (ID: ${newItem.id}, Code: ${newCode})`)
            resolvedItemId = newItem.id
            items.push({ ...newItem, name: invoiceItem.name, code: newCode, unit: invoiceItem.unit || "հատ" })
          }

          if (resolvedItemId != null) {
            // Update by primary key — seq_no is NOT unique within an invoice
            const { error: updateError } = await supabase
              .from("invoice_items")
              .update({ item_id: resolvedItemId })
              .eq("id", invoiceItem.id)

            if (updateError) {
              console.error(`[Transfer] Error updating invoice_item with new item_id:`, updateError)
              errors.push(`Failed to link new item "${invoiceItem.name}": ${updateError.message}`)
            } else {
              createdCount++
            }
          }
        }
      } catch (itemError) {
        console.error(`[Transfer] Error processing invoice item:`, itemError)
        errors.push(`Error processing item "${invoiceItem.name}": ${itemError}`)
      }
    }

    console.log(`[Transfer] Item matching complete: ${matchedCount} matched, ${createdCount} created`)
    return { matched: matchedCount, created: createdCount, errors }
  } catch (error) {
    console.error("[Transfer] Error in matchAndLinkInvoiceItems:", error)
    errors.push(`Unexpected error: ${error}`)
    return { matched: 0, created: 0, errors }
  }
}

/**
 * Create a transfer from invoice items
 * Requires partner warehouse as source and uses destination warehouse from settings
 */
export async function createTransferFromInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  sourceWarehouseId: number
): Promise<{ transferId: number | null; errors: string[] }> {
  const errors: string[] = []

  try {
    const destinationWarehouseId = await getDefaultTransferWarehouse(supabase)

    console.log(`[Transfer] Creating transfer for invoice ${invoiceId}`)
    console.log(`[Transfer] Source warehouse: ${sourceWarehouseId}, Destination: ${destinationWarehouseId}`)

    // First, match and link invoice items
    const matchResult = await matchAndLinkInvoiceItems(supabase, invoiceId)
    if (matchResult.errors.length > 0) {
      errors.push(...matchResult.errors)
    }

    // Fetch invoice items with item_id populated
    const { data: invoiceItems, error: fetchError } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .not("item_id", "is", null)

    if (fetchError) {
      console.error("[Transfer] Error fetching linked invoice items:", fetchError)
      errors.push(`Failed to fetch invoice items: ${fetchError.message}`)
      return { transferId: null, errors }
    }

    if (!invoiceItems || invoiceItems.length === 0) {
      console.log("[Transfer] No linked invoice items found to create transfer")
      errors.push("No items with valid item_id found")
      return { transferId: null, errors }
    }

    console.log(`[Transfer] Found ${invoiceItems.length} linked items for transfer`)

    // Check each item to see if it has a parent, and use parent ID if it does
    const itemsWithParents = await Promise.all(
      invoiceItems.map(async (invoiceItem) => {
        const { data: itemData, error: itemError } = await supabase
          .from("item")
          .select("id, parent")
          .eq("id", invoiceItem.item_id)
          .single()

        if (itemError) {
          console.error(`[Transfer] Error fetching item ${invoiceItem.item_id}:`, itemError)
          return { ...invoiceItem, finalItemId: invoiceItem.item_id }
        }

        if (itemData?.parent) {
          console.log(`[Transfer] Item ${invoiceItem.item_id} has parent ${itemData.parent}, using parent for transfer`)
          return { ...invoiceItem, finalItemId: itemData.parent }
        }

        return { ...invoiceItem, finalItemId: invoiceItem.item_id }
      })
    )

    // Create the transfer
    const { data: transfer, error: transferError } = await supabase
      .from("transfer")
      .insert({
        from: sourceWarehouseId,
        to: destinationWarehouseId,
        invoice_id: invoiceId,
      })
      .select("id")
      .single()

    if (transferError) {
      console.error("[Transfer] Error creating transfer:", transferError)
      errors.push(`Failed to create transfer: ${transferError.message}`)
      return { transferId: null, errors }
    }

    if (!transfer) {
      errors.push("Transfer created but no ID returned")
      return { transferId: null, errors }
    }

    console.log(`[Transfer] ✓ Created transfer ${transfer.id}`)

    // Create transfer_item records using finalItemId (parent if exists, otherwise original item)
    // Deduplicate by item_id (PK is composite item_id+transfer_id) — merge qty + weighted prices
    const mergedByItem = new Map<number, { qty: number; total_value: number; total_vat: number }>()
    for (const item of itemsWithParents) {
      const itemId = item.finalItemId!
      const qty = item.quantity || 0
      const value = qty * (item.unit_price || 0)
      const vat = item.vat_amount || 0
      const existing = mergedByItem.get(itemId)
      if (existing) {
        existing.qty += qty
        existing.total_value += value
        existing.total_vat += vat
      } else {
        mergedByItem.set(itemId, { qty, total_value: value, total_vat: vat })
      }
    }

    const transferItems = Array.from(mergedByItem.entries()).map(([itemId, agg]) => ({
      item_id: itemId,
      transfer_id: transfer.id,
      qty: agg.qty,
      unit_price: agg.qty > 0 ? agg.total_value / agg.qty : 0,
      unit_vat: agg.qty > 0 ? agg.total_vat / agg.qty : 0,
    }))

    const { error: itemsError } = await supabase.from("transfer_item").insert(transferItems)

    if (itemsError) {
      console.error("[Transfer] Error creating transfer items:", itemsError)
      errors.push(`Failed to create transfer items: ${itemsError.message}`)

      // Rollback - delete the transfer
      await supabase.from("transfer").delete().eq("id", transfer.id)

      return { transferId: null, errors }
    }

    console.log(`[Transfer] ✓ Created ${transferItems.length} transfer items`)
    console.log(`[Transfer] Successfully created transfer ${transfer.id} with ${transferItems.length} items`)

    return { transferId: transfer.id, errors }
  } catch (error) {
    console.error("[Transfer] Error in createTransferFromInvoice:", error)
    errors.push(`Unexpected error: ${error}`)
    return { transferId: null, errors }
  }
}

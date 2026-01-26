import { SupabaseClient } from "@supabase/supabase-js"

interface InvoicePartnerData {
  supplierTin: string
  supplierName: string
  supplierAddress: string
  supplierBank?: string
  supplierAccNo?: string
  invoiceType?: string
}

export async function ensurePartnerExists(
  supabase: SupabaseClient,
  invoiceData: InvoicePartnerData,
  ourTin: string
): Promise<{ partnerId: number; warehouseId: number | null } | null> {
  const { supplierTin, supplierName, supplierAddress, supplierBank, supplierAccNo, invoiceType } = invoiceData

  // Don't create partner for ourselves
  if (supplierTin === ourTin) {
    return null
  }

  try {
    console.log(`[Partner] Checking for partner with TIN: ${supplierTin}`)

    // Check if partner already exists
    const { data: existingPartner, error: fetchError } = await supabase
      .from("partner")
      .select("id, account_id, warehouse_id")
      .eq("tin", supplierTin)
      .maybeSingle()

    if (fetchError) {
      console.error(`[Partner] Error checking for existing partner:`, fetchError)
    }

    // If partner exists, return their ID and warehouse ID
    if (existingPartner) {
      console.log(`[Partner] ✓ Partner with TIN ${supplierTin} already exists (ID: ${existingPartner.id}, Warehouse: ${existingPartner.warehouse_id})`)
      return {
        partnerId: existingPartner.id,
        warehouseId: existingPartner.warehouse_id
      }
    }

    // Partner doesn't exist - create it
    console.log(`[Partner] ✗ Partner not found. Creating new partner: ${supplierName} (${supplierTin})`)

    let accountId: number | null = null
    let warehouseId: number | null = null

    // Create account if bank info is provided
    if (supplierBank && supplierAccNo) {
      console.log(`[Partner] Creating bank account: ${supplierBank} - ${supplierAccNo}`)
      const { data: accountData, error: accountError } = await supabase
        .from("account")
        .insert({
          name: `${supplierName} - ${supplierBank}`,
          type: "bank",
          bank: supplierBank,
          number: supplierAccNo,
          currency: "amd",
          internal: false,
        })
        .select("id")
        .single()

      if (accountError) {
        console.error("[Partner] Error creating account:", accountError)
      } else if (accountData) {
        accountId = accountData.id
        console.log(`[Partner] ✓ Created account ${accountId} for partner`)
      }
    } else {
      console.log(`[Partner] Skipping account creation - no bank info (bank: ${supplierBank}, accNo: ${supplierAccNo})`)
    }

    // Create warehouse only if invoice type is not SERVICES
    if (invoiceType !== "SERVICES") {
      console.log(`[Partner] Creating warehouse for partner (invoice type: ${invoiceType})`)
      const { data: warehouseData, error: warehouseError } = await supabase
        .from("warehouse")
        .insert({
          name: `${supplierName}`,
          address: supplierAddress,
          type: "supplier",
        })
        .select("id")
        .single()

      if (warehouseError) {
        console.error("[Partner] Error creating warehouse:", warehouseError)
      } else if (warehouseData) {
        warehouseId = warehouseData.id
        console.log(`[Partner] ✓ Created warehouse ${warehouseId} for partner`)
      }
    } else {
      console.log(`[Partner] Skipping warehouse creation - invoice type is SERVICES`)
    }

    // Create partner
    const { data: partnerData, error: partnerError } = await supabase
      .from("partner")
      .insert({
        name: supplierName,
        tin: supplierTin,
        address: supplierAddress,
        type: "supplier",
        account_id: accountId,
        warehouse_id: warehouseId,
      })
      .select("id")
      .single()

    if (partnerError) {
      console.error("[Partner] Error creating partner:", partnerError)
      return null
    }

    if (partnerData) {
      console.log(`[Partner] Successfully created partner ${partnerData.id} with warehouse ${warehouseId}`)
      return {
        partnerId: partnerData.id,
        warehouseId: warehouseId
      }
    }

    return null
  } catch (error) {
    console.error("[Partner] Error in ensurePartnerExists:", error)
    return null
  }
}

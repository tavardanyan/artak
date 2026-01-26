"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { EInvoicingClient } from "@/lib/einvoicing-client"
import { ensurePartnerExists } from "@/lib/invoice-partner-handler"
import { createTransferFromInvoice } from "@/lib/invoice-transfer-handler"

interface TaxServiceCredentials {
  tin: string
  login: string
  password: string
}

interface SyncSettings {
  lastSyncDate?: string
  lastAnchor?: number
}

interface TaxSyncContextType {
  credentials: TaxServiceCredentials | null
  syncSettings: SyncSettings | null
  unseenCount: number
  syncing: boolean
  loading: boolean
  triggerSync: () => Promise<void>
  refresh: () => Promise<void>
}

const TaxSyncContext = createContext<TaxSyncContextType | undefined>(undefined)

const SYNC_INTERVAL = 30 * 60 * 1000 // 30 minutes

export function TaxSyncProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<TaxServiceCredentials | null>(null)
  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null)
  const [unseenCount, setUnseenCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchCredentials = async () => {
    try {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "tax_service")
        .single()

      return data?.value as TaxServiceCredentials | null
    } catch (error) {
      console.error("Error fetching credentials:", error)
      return null
    }
  }

  const fetchSyncSettings = async () => {
    try {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "tax_service_sync")
        .single()

      return data?.value as SyncSettings | null
    } catch (error) {
      console.error("Error fetching sync settings:", error)
      return null
    }
  }

  const updateSyncSettings = async (settings: SyncSettings) => {
    try {
      const { data: existing } = await supabase
        .from("settings")
        .select("key")
        .eq("key", "tax_service_sync")
        .single()

      if (existing) {
        await supabase
          .from("settings")
          .update({ value: settings })
          .eq("key", "tax_service_sync")
      } else {
        await supabase
          .from("settings")
          .insert({ key: "tax_service_sync", value: settings })
      }

      setSyncSettings(settings)
    } catch (error) {
      console.error("Error updating sync settings:", error)
    }
  }

  const fetchUnseenCount = async (creds: TaxServiceCredentials) => {
    try {
      const { count } = await supabase
        .from("invoice")
        .select("*", { count: "exact", head: true })
        .eq("buyer_tin", creds.tin)
        .eq("seen", false)

      setUnseenCount(count || 0)
    } catch (error) {
      console.error("Error fetching unseen count:", error)
    }
  }

  const refresh = async () => {
    const creds = await fetchCredentials()
    const settings = await fetchSyncSettings()

    setCredentials(creds)
    setSyncSettings(settings)

    if (creds) {
      await fetchUnseenCount(creds)
    }
  }

  const performSync = useCallback(async () => {
    const creds = credentials
    const settings = syncSettings

    if (!creds || !settings?.lastAnchor) return

    console.log("[GlobalAutoSync] Starting automatic sync...")

    try {
      setSyncing(true)

      const eInvoicing = new EInvoicingClient({
        tin: creds.tin,
        username: creds.login,
        password: creds.password,
      })

      await eInvoicing.init()
      eInvoicing.setAnchor(settings.lastAnchor)

      const result = await eInvoicing.getInvoices()
      console.log(`[GlobalAutoSync] Fetched ${result.count} invoices`)

      let newCount = 0

      for (const invoice of result.data) {
        try {
          const { data: existingInvoice } = await supabase
            .from("invoice")
            .select("id")
            .eq("id", invoice.id)
            .single()

          let fullInvoice = null
          let invoiceItems: any[] = []

          if (invoice.type) {
            try {
              const itemsResponse = await eInvoicing.getInvoiceItems(invoice.id, invoice.type)

              if (Array.isArray(itemsResponse)) {
                invoiceItems = itemsResponse
              } else if (itemsResponse && typeof itemsResponse === 'object' && 'ok' in itemsResponse) {
                if ((itemsResponse as any).ok) {
                  fullInvoice = (itemsResponse as any).payload
                  invoiceItems = (itemsResponse as any).items || []
                }
              }
            } catch (itemsError) {
              console.error(`[GlobalAutoSync] Error fetching items for ${invoice.id}:`, itemsError)
            }
          }

          if (!existingInvoice && invoice.supplierTin && invoice.supplierTin !== creds.tin) {
            const partnerData = {
              supplierTin: invoice.supplierTin,
              supplierName: fullInvoice?.supplierName || (invoice as any).supplierName || invoice.supplierTin,
              supplierAddress: fullInvoice?.deliveryAddress || (invoice as any).deliveryAddress || "",
              supplierBank: fullInvoice?.supplierBank || (invoice as any).supplierBank,
              supplierAccNo: fullInvoice?.supplierAccNo || (invoice as any).supplierAccNo,
              invoiceType: invoice.type,
            }

            const partnerResult = await ensurePartnerExists(supabase, partnerData, creds.tin)

            if (!partnerResult) {
              console.error(`[GlobalAutoSync] Failed to create partner for ${invoice.supplierTin}`)
              continue
            }
          }

          if (!existingInvoice) {
            const invoiceData = {
              id: invoice.id,
              serial_no: invoice.serialNo || null,
              type: invoice.type || null,
              sort: invoice.sort || null,
              approval_state: invoice.approvalState || null,
              status: invoice.status || null,
              correction_state: invoice.correctionState || null,
              correction_type: invoice.correctionType || null,
              created_at: invoice.createdAt ? new Date(invoice.createdAt).toISOString() : null,
              issued_at: invoice.issuedAt ? new Date(invoice.issuedAt).toISOString() : null,
              approved_at: invoice.approvedAt ? new Date(invoice.approvedAt).toISOString() : null,
              delivered_at: invoice.deliveredAt ? new Date(invoice.deliveredAt).toISOString() : null,
              dealt_at: invoice.dealtAt ? new Date(invoice.dealtAt).toISOString() : null,
              cancelled_at: invoice.canceledAt ? new Date(invoice.canceledAt).toISOString() : null,
              supplier_tin: invoice.supplierTin || null,
              buyer_tin: invoice.buyerTin || null,
              delivery_address: invoice.deliveryAddress || null,
              destination_address: invoice.destinationAddress || null,
              env_tax: invoice.envTax || null,
              total_value: invoice.totalValue || null,
              total_vat_amount: invoice.totalVatAmount || null,
              total: invoice.total || null,
              cancellation_reason: invoice.cancellationReason || null,
              canceled_notified: invoice.canceledNotified || null,
              ben_canceled_notified: invoice.benCanceledNotified || null,
              ben_issued_notified: invoice.benIssuedNotified || null,
              user_name: invoice.userName || null,
              final_use: invoice.finalUse || null,
              has_codes: invoice.hasCodes || null,
              additional_info: invoice.additionalInfo || null,
              other_data: invoice.otherData || null,
              seen: false,
            }

            const { error } = await supabase.from("invoice").insert(invoiceData)
            if (error) throw error
            newCount++
          }

          if (invoice.type && invoiceItems.length > 0) {
            try {
              await supabase
                .from("invoice_items")
                .delete()
                .eq("invoice_id", invoice.id)

              const itemsData = invoiceItems.map((item: any, index: number) => ({
                invoice_id: invoice.id,
                seq_no: item.seqNo || index + 1,
                name: item.name || null,
                unit: item.unit || null,
                quantity: item.quantity || null,
                unit_price: item.unitPrice || null,
                total_value: item.totalValue || null,
                classifier_id: item.classifierId || null,
                deal_type: item.dealType || null,
                vat_rate: item.vatRate || null,
                vat_amount: item.vatAmount || null,
                total: item.total || null,
                inc_env_tax: item.incEnvTax || null,
                other_data: item.otherData || null,
              }))

              await supabase.from("invoice_items").insert(itemsData)

              if (!existingInvoice && invoice.buyerTin === creds.tin && invoice.supplierTin) {
                const { data: partner } = await supabase
                  .from("partner")
                  .select("warehouse_id")
                  .eq("tin", invoice.supplierTin)
                  .single()

                if (partner?.warehouse_id) {
                  await createTransferFromInvoice(supabase, invoice.id, partner.warehouse_id)
                }
              }
            } catch (itemError) {
              console.error(`[GlobalAutoSync] Error processing items:`, itemError)
            }
          }
        } catch (error) {
          console.error(`Error processing invoice ${invoice.id}:`, error)
        }
      }

      await updateSyncSettings({
        lastSyncDate: new Date().toISOString(),
        lastAnchor: result.anchor,
      })

      if (creds) {
        await fetchUnseenCount(creds)
      }

      console.log(`[GlobalAutoSync] Complete. ${newCount} new invoices`)
    } catch (error) {
      console.error("[GlobalAutoSync] Error:", error)
    } finally {
      setSyncing(false)
    }
  }, [credentials, syncSettings, supabase])

  const triggerSync = useCallback(async () => {
    if (syncing) return
    await performSync()
  }, [syncing, performSync])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await refresh()
      setLoading(false)
    }
    init()
  }, [])

  // Auto-sync every 30 minutes
  useEffect(() => {
    if (!credentials || !syncSettings?.lastAnchor) return

    const scheduleNextSync = () => {
      const lastSync = syncSettings.lastSyncDate ? new Date(syncSettings.lastSyncDate).getTime() : 0
      const now = Date.now()
      const timeSinceLastSync = now - lastSync
      const timeUntilNextSync = Math.max(0, SYNC_INTERVAL - timeSinceLastSync)

      console.log(`[GlobalAutoSync] Next sync in ${Math.floor(timeUntilNextSync / 1000 / 60)} minutes`)

      return setTimeout(() => {
        performSync()
      }, timeUntilNextSync)
    }

    const timeoutId = scheduleNextSync()

    return () => {
      clearTimeout(timeoutId)
    }
  }, [credentials, syncSettings, performSync])

  // Refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <TaxSyncContext.Provider
      value={{
        credentials,
        syncSettings,
        unseenCount,
        syncing,
        loading,
        triggerSync,
        refresh,
      }}
    >
      {children}
    </TaxSyncContext.Provider>
  )
}

export function useTaxSyncContext() {
  const context = useContext(TaxSyncContext)
  if (context === undefined) {
    throw new Error("useTaxSyncContext must be used within TaxSyncProvider")
  }
  return context
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, Database, Calendar, AlertCircle, FileText, RefreshCw, Bell } from "lucide-react"
import { EInvoicingClient } from "@/lib/einvoicing-client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { InvoiceDetailDrawer } from "@/components/invoice-detail-drawer"
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

interface Invoice {
  id: string
  serial_no: string | null
  type: string | null
  status: string | null
  created_at: string | null
  supplier_tin: string | null
  buyer_tin: string | null
  total: number | null
  total_vat_amount: number | null
}

export default function TaxServicePage() {
  const [credentials, setCredentials] = useState<TaxServiceCredentials | null>(null)
  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [syncStats, setSyncStats] = useState<{
    totalInvoices: number
    newInvoices: number
    updatedInvoices: number
  } | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const [invoiceType, setInvoiceType] = useState<"incoming" | "outgoing">("incoming")
  const [unseenCount, setUnseenCount] = useState(0)
  const [nextSyncIn, setNextSyncIn] = useState<number | null>(null)

  const { toast } = useToast()
  const supabase = createClient()

  const SYNC_INTERVAL = 30 * 60 * 1000 // 30 minutes in milliseconds

  useEffect(() => {
    fetchCredentials()
    fetchSyncSettings()
    fetchUnseenCount()
    // Set default date: from 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    setFromDate(thirtyDaysAgo.toISOString().split("T")[0])
  }, [])

  // Auto-sync every 30 minutes
  useEffect(() => {
    if (!credentials || !syncSettings?.lastAnchor) return

    const scheduleNextSync = () => {
      const lastSync = syncSettings.lastSyncDate ? new Date(syncSettings.lastSyncDate).getTime() : 0
      const now = Date.now()
      const timeSinceLastSync = now - lastSync
      const timeUntilNextSync = Math.max(0, SYNC_INTERVAL - timeSinceLastSync)

      setNextSyncIn(timeUntilNextSync)

      const timeoutId = setTimeout(() => {
        handleAutoSync()
      }, timeUntilNextSync)

      return timeoutId
    }

    const timeoutId = scheduleNextSync()

    // Update countdown every second
    const intervalId = setInterval(() => {
      if (syncSettings.lastSyncDate) {
        const lastSync = new Date(syncSettings.lastSyncDate).getTime()
        const now = Date.now()
        const timeSinceLastSync = now - lastSync
        const timeUntilNextSync = Math.max(0, SYNC_INTERVAL - timeSinceLastSync)
        setNextSyncIn(timeUntilNextSync)
      }
    }, 1000)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [credentials, syncSettings])

  const fetchCredentials = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "tax_service")
        .single()

      if (error) throw error

      if (data && data.value) {
        setCredentials(data.value as TaxServiceCredentials)
      }
    } catch (error) {
      console.error("Error fetching credentials:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSyncSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "tax_service_sync")
        .single()

      if (!error && data && data.value) {
        setSyncSettings(data.value as SyncSettings)
      }
    } catch (error) {
      console.error("Error fetching sync settings:", error)
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

  const fetchUnseenCount = async () => {
    if (!credentials) return

    try {
      const { count, error } = await supabase
        .from("invoice")
        .select("*", { count: "exact", head: true })
        .eq("buyer_tin", credentials.tin)
        .eq("seen", false)

      if (error) throw error
      setUnseenCount(count || 0)
    } catch (error) {
      console.error("Error fetching unseen count:", error)
    }
  }

  const markAllAsSeen = async () => {
    if (!credentials) return

    try {
      const { error } = await supabase
        .from("invoice")
        .update({ seen: true })
        .eq("buyer_tin", credentials.tin)
        .eq("seen", false)

      if (error) throw error
      setUnseenCount(0)
    } catch (error) {
      console.error("Error marking as seen:", error)
    }
  }

  const fetchInvoices = async (type: "incoming" | "outgoing" = "incoming") => {
    if (!credentials) return

    try {
      setLoadingInvoices(true)

      // Build query based on type
      let query = supabase
        .from("invoice")
        .select("id, serial_no, type, status, created_at, supplier_tin, buyer_tin, total, total_vat_amount")

      if (type === "incoming") {
        // Incoming: buyer_tin = our tin
        query = query.eq("buyer_tin", credentials.tin)
      } else {
        // Outgoing: supplier_tin = our tin
        query = query.eq("supplier_tin", credentials.tin)
      }

      query = query.order("created_at", { ascending: false }).limit(100)

      const { data, error } = await query

      if (error) throw error
      setInvoices(data || [])
    } catch (error) {
      console.error("Error fetching invoices:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել հաշիվ-ապրանքագրերը",
        variant: "destructive",
      })
    } finally {
      setLoadingInvoices(false)
    }
  }

  const handleInvoiceClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsDetailDrawerOpen(true)
  }

  const handleAutoSync = useCallback(async () => {
    if (!credentials || !syncSettings?.lastAnchor) return

    console.log("[AutoSync] Starting automatic sync...")

    try {
      // Initialize EInvoicing client
      const eInvoicing = new EInvoicingClient({
        tin: credentials.tin,
        username: credentials.login,
        password: credentials.password,
      })

      await eInvoicing.init()

      // Set anchor to last sync
      eInvoicing.setAnchor(syncSettings.lastAnchor)

      // Fetch invoices
      const result = await eInvoicing.getInvoices()

      console.log(`[AutoSync] Fetched ${result.count} invoices`)

      let newCount = 0

      // Process and store invoices
      for (const invoice of result.data) {
        try {
          // Check if invoice exists
          const { data: existingInvoice } = await supabase
            .from("invoice")
            .select("id")
            .eq("id", invoice.id)
            .single()

          // Fetch invoice items first to get full details (needed for partner creation)
          let fullInvoice = null
          let invoiceItems: any[] = []
          if (invoice.type) {
            try {
              const itemsResponse = await eInvoicing.getInvoiceItems(invoice.id, invoice.type)
              console.log(`[AutoSync] Items response structure:`, {
                isArray: Array.isArray(itemsResponse),
                hasOk: 'ok' in (itemsResponse || {}),
                ok: (itemsResponse as any)?.ok,
                hasItems: 'items' in (itemsResponse || {}),
                hasPayload: 'payload' in (itemsResponse || {}),
              })

              // Handle response - could be array (error case) or object with ok/items/payload
              if (Array.isArray(itemsResponse)) {
                // Error case - API returned array directly
                invoiceItems = itemsResponse
                console.log(`[AutoSync] Got array response with ${itemsResponse.length} items`)
              } else if (itemsResponse && typeof itemsResponse === 'object' && 'ok' in itemsResponse) {
                // Success case - API returned { ok, items, payload }
                if ((itemsResponse as any).ok) {
                  fullInvoice = (itemsResponse as any).payload
                  invoiceItems = (itemsResponse as any).items || []
                  console.log(`[AutoSync] Got object response - ok: true, items: ${invoiceItems.length}, payload:`, fullInvoice ? 'yes' : 'no')
                } else {
                  console.log(`[AutoSync] Got object response with ok: false`)
                }
              } else {
                console.log(`[AutoSync] Unexpected response type:`, typeof itemsResponse)
              }
            } catch (itemsError) {
              console.error(`[AutoSync] Error fetching items for ${invoice.id}:`, itemsError)
            }
          }

          // Create partner BEFORE saving invoice (to satisfy foreign key constraint)
          // We need to ensure partner exists for ALL supplier_tin values (except when we are the supplier)
          if (!existingInvoice && invoice.supplierTin && invoice.supplierTin !== credentials.tin) {
            console.log(`[AutoSync] Checking/creating partner for supplier ${invoice.supplierTin}`)
            console.log(`[AutoSync] Full invoice payload:`, fullInvoice)
            console.log(`[AutoSync] Invoice list data:`, invoice)

            const partnerData = {
              supplierTin: invoice.supplierTin,
              supplierName: fullInvoice?.supplierName || (invoice as any).supplierName || invoice.supplierTin,
              supplierAddress: fullInvoice?.deliveryAddress || (invoice as any).deliveryAddress || "",
              supplierBank: fullInvoice?.supplierBank || (invoice as any).supplierBank,
              supplierAccNo: fullInvoice?.supplierAccNo || (invoice as any).supplierAccNo,
              invoiceType: invoice.type,
            }

            console.log(`[AutoSync] Partner data for creation:`, partnerData)

            const partnerResult = await ensurePartnerExists(
              supabase,
              partnerData,
              credentials.tin
            )

            // If partner creation failed, skip this invoice
            if (!partnerResult) {
              console.error(`[AutoSync] Failed to create partner for ${invoice.supplierTin}, skipping invoice ${invoice.id}`)
              continue
            }
          }

          // Now save the invoice (partner exists at this point)
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
              seen: false, // New invoices are unseen
            }

            const { error } = await supabase.from("invoice").insert(invoiceData)

            if (error) throw error
            newCount++
          }

          // Store invoice items (for both new and existing invoices)
          if (invoice.type && invoiceItems.length > 0) {
            try {
              // Parse items from invoiceItems
              const items = invoiceItems
              console.log(`[AutoSync] Processing ${items.length} items for invoice ${invoice.id}`)

              if (items.length > 0) {
                // Delete existing items for this invoice first
                const { error: deleteError } = await supabase
                  .from("invoice_items")
                  .delete()
                  .eq("invoice_id", invoice.id)

                if (deleteError) {
                  console.error(`[AutoSync] Error deleting old items:`, deleteError)
                }

                // Insert new items
                const itemsData = items.map((item: any, index: number) => ({
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

                console.log(`[AutoSync] Inserting items for invoice ${invoice.id}:`, itemsData.length)
                const { error: itemsError } = await supabase
                  .from("invoice_items")
                  .insert(itemsData)

                if (itemsError) {
                  console.error(`[AutoSync] Error inserting items for invoice ${invoice.id}:`, itemsError)
                } else {
                  console.log(`[AutoSync] ✓ Successfully saved ${itemsData.length} items for invoice ${invoice.id}`)

                  // Create transfer for incoming invoices if partner has a warehouse
                  if (!existingInvoice && invoice.buyerTin === credentials.tin && invoice.supplierTin) {
                    // Get partner warehouse ID
                    const { data: partner } = await supabase
                      .from("partner")
                      .select("warehouse_id")
                      .eq("tin", invoice.supplierTin)
                      .single()

                    if (partner?.warehouse_id) {
                      console.log(`[AutoSync] Creating transfer for invoice ${invoice.id}`)
                      const transferResult = await createTransferFromInvoice(
                        supabase,
                        invoice.id,
                        partner.warehouse_id
                      )

                      if (transferResult.transferId) {
                        console.log(`[AutoSync] ✓ Created transfer ${transferResult.transferId} for invoice ${invoice.id}`)
                      } else {
                        console.error(`[AutoSync] Failed to create transfer for invoice ${invoice.id}:`, transferResult.errors)
                      }
                    } else {
                      console.log(`[AutoSync] No warehouse for partner, skipping transfer creation`)
                    }
                  }
                }
              }
            } catch (itemError) {
              console.error(`[AutoSync] Error processing items for invoice ${invoice.id}:`, itemError)
            }
          }
        } catch (error) {
          console.error(`Error processing invoice ${invoice.id}:`, error)
        }
      }

      // Update sync settings
      await updateSyncSettings({
        lastSyncDate: new Date().toISOString(),
        lastAnchor: result.anchor,
      })

      // Update unseen count
      await fetchUnseenCount()

      if (newCount > 0) {
        toast({
          title: "Ավտոմատ սինքրոնացում",
          description: `Գտնվեց ${newCount} նոր հաշիվ-ապրանքագիր`,
        })
      }

      console.log(`[AutoSync] Complete. ${newCount} new invoices`)
    } catch (error) {
      console.error("[AutoSync] Error:", error)
    }
  }, [credentials, syncSettings, supabase, toast])

  const handleQuickSync = async () => {
    if (!credentials || !syncSettings?.lastAnchor) {
      toast({
        title: "Սխալ",
        description: "Նախ անհրաժեշտ է կատարել սկզբնական սինքրոնացում",
        variant: "destructive",
      })
      return
    }

    setSyncing(true)

    try {
      await handleAutoSync()
      toast({
        title: "Հաջողություն",
        description: "Սինքրոնացումը ավարտվեց",
      })
    } catch (error) {
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց սինքրոնացնել տվյալները",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleSync = async () => {
    if (!credentials) {
      toast({
        title: "Սխալ",
        description: "Հարկային ծառայության հավատարմագրերը կարգավորված չեն",
        variant: "destructive",
      })
      return
    }

    if (!fromDate) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք ընտրել սկզբի ամսաթիվը",
        variant: "destructive",
      })
      return
    }

    setSyncing(true)
    setSyncStats(null)

    try {
      // Initialize EInvoicing client
      const eInvoicing = new EInvoicingClient({
        tin: credentials.tin,
        username: credentials.login,
        password: credentials.password,
      })

      await eInvoicing.init()

      // Set anchor to from date
      const fromTimestamp = new Date(fromDate).getTime()
      eInvoicing.setAnchor(fromTimestamp)

      toast({
        title: "Սինքրոնացում",
        description: "Ստուգվում է հարկային ծառայությունը...",
      })

      // Fetch invoices
      const result = await eInvoicing.getInvoices()

      console.log(`[TaxService] Fetched ${result.count} invoices`)

      let newCount = 0
      let updatedCount = 0

      // Process and store invoices
      for (const invoice of result.data) {
        console.log(`[Sync] Processing invoice ${invoice.id}, type: ${invoice.type}`)
        try {
          // Check if invoice exists
          const { data: existingInvoice } = await supabase
            .from("invoice")
            .select("id")
            .eq("id", invoice.id)
            .single()

          // Fetch invoice items first to get full details (needed for partner creation)
          let fullInvoice = null
          let invoiceItems: any[] = []
          if (invoice.type) {
            try {
              console.log(`[Sync] Calling getInvoiceItems for ${invoice.id}...`)
              const itemsResponse = await eInvoicing.getInvoiceItems(invoice.id, invoice.type)
              console.log(`[Sync] Items response structure:`, {
                isArray: Array.isArray(itemsResponse),
                hasOk: 'ok' in (itemsResponse || {}),
                ok: (itemsResponse as any)?.ok,
                hasItems: 'items' in (itemsResponse || {}),
                hasPayload: 'payload' in (itemsResponse || {}),
              })

              // Handle response - could be array (error case) or object with ok/items/payload
              if (Array.isArray(itemsResponse)) {
                // Error case - API returned array directly
                invoiceItems = itemsResponse
                console.log(`[Sync] Got array response with ${itemsResponse.length} items`)
              } else if (itemsResponse && typeof itemsResponse === 'object' && 'ok' in itemsResponse) {
                // Success case - API returned { ok, items, payload }
                if ((itemsResponse as any).ok) {
                  fullInvoice = (itemsResponse as any).payload
                  invoiceItems = (itemsResponse as any).items || []
                  console.log(`[Sync] Got object response - ok: true, items: ${invoiceItems.length}, payload:`, fullInvoice ? 'yes' : 'no')
                } else {
                  console.log(`[Sync] Got object response with ok: false`)
                }
              } else {
                console.log(`[Sync] Unexpected response type:`, typeof itemsResponse)
              }
            } catch (itemsError) {
              console.error(`[Sync] Error fetching items for ${invoice.id}:`, itemsError)
            }
          }

          // Create partner BEFORE saving invoice (to satisfy foreign key constraint)
          // Only for suppliers that are NOT us
          if (!existingInvoice && invoice.supplierTin && invoice.supplierTin !== credentials.tin) {
            console.log(`[Sync] Checking/creating partner for supplier ${invoice.supplierTin}`)
            console.log(`[Sync] Full invoice payload:`, fullInvoice)
            console.log(`[Sync] Invoice list data:`, invoice)

            const partnerData = {
              supplierTin: invoice.supplierTin,
              supplierName: fullInvoice?.supplierName || (invoice as any).supplierName || invoice.supplierTin,
              supplierAddress: fullInvoice?.deliveryAddress || (invoice as any).deliveryAddress || "",
              supplierBank: fullInvoice?.supplierBank || (invoice as any).supplierBank,
              supplierAccNo: fullInvoice?.supplierAccNo || (invoice as any).supplierAccNo,
              invoiceType: invoice.type,
            }

            console.log(`[Sync] Partner data for creation:`, partnerData)

            const partnerResult = await ensurePartnerExists(
              supabase,
              partnerData,
              credentials.tin
            )

            // If partner creation failed, skip this invoice
            if (!partnerResult) {
              console.error(`[Sync] Failed to create partner for ${invoice.supplierTin}, skipping invoice ${invoice.id}`)
              continue
            }
          }

          // Now save the invoice (partner exists at this point)
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
            seen: false, // New invoices are unseen by default
          }

          if (existingInvoice) {
            // Update existing invoice (but don't change seen status)
            const { seen, ...updateData } = invoiceData
            const { error } = await supabase
              .from("invoice")
              .update(updateData)
              .eq("id", invoice.id)

            if (error) throw error
            updatedCount++
          } else {
            // Insert new invoice
            const { error } = await supabase
              .from("invoice")
              .insert(invoiceData)

            if (error) throw error
            newCount++
          }

          // Store invoice items (for both new and existing invoices)
          if (invoice.type && invoiceItems.length > 0) {
            try {
              // Get partner warehouse ID for transfer creation
              let partnerWarehouseId: number | null = null
              if (invoice.buyerTin === credentials.tin && invoice.supplierTin) {
                const { data: partner } = await supabase
                  .from("partner")
                  .select("warehouse_id")
                  .eq("tin", invoice.supplierTin)
                  .single()

                if (partner?.warehouse_id) {
                  partnerWarehouseId = partner.warehouse_id
                  console.log(`[Sync] Partner warehouse ID: ${partnerWarehouseId}`)
                }
              }

              // Store invoice items if available
              const items = invoiceItems
              console.log(`[Sync] Processing ${items.length} items for invoice ${invoice.id}`)

              if (items.length > 0) {
                // Delete existing items for this invoice
                const { error: deleteError } = await supabase
                  .from("invoice_items")
                  .delete()
                  .eq("invoice_id", invoice.id)

                if (deleteError) {
                  console.error(`[Sync] Error deleting old items:`, deleteError)
                }

                // Insert new items
                const itemsData = items.map((item: any, index: number) => ({
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

                console.log(`[Sync] Inserting items for invoice ${invoice.id}:`, itemsData.length)
                const { error: itemsError } = await supabase
                  .from("invoice_items")
                  .insert(itemsData)

                if (itemsError) {
                  console.error(`[Sync] Error inserting items for invoice ${invoice.id}:`, itemsError)
                } else {
                  console.log(`[Sync] ✓ Successfully saved ${itemsData.length} items for invoice ${invoice.id}`)

                  // Create transfer for incoming invoices if we have a partner warehouse
                  if (!existingInvoice && invoice.buyerTin === credentials.tin && partnerWarehouseId) {
                    console.log(`[Sync] Creating transfer for invoice ${invoice.id}`)
                    const transferResult = await createTransferFromInvoice(
                      supabase,
                      invoice.id,
                      partnerWarehouseId
                    )

                    if (transferResult.transferId) {
                      console.log(`[Sync] ✓ Created transfer ${transferResult.transferId} for invoice ${invoice.id}`)
                    } else {
                      console.error(`[Sync] Failed to create transfer for invoice ${invoice.id}:`, transferResult.errors)
                    }
                  } else if (invoice.buyerTin === credentials.tin && !partnerWarehouseId) {
                    console.log(`[Sync] Skipping transfer creation - no partner warehouse (invoice type: ${invoice.type})`)
                  }
                }
              }
            } catch (itemError) {
              console.error(`[Sync] Error processing items for invoice ${invoice.id}:`, itemError)
            }
          }
        } catch (error) {
          console.error(`Error processing invoice ${invoice.id}:`, error)
        }
      }

      setSyncStats({
        totalInvoices: result.count,
        newInvoices: newCount,
        updatedInvoices: updatedCount,
      })

      // Update sync settings
      await updateSyncSettings({
        lastSyncDate: new Date().toISOString(),
        lastAnchor: result.anchor,
      })

      // Refresh invoices list
      await fetchInvoices(invoiceType)

      // Update unseen count
      await fetchUnseenCount()

      toast({
        title: "Հաջողություն",
        description: `Սինքրոնացվեց ${result.count} հաշիվ-ապրանքագիր`,
      })
    } catch (error) {
      console.error("Sync error:", error)
      toast({
        title: "Սխալ",
        description: error instanceof Error ? error.message : "Չհաջողվեց սինքրոնացնել տվյալները",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("hy-AM", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleString("hy-AM", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "-"

    const now = Date.now()
    const date = new Date(dateStr).getTime()
    const diff = now - date

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} օր առաջ`
    if (hours > 0) return `${hours} ժամ առաջ`
    if (minutes > 0) return `${minutes} րոպե առաջ`
    return "հենց նոր"
  }

  const getNextSyncTime = () => {
    if (!nextSyncIn) return "-"

    const totalSeconds = Math.floor(nextSyncIn / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutes > 0) {
      return `${minutes} րոպե ${seconds} վայրկյան`
    }
    return `${seconds} վայրկյան`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!credentials) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Հարկային ծառայություն</h2>
          <p className="text-muted-foreground">
            Սինքրոնացրեք հաշիվ-ապրանքագրերը հարկային ծառայությունից
          </p>
        </div>

        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Հավատարմագրերը կարգավորված չեն</CardTitle>
            </div>
            <CardDescription>
              Սինքրոնացման համար անհրաժեշտ է կարգավորել հարկային ծառայության հավատարմագրերը
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = "/dashboard/configs"}>
              Անցնել կարգավորումներ
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Հարկային ծառայություն</h2>
        <p className="text-muted-foreground">
          Սինքրոնացրեք և կառավարեք հաշիվ-ապրանքագրերը
        </p>
      </div>

      {/* Sync Status Card */}
      {syncSettings?.lastSyncDate && (
        <Card className="border-primary/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`h-5 w-5 text-primary ${syncing ? 'animate-spin' : ''}`} />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Վերջին սինքրոնացում</p>
                    <p className="text-lg font-semibold">{getTimeAgo(syncSettings.lastSyncDate)}</p>
                  </div>
                </div>

                {nextSyncIn !== null && nextSyncIn > 0 && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Հաջորդ սինքրոնացում</p>
                      <p className="text-lg font-semibold">{getNextSyncTime()}</p>
                    </div>
                  </div>
                )}

                {unseenCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Չտեսված</p>
                      <p className="text-lg font-semibold text-orange-500">{unseenCount}</p>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleQuickSync}
                disabled={syncing}
                size="sm"
              >
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Սինքրոնացվում է
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Սինքրոնացնել հիմա
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="main" className="space-y-6">
        <TabsList>
          <TabsTrigger value="main">Սինքրոնացում</TabsTrigger>
          <TabsTrigger value="invoices" onClick={() => !loadingInvoices && invoices.length === 0 && fetchInvoices("incoming")}>
            Հաշիվ-ապրանքագրեր
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Sync Settings Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle>Սինքրոնացում</CardTitle>
                </div>
                <CardDescription>
                  Սինքրոնացրեք հաշիվ-ապրանքագրերը հարկային ծառայությունից
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {syncSettings?.lastSyncDate && (
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Վերջին սինքրոնացում</p>
                    <p className="text-base mt-1">{formatDateTime(syncSettings.lastSyncDate)}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="from-date">Սինքրոնացնել սկսած</Label>
                  <Input
                    id="from-date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    disabled={syncing}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ավտոմատ կսինքրոնացվի մինչև ընթացիկ ժամանակը
                  </p>
                </div>

                <Button
                  onClick={handleSync}
                  disabled={syncing || !fromDate}
                  className="w-full"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Սինքրոնացվում է...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Սինքրոնացնել
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Credentials Info Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle>Միացված հաշիվ</CardTitle>
                </div>
                <CardDescription>
                  Ակտիվ հարկային ծառայության հավատարմագրեր
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ՀՎՀՀ</p>
                  <p className="text-base mt-1">{credentials.tin}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Մուտքանուն</p>
                  <p className="text-base mt-1">{credentials.login}</p>
                </div>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/dashboard/configs"}
                  >
                    Փոխել հավատարմագրերը
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sync Stats */}
          {syncStats && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle>Սինքրոնացման արդյունքներ</CardTitle>
                <CardDescription>Վերջին սինքրոնացման վիճակագրություն</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Ընդհանուր</p>
                    <p className="text-3xl font-bold">{syncStats.totalInvoices}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Նոր</p>
                    <p className="text-3xl font-bold text-green-600">{syncStats.newInvoices}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Թարմացված</p>
                    <p className="text-3xl font-bold text-blue-600">{syncStats.updatedInvoices}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle>Հաշիվ-ապրանքագրեր</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchInvoices(invoiceType)} disabled={loadingInvoices}>
                  {loadingInvoices ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Թարմացնել"
                  )}
                </Button>
              </div>
              <CardDescription>
                Վերջին 100 սինքրոնացված հաշիվ-ապրանքագրերը
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={invoiceType}
                onValueChange={(value) => {
                  setInvoiceType(value as "incoming" | "outgoing")
                  fetchInvoices(value as "incoming" | "outgoing")
                }}
                className="space-y-4"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="incoming">Մուտք</TabsTrigger>
                  <TabsTrigger value="outgoing">Ելք</TabsTrigger>
                </TabsList>

                <TabsContent value="incoming" className="space-y-4">
                  {loadingInvoices ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Մուտքային հաշիվ-ապրանքագրեր չկան
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Համար</TableHead>
                          <TableHead>Տեսակ</TableHead>
                          <TableHead>Մատակարար ՀՎՀՀ</TableHead>
                          <TableHead>Ստատուս</TableHead>
                          <TableHead className="text-right">Գումար</TableHead>
                          <TableHead className="text-right">ԱԱՀ</TableHead>
                          <TableHead>Ամսաթիվ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow
                            key={invoice.id}
                            className="cursor-pointer hover:bg-accent"
                            onClick={() => handleInvoiceClick(invoice)}
                          >
                            <TableCell className="font-medium">{invoice.serial_no || invoice.id.slice(0, 8)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{invoice.type || "-"}</Badge>
                            </TableCell>
                            <TableCell>{invoice.supplier_tin || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={invoice.status === "ACTIVE" ? "default" : "secondary"}>
                                {invoice.status || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {invoice.total != null ? `${invoice.total.toLocaleString()} ֏` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {invoice.total_vat_amount != null ? `${invoice.total_vat_amount.toLocaleString()} ֏` : "-"}
                            </TableCell>
                            <TableCell>{formatDate(invoice.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="outgoing" className="space-y-4">
                  {loadingInvoices ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Ելքային հաշիվ-ապրանքագրեր չկան
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Համար</TableHead>
                          <TableHead>Տեսակ</TableHead>
                          <TableHead>Ստացող ՀՎՀՀ</TableHead>
                          <TableHead>Ստատուս</TableHead>
                          <TableHead className="text-right">Գումար</TableHead>
                          <TableHead className="text-right">ԱԱՀ</TableHead>
                          <TableHead>Ամսաթիվ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow
                            key={invoice.id}
                            className="cursor-pointer hover:bg-accent"
                            onClick={() => handleInvoiceClick(invoice)}
                          >
                            <TableCell className="font-medium">{invoice.serial_no || invoice.id.slice(0, 8)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{invoice.type || "-"}</Badge>
                            </TableCell>
                            <TableCell>{invoice.buyer_tin || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={invoice.status === "ACTIVE" ? "default" : "secondary"}>
                                {invoice.status || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {invoice.total != null ? `${invoice.total.toLocaleString()} ֏` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {invoice.total_vat_amount != null ? `${invoice.total_vat_amount.toLocaleString()} ֏` : "-"}
                            </TableCell>
                            <TableCell>{formatDate(invoice.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedInvoice && (
        <InvoiceDetailDrawer
          open={isDetailDrawerOpen}
          onOpenChange={setIsDetailDrawerOpen}
          invoiceId={selectedInvoice.id}
        />
      )}
    </div>
  )
}

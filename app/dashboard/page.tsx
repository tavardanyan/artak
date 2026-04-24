"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Check, Eye } from "lucide-react"
import { stringSimilarity } from "@/lib/levenshtein"
import { InvoiceDetailDrawer } from "@/components/invoice-detail-drawer"
import { TransferDetailDrawer } from "@/components/transfer-detail-drawer"

interface Item {
  id: number
  name: string
  unit: string | null
  created_at: string
  parent: number | null
  seen: boolean | null
}

interface ParentSuggestion {
  id: number
  name: string
  similarity: number
}

interface Transfer {
  id: number
  created_at: string
  from: number
  to: number
  invoice_id: string | null
  from_warehouse?: { name: string }
  to_warehouse?: { name: string }
  invoice?: {
    destination_address: string | null
  } | null
}

interface DraftTransfer {
  id: number
  created_at: string
  delivered_at: string | null
  from: number
  to: number
  invoice_id: string | null
  from_warehouse?: { name: string }
  to_warehouse?: { name: string }
}

interface Warehouse {
  id: number
  name: string
}

interface Invoice {
  id: string
  created_at: string
  seen: boolean
  supplier_tin: string | null
  total: number | null
  serial_no: string | null
  issued_at: string | null
  type: string | null
  supplier?: {
    name: string
    tin: string
  }
}

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([])
  const [allParentItems, setAllParentItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [processingItems, setProcessingItems] = useState<Set<number>>(new Set())
  const [selectedParents, setSelectedParents] = useState<Record<number, number | null>>({})
  const [matchLimit, setMatchLimit] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 5
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [defaultWarehouse, setDefaultWarehouse] = useState<number | null>(null)
  const [processingTransfers, setProcessingTransfers] = useState<Set<number>>(new Set())
  const [selectedWarehouses, setSelectedWarehouses] = useState<Record<number, number>>({})
  const [transfersPage, setTransfersPage] = useState(1)
  const [totalTransfers, setTotalTransfers] = useState(0)
  const transfersPerPage = 10
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false)
  const [processingInvoices, setProcessingInvoices] = useState<Set<string>>(new Set())
  const [invoicesPage, setInvoicesPage] = useState(1)
  const [totalInvoices, setTotalInvoices] = useState(0)
  const invoicesPerPage = 10
  const [partnerTotals, setPartnerTotals] = useState({ transfers: 0, payments: 0, balance: 0 })
  const [partnerTotalsLoading, setPartnerTotalsLoading] = useState(true)
  const [internalAccountsBalance, setInternalAccountsBalance] = useState(0)
  const [internalBalanceLoading, setInternalBalanceLoading] = useState(true)
  const [projectsAggregate, setProjectsAggregate] = useState<{
    budget: number
    contractsRemaining: number
    contractsPlanned: number
    contractsInProgress: number
    contractsDone: number
    contractsPaid: number
    txIncome: number
    txOutcome: number
    supplierPaid: number
    supplierDebt: number
    warehouseStockValue: number
  } | null>(null)
  const [projectsAggregateLoading, setProjectsAggregateLoading] = useState(true)
  const [draftTransfers, setDraftTransfers] = useState<DraftTransfer[]>([])
  const [selectedDraftTransferId, setSelectedDraftTransferId] = useState<number | null>(null)
  const [isDraftDrawerOpen, setIsDraftDrawerOpen] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchMatchLimit()
    fetchDefaultWarehouse()
    fetchItems()
    fetchAllParentItems()
    fetchWarehouses()
    fetchTransfers()
    fetchInvoices()
    fetchPartnerTotals()
    fetchInternalAccountsBalance()
    fetchDraftTransfers()
    fetchProjectsAggregate()
  }, [currentPage, transfersPage, invoicesPage])

  const fetchMatchLimit = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "item_matching_limit")
        .single()

      if (!error && data?.value) {
        setMatchLimit(Number(data.value))
      }
    } catch (error) {
      console.error("Error fetching match limit:", error)
    }
  }

  const fetchDefaultWarehouse = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "default_transfer_warehouse")
        .single()

      if (!error && data?.value) {
        setDefaultWarehouse(Number(data.value))
      }
    } catch (error) {
      console.error("Error fetching default warehouse:", error)
    }
  }

  const fetchItems = async () => {
    try {
      setLoading(true)

      // Get total count
      const { count } = await supabase
        .from("item")
        .select("*", { count: "exact", head: true })
        .is("parent", null)
        .or("seen.is.null,seen.eq.false")

      setTotalItems(count || 0)

      // Get paginated items
      const { data, error } = await supabase
        .from("item")
        .select("id, name, unit, created_at, parent, seen")
        .is("parent", null)
        .or("seen.is.null,seen.eq.false")
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)

      if (error) throw error

      setItems(data || [])
    } catch (error) {
      console.error("Error fetching items:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել ապրանքները",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAllParentItems = async () => {
    try {
      const { data, error } = await supabase
        .from("item")
        .select("id, name, unit, created_at, parent, seen")
        .is("parent", null)

      if (error) throw error

      setAllParentItems(data || [])
    } catch (error) {
      console.error("Error fetching parent items:", error)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from("warehouse")
        .select("id, name, type")
        .neq("type", "supplier")
        .order("name")

      if (error) throw error

      setWarehouses(data || [])
    } catch (error) {
      console.error("Error fetching warehouses:", error)
    }
  }

  const fetchTransfers = async () => {
    try {
      const transferWarehouseId = defaultWarehouse || 114

      // Get total count
      const { count } = await supabase
        .from("transfer")
        .select("*", { count: "exact", head: true })
        .eq("to", transferWarehouseId)

      setTotalTransfers(count || 0)

      // Get paginated transfers
      const { data, error } = await supabase
        .from("transfer")
        .select(`
          id,
          created_at,
          from,
          to,
          invoice_id,
          from_warehouse:warehouse!transfer_from_fkey(name),
          to_warehouse:warehouse!transfer_to_fkey(name),
          invoice:invoice!transfer_invoice_id_fkey(destination_address)
        `)
        .eq("to", transferWarehouseId)
        .order("created_at", { ascending: false })
        .range((transfersPage - 1) * transfersPerPage, transfersPage * transfersPerPage - 1)

      if (error) throw error

      setTransfers((data || []) as unknown as Transfer[])
    } catch (error) {
      console.error("Error fetching transfers:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել փոխանցումները",
        variant: "destructive",
      })
    }
  }

  const fetchProjectsAggregate = async () => {
    setProjectsAggregateLoading(true)
    try {
      // Fetch all projects (including sub-projects) with their partner info
      const { data: projects } = await supabase
        .from("project")
        .select(`id, budget, partner:partner_id(account_id, warehouse_id)`)

      if (!projects) {
        setProjectsAggregate(null)
        return
      }

      let budget = 0
      let contractsPlanned = 0, contractsInProgress = 0, contractsDone = 0, contractsPaid = 0
      let txIncome = 0, txOutcome = 0
      let supplierPaid = 0, supplierDebt = 0
      let warehouseStockValue = 0

      for (const p of projects as any[]) {
        budget += p.budget || 0

        // Contracts by status + paid
        const { data: subContracts } = await supabase
          .from("contract")
          .select("id, total, status")
          .eq("project_id", p.id)

        const contractIds: number[] = []
        ;(subContracts || []).forEach((c: any) => {
          if (c.status === "planned") contractsPlanned += c.total || 0
          else if (c.status === "in progress") contractsInProgress += c.total || 0
          else if (c.status === "done") contractsDone += c.total || 0
          if (c.status !== "rejected") contractIds.push(c.id)
        })

        if (contractIds.length > 0) {
          const { data: cts } = await supabase
            .from("contract_transaction")
            .select("contact_id, transaction:transaction_id(amount)")
            .in("contact_id", contractIds)
          ;(cts || []).forEach((ct: any) => {
            contractsPaid += ct.transaction?.amount || 0
          })
        }

        // Transactions (income = partner is sender, outcome = otherwise)
        const partnerAccId = p.partner?.account_id
        const { data: subTxs } = await supabase
          .from("transaction")
          .select("amount, from, to")
          .eq("project_id", p.id)
        ;(subTxs || []).forEach((t: any) => {
          if (partnerAccId && t.from === partnerAccId) txIncome += t.amount
          else txOutcome += t.amount
        })

        // Suppliers + their debt + paid
        if (p.partner?.warehouse_id) {
          const { data: subTransfers } = await supabase
            .from("transfer")
            .select(`id, from, transfer_item(qty, unit_amount)`)
            .eq("to", p.partner.warehouse_id)
            .not("acepted_at", "is", null)
            .is("rejected_at", null)

          const supplierWarehouseIds = new Set((subTransfers || []).map((t: any) => t.from))
          if (supplierWarehouseIds.size > 0) {
            const { data: supplierPartners } = await supabase
              .from("partner")
              .select("warehouse_id, account_id")
              .in("warehouse_id", Array.from(supplierWarehouseIds))
            const partnerByWh = new Map((supplierPartners || []).map((sp: any) => [sp.warehouse_id, sp]))

            for (const wid of supplierWarehouseIds) {
              const partnerInfo: any = partnerByWh.get(wid)
              if (!partnerInfo) continue
              const transfersForSupplier = (subTransfers || []).filter((t: any) => t.from === wid)
              const transfersSum = transfersForSupplier.reduce((s: number, t: any) => {
                return s + (t.transfer_item || []).reduce((ss: number, ti: any) => ss + (ti.qty * ti.unit_amount), 0)
              }, 0)
              let paidToSupplier = 0
              if (partnerInfo.account_id) {
                const { data: pmts } = await supabase
                  .from("transaction")
                  .select("amount")
                  .eq("to", partnerInfo.account_id)
                  .eq("project_id", p.id)
                  .not("accepted_at", "is", null)
                  .is("rejected_at", null)
                paidToSupplier = (pmts || []).reduce((s: number, t: any) => s + t.amount, 0)
              }
              supplierDebt += transfersSum - paidToSupplier
              supplierPaid += paidToSupplier
            }
          }
        }

        // Warehouse stock value
        if (p.partner?.warehouse_id) {
          const { data: stockData } = await supabase
            .from("warehouse_item_stock")
            .select("item_id, stock_qty")
            .eq("warehouse_id", p.partner.warehouse_id)
          for (const s of stockData || []) {
            const { data: tis } = await supabase
              .from("transfer_item")
              .select("unit_amount, transfer:transfer_id(acepted_at, to, from)")
              .eq("item_id", s.item_id)
              .not("transfer.acepted_at", "is", null)
              .or(`to.eq.${p.partner.warehouse_id},from.eq.${p.partner.warehouse_id}`, { foreignTable: "transfer" })
            const valid = (tis || []).map((t: any) => t.unit_amount).filter((pr: any) => pr != null)
            const avg = valid.length > 0 ? valid.reduce((a: number, b: number) => a + b, 0) / valid.length : 0
            warehouseStockValue += avg * s.stock_qty
          }
        }
      }

      const contractsRemaining = (contractsPlanned + contractsInProgress + contractsDone) - contractsPaid

      setProjectsAggregate({
        budget,
        contractsRemaining,
        contractsPlanned,
        contractsInProgress,
        contractsDone,
        contractsPaid,
        txIncome,
        txOutcome,
        supplierPaid,
        supplierDebt,
        warehouseStockValue,
      })
    } catch (error) {
      console.error("Error fetching projects aggregate:", error)
    } finally {
      setProjectsAggregateLoading(false)
    }
  }

  const fetchDraftTransfers = async () => {
    try {
      const { data, error } = await supabase
        .from("transfer")
        .select(`
          id,
          created_at,
          delivered_at,
          from,
          to,
          invoice_id,
          from_warehouse:warehouse!transfer_from_fkey(name),
          to_warehouse:warehouse!transfer_to_fkey(name)
        `)
        .is("delivered_at", null)
        .is("acepted_at", null)
        .is("rejected_at", null)
        .order("created_at", { ascending: true })
        .limit(20)

      if (error) throw error
      setDraftTransfers((data || []) as unknown as DraftTransfer[])
    } catch (error) {
      console.error("Error fetching draft transfers:", error)
    }
  }

  const fetchInvoices = async () => {
    try {
      // Get total count
      const { count } = await supabase
        .from("invoice")
        .select("*", { count: "exact", head: true })
        .eq("seen", false)

      setTotalInvoices(count || 0)

      // Get paginated invoices with supplier info
      const { data, error } = await supabase
        .from("invoice")
        .select(`
          id,
          created_at,
          seen,
          supplier_tin,
          total,
          serial_no,
          issued_at,
          type,
          supplier:partner!invoice_supplier_tin_fkey (
            name,
            tin
          )
        `)
        .eq("seen", false)
        .order("created_at", { ascending: false })
        .range((invoicesPage - 1) * invoicesPerPage, invoicesPage * invoicesPerPage - 1)

      if (error) throw error

      setInvoices((data || []) as unknown as Invoice[])
    } catch (error) {
      console.error("Error fetching invoices:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել ապրանքագրերը",
        variant: "destructive",
      })
    }
  }

  const handleInvoiceClick = (invoice: Invoice) => {
    setSelectedInvoiceId(invoice.id)
    setIsInvoiceDrawerOpen(true)
  }

  const handleMarkInvoiceSeen = async (invoiceId: string) => {
    setProcessingInvoices((prev) => new Set(prev).add(invoiceId))

    try {
      const { error } = await supabase
        .from("invoice")
        .update({ seen: true })
        .eq("id", invoiceId)

      if (error) throw error

      // Remove from list
      setInvoices((prev) => prev.filter((i) => i.id !== invoiceId))
      setTotalInvoices((prev) => prev - 1)
      setIsInvoiceDrawerOpen(false)

      toast({
        title: "Հաջողություն",
        description: "Ապրանքագիրը նշվեց որպես դիտված",
      })
    } catch (error) {
      console.error("Error marking invoice as seen:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց նշել ապրանքագիրը որպես դիտված",
        variant: "destructive",
      })
    } finally {
      setProcessingInvoices((prev) => {
        const newSet = new Set(prev)
        newSet.delete(invoiceId)
        return newSet
      })
    }
  }

  const getParentSuggestions = (itemName: string, currentItemId: number): ParentSuggestion[] => {
    // Calculate similarity for each potential parent
    const suggestions = allParentItems
      .filter((item) => item.id !== currentItemId) // Exclude current item
      .map((item) => ({
        id: item.id,
        name: item.name,
        similarity: stringSimilarity(itemName, item.name),
      }))
      .sort((a, b) => b.similarity - a.similarity) // Sort by similarity descending
      .slice(0, matchLimit) // Take top N matches

    return suggestions
  }

  const handleDone = async (item: Item) => {
    setProcessingItems((prev) => new Set(prev).add(item.id))

    try {
      const parentId = selectedParents[item.id] || null

      // Update item: set seen = true and parent if selected
      const { error: updateError } = await supabase
        .from("item")
        .update({
          seen: true,
          parent: parentId,
        })
        .eq("id", item.id)

      if (updateError) throw updateError

      // If parent was set, update all transfer_item rows
      if (parentId) {
        console.log(`[Item] Updating transfer_item rows: ${item.id} -> ${parentId}`)

        const { error: transferError } = await supabase
          .from("transfer_item")
          .update({ item_id: parentId })
          .eq("item_id", item.id)

        if (transferError) {
          console.error("[Item] Error updating transfer_item:", transferError)
          toast({
            title: "Զգուշացում",
            description: `Ապրանքը պահպանվեց, բայց փոխանցումները չթարմացվեցին`,
            variant: "destructive",
          })
        } else {
          console.log(`[Item] Successfully updated transfer_item rows`)
        }
      }

      // Remove from UI
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setTotalItems((prev) => prev - 1)

      toast({
        title: "Հաջողություն",
        description: parentId
          ? "Ապրանքը կապվեց ծնող ապրանքի հետ"
          : "Ապրանքը նշվեց որպես դիտված",
      })
    } catch (error) {
      console.error("Error processing item:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց պահպանել փոփոխությունները",
        variant: "destructive",
      })
    } finally {
      setProcessingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(item.id)
        return newSet
      })
    }
  }

  const handleUpdateTransferWarehouse = async (transferId: number) => {
    setProcessingTransfers((prev) => new Set(prev).add(transferId))

    try {
      const newWarehouseId = selectedWarehouses[transferId] || defaultWarehouse

      if (!newWarehouseId) {
        toast({
          title: "Սխալ",
          description: "Ընտրեք պահեստ",
          variant: "destructive",
        })
        return
      }

      // Get the transfer to find the associated invoice_id
      const transfer = transfers.find((t) => t.id === transferId)
      const invoiceId = transfer?.invoice_id

      // Update the transfer warehouse
      const { error } = await supabase
        .from("transfer")
        .update({ to: newWarehouseId })
        .eq("id", transferId)

      if (error) throw error

      // If transfer has an associated invoice, mark it as seen
      if (invoiceId) {
        const { error: invoiceError } = await supabase
          .from("invoice")
          .update({ seen: true })
          .eq("id", invoiceId)

        if (invoiceError) {
          console.error("Error updating invoice:", invoiceError)
        }
      }

      // Remove from list
      setTransfers((prev) => prev.filter((t) => t.id !== transferId))
      setTotalTransfers((prev) => prev - 1)

      // Refresh invoices list to remove the invoice from unseen list
      await fetchInvoices()

      toast({
        title: "Հաջողություն",
        description: "Փոխանցումը թարմացվեց",
      })
    } catch (error) {
      console.error("Error updating transfer:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց թարմացնել փոխանցումը",
        variant: "destructive",
      })
    } finally {
      setProcessingTransfers((prev) => {
        const newSet = new Set(prev)
        newSet.delete(transferId)
        return newSet
      })
    }
  }

  const fetchPartnerTotals = async () => {
    setPartnerTotalsLoading(true)
    try {
      // Get all partners with their accounts and warehouses
      const { data: partners, error: partnersError } = await supabase
        .from("partner")
        .select("id, account_id, warehouse_id")

      if (partnersError) throw partnersError

      let totalTransfers = 0
      let totalPayments = 0

      // For each partner, calculate their statistics
      for (const partner of partners || []) {
        // Get transfer statistics if partner has a warehouse
        if (partner.warehouse_id) {
          const { data: transfers } = await supabase
            .from("transfer")
            .select(`
              id,
              acepted_at,
              rejected_at,
              transfer_item(qty, unit_price, unit_vat)
            `)
            .eq("from", partner.warehouse_id)

          if (transfers) {
            transfers.forEach((transfer: any) => {
              const transferTotal = (transfer.transfer_item || []).reduce((sum: number, item: any) => {
                return sum + (item.qty * item.unit_price) + (item.qty * item.unit_vat)
              }, 0)
              totalTransfers += transferTotal
            })
          }
        }

        // Get transaction statistics if partner has an account
        if (partner.account_id) {
          const { data: transactions } = await supabase
            .from("transaction")
            .select("amount")
            .eq("to", partner.account_id)
            .not("accepted_at", "is", null)
            .is("rejected_at", null)

          if (transactions) {
            totalPayments += transactions.reduce((sum, t) => sum + t.amount, 0)
          }
        }
      }

      const balance = totalTransfers - totalPayments

      setPartnerTotals({
        transfers: totalTransfers,
        payments: totalPayments,
        balance: balance
      })
    } catch (error) {
      console.error("Error fetching partner totals:", error)
    } finally {
      setPartnerTotalsLoading(false)
    }
  }

  const fetchInternalAccountsBalance = async () => {
    setInternalBalanceLoading(true)
    try {
      // Get all internal accounts (not related to partners or persons)
      const { data: accounts, error: accountsError } = await supabase
        .from("account")
        .select("id")
        .eq("internal", true)

      if (accountsError) throw accountsError

      let totalBalance = 0

      // For each internal account, calculate balance
      for (const account of accounts || []) {
        // Get incoming transactions
        const { data: incoming } = await supabase
          .from("transaction")
          .select("amount")
          .eq("to", account.id)
          .not("accepted_at", "is", null)
          .is("rejected_at", null)

        // Get outgoing transactions
        const { data: outgoing } = await supabase
          .from("transaction")
          .select("amount")
          .eq("from", account.id)
          .not("accepted_at", "is", null)
          .is("rejected_at", null)

        const incomingSum = (incoming || []).reduce((sum, t) => sum + t.amount, 0)
        const outgoingSum = (outgoing || []).reduce((sum, t) => sum + t.amount, 0)

        totalBalance += (incomingSum - outgoingSum)
      }

      setInternalAccountsBalance(totalBalance)
    } catch (error) {
      console.error("Error fetching internal accounts balance:", error)
    } finally {
      setInternalBalanceLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("hy-AM", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount) + " ֏"
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const totalTransferPages = Math.ceil(totalTransfers / transfersPerPage)
  const totalInvoicePages = Math.ceil(totalInvoices / invoicesPerPage)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ապրանքների ստուգում</h2>
        <p className="text-sm text-muted-foreground">
          Ստուգեք և կապեք նոր ապրանքները գոյություն ունեցող ապրանքների հետ
        </p>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Գործընկերների ընդհանուր</CardTitle>
          </CardHeader>
          <CardContent>
            {partnerTotalsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Տեղափոխություններ:</span>
                  <span className="font-medium">{formatCurrency(partnerTotals.transfers)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Վճարումներ:</span>
                  <span className="font-medium text-blue-600">{formatCurrency(partnerTotals.payments)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="font-medium">Մնացորդ:</span>
                  <span className={`font-bold ${partnerTotals.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(partnerTotals.balance)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ներքին հաշիվների մնացորդ</CardTitle>
          </CardHeader>
          <CardContent>
            {internalBalanceLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(internalAccountsBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ներքին հաշիվների ընդհանուր մնացորդ
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Տարբերություն</CardTitle>
          </CardHeader>
          <CardContent>
            {partnerTotalsLoading || internalBalanceLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className={`text-2xl font-bold ${
                  (internalAccountsBalance - partnerTotals.balance) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(internalAccountsBalance - partnerTotals.balance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ներքին հաշիվներ - Գործընկերների մնացորդ
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projects Big Summary Card */}
      {projectsAggregateLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : projectsAggregate && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Բյուջե</p>
                <p className="text-2xl font-bold">{projectsAggregate.budget ? formatCurrency(projectsAggregate.budget) : "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Մնում է վճարել</p>
                <p className={`text-2xl font-bold ${projectsAggregate.contractsRemaining > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(projectsAggregate.contractsRemaining)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Տարբերություն (գործարքներ)</p>
                <p className={`text-2xl font-bold ${projectsAggregate.txIncome - projectsAggregate.txOutcome >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(projectsAggregate.txIncome - projectsAggregate.txOutcome)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Մատակարարների պարտք</p>
                <p className={`text-2xl font-bold ${projectsAggregate.supplierDebt > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(projectsAggregate.supplierDebt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Պահեստի արժեք</p>
                <p className="text-2xl font-bold">{formatCurrency(projectsAggregate.warehouseStockValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contracts Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Պայմանագրերի ամփոփում</CardTitle>
          </CardHeader>
          <CardContent>
            {projectsAggregateLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : projectsAggregate && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Պլանավորված:</span>
                  <span className="font-medium">{formatCurrency(projectsAggregate.contractsPlanned)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ընթացքի մեջ:</span>
                  <span className="font-medium">{formatCurrency(projectsAggregate.contractsInProgress)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Կատարված:</span>
                  <span className="font-medium">{formatCurrency(projectsAggregate.contractsDone)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="font-medium">Փաստացի վճարված:</span>
                  <span className="font-bold text-green-600">{formatCurrency(projectsAggregate.contractsPaid)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Մնում է վճարել:</span>
                  <span className={`font-bold ${projectsAggregate.contractsRemaining > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(projectsAggregate.contractsRemaining)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Բոլոր գործարքներ</CardTitle>
          </CardHeader>
          <CardContent>
            {projectsAggregateLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : projectsAggregate && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Մուտքեր:</span>
                  <span className="font-medium text-green-600">+{formatCurrency(projectsAggregate.txIncome)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ելքեր:</span>
                  <span className="font-medium text-red-600">-{formatCurrency(projectsAggregate.txOutcome)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="font-medium">Տարբերություն:</span>
                  <span className={`font-bold ${projectsAggregate.txIncome - projectsAggregate.txOutcome >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(projectsAggregate.txIncome - projectsAggregate.txOutcome)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Մատակարարների գործարքներ</CardTitle>
          </CardHeader>
          <CardContent>
            {projectsAggregateLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : projectsAggregate && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Արդեն վճարված:</span>
                  <span className="font-medium text-green-600">{formatCurrency(projectsAggregate.supplierPaid)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="font-medium">Պարտք:</span>
                  <span className={`font-bold ${projectsAggregate.supplierDebt > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(projectsAggregate.supplierDebt)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

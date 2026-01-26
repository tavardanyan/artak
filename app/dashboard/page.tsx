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
  const [internalAccountsBalance, setInternalAccountsBalance] = useState(0)

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

      const { error } = await supabase
        .from("transfer")
        .update({ to: newWarehouseId })
        .eq("id", transferId)

      if (error) throw error

      // Remove from list
      setTransfers((prev) => prev.filter((t) => t.id !== transferId))
      setTotalTransfers((prev) => prev - 1)

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
    }
  }

  const fetchInternalAccountsBalance = async () => {
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ներքին հաշիվների մնացորդ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(internalAccountsBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ներքին հաշիվների ընդհանուր մնացորդ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Տարբերություն</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              (internalAccountsBalance - partnerTotals.balance) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(internalAccountsBalance - partnerTotals.balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ներքին հաշիվներ - Գործընկերների մնացորդ
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Items & Transfers */}
        <div className="space-y-4">
          <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Չստուգված ապրանքներ ({totalItems})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Բոլոր ապրանքները ստուգված են
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-[35%] py-2">Անուն</TableHead>
                    <TableHead className="w-[10%] py-2">Միավոր</TableHead>
                    <TableHead className="w-[15%] py-2">Ստեղծման ա/թ</TableHead>
                    <TableHead className="w-[30%] py-2">Ծնող ապրանք</TableHead>
                    <TableHead className="w-[10%] py-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const suggestions = getParentSuggestions(item.name, item.id)
                    const isProcessing = processingItems.has(item.id)

                    return (
                      <TableRow key={item.id} className="text-xs">
                        <TableCell className="font-medium py-2">{item.name}</TableCell>
                        <TableCell className="py-2">{item.unit || "-"}</TableCell>
                        <TableCell className="py-2">{formatDate(item.created_at)}</TableCell>
                        <TableCell className="py-2">
                          <Select
                            value={selectedParents[item.id]?.toString() || "none"}
                            onValueChange={(value) => {
                              setSelectedParents((prev) => ({
                                ...prev,
                                [item.id]: value === "none" ? null : Number(value),
                              }))
                            }}
                            disabled={isProcessing}
                          >
                            <SelectTrigger className="w-full h-8 text-xs">
                              <SelectValue placeholder="Ընտրել ծնող ապրանք" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">Ոչ մեկը</SelectItem>
                              {suggestions.map((suggestion) => (
                                <SelectItem key={suggestion.id} value={suggestion.id.toString()} className="text-xs">
                                  {suggestion.name} ({suggestion.similarity.toFixed(0)}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-2">
                          <Button
                            size="sm"
                            onClick={() => handleDone(item)}
                            disabled={isProcessing}
                            className="h-7 text-xs"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Պատրաստ
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-muted-foreground">
                    Էջ {currentPage} / {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-7 text-xs"
                    >
                      Նախորդ
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-7 text-xs"
                    >
                      Հաջորդ
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
          </Card>

          {/* Transfers Table */}
          <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Անհայտ փոխանցումներ ({totalTransfers})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Բոլոր փոխանցումները նշանակված են
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-[15%] py-2">Ա/թ</TableHead>
                    <TableHead className="w-[20%] py-2">Որտեղից</TableHead>
                    <TableHead className="w-[25%] py-2">Հասցե</TableHead>
                    <TableHead className="w-[30%] py-2">Նոր նշանակում</TableHead>
                    <TableHead className="w-[10%] py-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((transfer) => {
                    const isProcessing = processingTransfers.has(transfer.id)

                    return (
                      <TableRow key={transfer.id} className="text-xs">
                        <TableCell className="py-2">{formatDate(transfer.created_at)}</TableCell>
                        <TableCell className="py-2">
                          {transfer.from_warehouse?.name || `ID: ${transfer.from}`}
                        </TableCell>
                        <TableCell
                          className={`py-2 ${transfer.invoice_id ? 'cursor-pointer hover:underline text-blue-600' : ''}`}
                          onClick={() => {
                            if (transfer.invoice_id) {
                              setSelectedInvoiceId(transfer.invoice_id)
                              setIsInvoiceDrawerOpen(true)
                            }
                          }}
                        >
                          {transfer.invoice?.destination_address || "-"}
                        </TableCell>
                        <TableCell className="py-2">
                          <Select
                            value={selectedWarehouses[transfer.id]?.toString() || defaultWarehouse?.toString() || ""}
                            onValueChange={(value) => {
                              setSelectedWarehouses((prev) => ({
                                ...prev,
                                [transfer.id]: Number(value),
                              }))
                            }}
                            disabled={isProcessing}
                          >
                            <SelectTrigger className="w-full h-8 text-xs">
                              <SelectValue placeholder="Ընտրել պահեստ" />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses.map((warehouse) => (
                                <SelectItem key={warehouse.id} value={warehouse.id.toString()} className="text-xs">
                                  {warehouse.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateTransferWarehouse(transfer.id)}
                            disabled={isProcessing}
                            className="h-7 text-xs"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Պատրաստ
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalTransferPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-muted-foreground">
                    Էջ {transfersPage} / {totalTransferPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTransfersPage((p) => Math.max(1, p - 1))}
                      disabled={transfersPage === 1}
                      className="h-7 text-xs"
                    >
                      Նախորդ
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTransfersPage((p) => Math.min(totalTransferPages, p + 1))}
                      disabled={transfersPage === totalTransferPages}
                      className="h-7 text-xs"
                    >
                      Հաջորդ
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
          </Card>
        </div>

        {/* Right Column: Invoices */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                Չստուգված ապրանքագրեր ({totalInvoices})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Բոլոր ապրանքագրերը ստուգված են
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-[30%] py-2">Համար</TableHead>
                        <TableHead className="w-[25%] py-2">Ա/թ</TableHead>
                        <TableHead className="w-[30%] py-2">Մատակարար</TableHead>
                        <TableHead className="w-[15%] py-2"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => {
                        const isProcessing = processingInvoices.has(invoice.id)

                        return (
                          <TableRow
                            key={invoice.id}
                            className="text-xs cursor-pointer hover:bg-accent"
                            onClick={() => handleInvoiceClick(invoice)}
                          >
                            <TableCell className="font-medium py-2">
                              {invoice.serial_no || invoice.id.substring(0, 8)}
                            </TableCell>
                            <TableCell className="py-2">
                              {formatDate(invoice.issued_at || invoice.created_at)}
                            </TableCell>
                            <TableCell className="py-2">
                              {invoice.supplier?.name || invoice.supplier_tin || "-"}
                            </TableCell>
                            <TableCell className="py-2">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkInvoiceSeen(invoice.id)
                                }}
                                disabled={isProcessing}
                                className="h-7 text-xs"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <Eye className="h-3 w-3 mr-1" />
                                    Դիտված
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalInvoicePages > 1 && (
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-xs text-muted-foreground">
                        Էջ {invoicesPage} / {totalInvoicePages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInvoicesPage((p) => Math.max(1, p - 1))}
                          disabled={invoicesPage === 1}
                          className="h-7 text-xs"
                        >
                          Նախորդ
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInvoicesPage((p) => Math.min(totalInvoicePages, p + 1))}
                          disabled={invoicesPage === totalInvoicePages}
                          className="h-7 text-xs"
                        >
                          Հաջորդ
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Invoice Details Drawer */}
      {selectedInvoiceId && (
        <InvoiceDetailDrawer
          open={isInvoiceDrawerOpen}
          onOpenChange={setIsInvoiceDrawerOpen}
          invoiceId={selectedInvoiceId}
        />
      )}
    </div>
  )
}

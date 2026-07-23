"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Loader2, TruckIcon, PackagePlus, RefreshCw, Warehouse } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { InvoiceDetailDrawer } from "@/components/invoice-detail-drawer"
import { TransferDetailDrawer } from "@/components/transfer-detail-drawer"
import { createTransferFromInvoice, rebuildTransferItemsFromInvoice } from "@/lib/invoice-transfer-handler"
import { createWarehouseForPartner } from "@/lib/invoice-partner-handler"

interface ProblemInvoice {
  id: string
  serial_no: string | null
  type: string | null
  created_at: string | null
  issued_at: string | null
  delivered_at: string | null
  supplier_tin: string | null
  supplier_name: string | null
  supplier_warehouse_id?: number | null
  total_value: number | null
  total_vat_amount: number | null
  total: number | null
}

interface MismatchRow {
  transfer_id: number
  transfer_created_at: string | null
  invoice_id: string
  serial_no: string | null
  issued_at: string | null
  delivered_at: string | null
  supplier_name: string | null
  invoice_total: number | null
  transfer_total: number | null
  diff: number | null
  total_mismatch: boolean
  items_mismatch: boolean
  mismatched_lines: number
}

interface ProblemPartner {
  id: number
  name: string
  tin: string | null
  address: string | null
  invoice_count: number
  last_invoice_at: string | null
}

const ROW_LIMIT = 200
const TAB_VALUES = ["no-transfer", "no-items", "mismatch", "no-warehouse"] as const
type TabValue = (typeof TAB_VALUES)[number]

export default function ProblemsPage() {
  const params = useParams<{ tab?: string[] }>()
  const router = useRouter()
  const [invoicesNoTransfer, setInvoicesNoTransfer] = useState<ProblemInvoice[]>([])
  const [invoicesNoItems, setInvoicesNoItems] = useState<ProblemInvoice[]>([])
  const [mismatches, setMismatches] = useState<MismatchRow[]>([])
  const [partnersNoWarehouse, setPartnersNoWarehouse] = useState<ProblemPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [selNoTransfer, setSelNoTransfer] = useState<Set<string>>(new Set())
  const [selNoItems, setSelNoItems] = useState<Set<string>>(new Set())
  const [selMismatch, setSelMismatch] = useState<Set<number>>(new Set())
  const [selPartners, setSelPartners] = useState<Set<number>>(new Set())
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false)
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null)
  const [isTransferDrawerOpen, setIsTransferDrawerOpen] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  const activeTab: TabValue = TAB_VALUES.includes(params.tab?.[0] as TabValue)
    ? (params.tab![0] as TabValue)
    : "no-transfer"

  const handleTabChange = (value: string) => {
    router.replace(`/dashboard/unchecked/problems/${value}`)
  }

  useEffect(() => {
    fetchProblems()
  }, [])

  const fetchProblems = async () => {
    setLoading(true)
    try {
      const [noTransfer, noItems, mismatch, noWarehouse] = await Promise.all([
        supabase
          .from("problem_invoice_no_transfer")
          .select("*")
          .order("issued_at", { ascending: false, nullsFirst: false })
          .limit(ROW_LIMIT),
        supabase
          .from("problem_invoice_no_items")
          .select("*")
          .order("issued_at", { ascending: false, nullsFirst: false })
          .limit(ROW_LIMIT),
        supabase
          .from("problem_transfer_mismatch")
          .select("*")
          .order("issued_at", { ascending: false, nullsFirst: false })
          .limit(ROW_LIMIT),
        supabase
          .from("problem_partner_no_warehouse")
          .select("*")
          .order("last_invoice_at", { ascending: false, nullsFirst: false })
          .limit(ROW_LIMIT),
      ])

      if (noTransfer.error) throw noTransfer.error
      if (noItems.error) throw noItems.error
      if (mismatch.error) throw mismatch.error
      if (noWarehouse.error) throw noWarehouse.error

      setInvoicesNoTransfer((noTransfer.data || []) as ProblemInvoice[])
      setInvoicesNoItems((noItems.data || []) as ProblemInvoice[])
      setMismatches((mismatch.data || []) as MismatchRow[])
      setPartnersNoWarehouse((noWarehouse.data || []) as ProblemPartner[])
      setSelNoTransfer(new Set())
      setSelNoItems(new Set())
      setSelMismatch(new Set())
      setSelPartners(new Set())
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const toggleIn = <T,>(set: Set<T>, id: T): Set<T> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  const toggleAll = <T,>(set: Set<T>, allIds: T[]): Set<T> =>
    set.size === allIds.length ? new Set<T>() : new Set(allIds)

  const handleInvoiceClick = (invoice: ProblemInvoice) => {
    setSelectedInvoiceId(invoice.id)
    setIsInvoiceDrawerOpen(true)
  }

  // A drawer action (create transfer, delete) may have resolved the row
  const handleInvoiceDrawerChange = (open: boolean) => {
    setIsInvoiceDrawerOpen(open)
    if (!open) fetchProblems()
  }

  const handleTransferDrawerChange = (open: boolean) => {
    setIsTransferDrawerOpen(open)
    if (!open) fetchProblems()
  }

  const handleBulkCreateTransfers = async () => {
    const selected = invoicesNoTransfer.filter((i) => selNoTransfer.has(i.id))
    if (selected.length === 0) return
    setBulkProcessing(true)
    let created = 0
    let warehousesCreated = 0
    const failed: string[] = []
    // Several selected invoices may share a supplier — create its warehouse once
    const warehouseByTin = new Map<string, number>()
    try {
      for (const invoice of selected) {
        let warehouseId =
          invoice.supplier_warehouse_id ??
          (invoice.supplier_tin ? warehouseByTin.get(invoice.supplier_tin) : undefined) ??
          null

        if (!warehouseId && invoice.supplier_tin) {
          const { data: partner } = await supabase
            .from("partner")
            .select("id, name, address, warehouse_id")
            .eq("tin", invoice.supplier_tin)
            .maybeSingle()
          if (partner) {
            if (partner.warehouse_id) {
              warehouseId = partner.warehouse_id
            } else {
              const { warehouseId: newId, error } = await createWarehouseForPartner(supabase, partner)
              if (newId) {
                warehouseId = newId
                warehousesCreated++
              } else {
                failed.push(`${invoice.serial_no || invoice.id}: ${error || "պահեստի ստեղծումը ձախողվեց"}`)
                continue
              }
            }
            if (warehouseId) warehouseByTin.set(invoice.supplier_tin, warehouseId)
          }
        }

        if (!warehouseId) {
          failed.push(`${invoice.serial_no || invoice.id}: մատակարարը գրանցված չէ`)
          continue
        }
        const { transferId, errors } = await createTransferFromInvoice(supabase, invoice.id, warehouseId)
        if (transferId) created++
        else failed.push(`${invoice.serial_no || invoice.id}: ${errors[0] || "անհայտ սխալ"}`)
      }
      toast({
        title: `Ստեղծվեց ${created} տեղափոխում`,
        description: [
          warehousesCreated > 0 ? `Ստեղծվեց ${warehousesCreated} պահեստ` : null,
          failed.length > 0 ? `Չհաջողվեց ${failed.length}՝ ${failed[0]}` : null,
        ].filter(Boolean).join(", ") || undefined,
        variant: failed.length > 0 ? "destructive" : undefined,
      })
    } finally {
      setBulkProcessing(false)
      fetchProblems()
    }
  }

  const handleBulkCreateWarehouses = async () => {
    const selected = partnersNoWarehouse.filter((p) => selPartners.has(p.id))
    if (selected.length === 0) return
    setBulkProcessing(true)
    let created = 0
    const failed: string[] = []
    try {
      for (const partner of selected) {
        const { warehouseId, error } = await createWarehouseForPartner(supabase, partner)
        if (warehouseId) created++
        else failed.push(`${partner.name}: ${error || "անհայտ սխալ"}`)
      }
      toast({
        title: `Ստեղծվեց ${created} պահեստ`,
        description: failed.length > 0 ? `Չհաջողվեց ${failed.length}՝ ${failed[0]}` : undefined,
        variant: failed.length > 0 ? "destructive" : undefined,
      })
    } finally {
      setBulkProcessing(false)
      fetchProblems()
    }
  }

  const handleBulkSyncItems = async () => {
    const ids = Array.from(selNoItems)
    if (ids.length === 0) return
    setBulkProcessing(true)
    try {
      const res = await fetch("/api/sync-invoice-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: ids }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || res.statusText)
      const results: { status: string }[] = json?.results || []
      const synced = results.filter((r) => r.status === "synced").length
      const noItems = results.filter((r) => r.status === "no_items").length
      const errors = results.filter((r) => r.status === "error").length
      toast({
        title: `Լրացվեց ${synced} ապրանքագիր`,
        description: [
          noItems > 0 ? `${noItems}-ի ապրանքները աղբյուրում նույնպես բացակայում են` : null,
          errors > 0 ? `${errors} սխալ` : null,
        ].filter(Boolean).join(", ") || undefined,
        variant: errors > 0 ? "destructive" : undefined,
      })
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setBulkProcessing(false)
      fetchProblems()
    }
  }

  const handleBulkRebuildTransfers = async () => {
    const ids = Array.from(selMismatch)
    if (ids.length === 0) return
    setBulkProcessing(true)
    let rebuilt = 0
    const failed: string[] = []
    try {
      for (const transferId of ids) {
        const { rebuilt: ok, errors } = await rebuildTransferItemsFromInvoice(supabase, transferId)
        if (ok) rebuilt++
        else failed.push(`#${transferId}: ${errors[0] || "անհայտ սխալ"}`)
      }
      toast({
        title: `Վերակառուցվեց ${rebuilt} տեղափոխում`,
        description: failed.length > 0 ? `Չհաջողվեց ${failed.length}՝ ${failed[0]}` : undefined,
        variant: failed.length > 0 ? "destructive" : undefined,
      })
    } finally {
      setBulkProcessing(false)
      fetchProblems()
    }
  }

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString("hy-AM", { year: "numeric", month: "short", day: "numeric" }) : "-"

  const rowCheckbox = (checked: boolean, onChange: () => void) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 cursor-pointer accent-primary"
    />
  )

  const bulkBar = (count: number, action: React.ReactNode) => (
    <div className="flex items-center justify-between pb-3">
      <span className="text-sm text-muted-foreground">
        {count > 0 ? `Ընտրված է ${count}` : "Ընտրեք տողերը խմբային գործողության համար"}
      </span>
      {action}
    </div>
  )

  const invoiceTable = (
    invoices: ProblemInvoice[],
    selected: Set<string>,
    setSelected: (s: Set<string>) => void,
    emptyText: string
  ) =>
    invoices.length === 0 ? (
      <div className="text-center py-8 text-sm text-muted-foreground">{emptyText}</div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="w-8 py-2">
              {rowCheckbox(selected.size === invoices.length && invoices.length > 0, () =>
                setSelected(toggleAll(selected, invoices.map((i) => i.id)))
              )}
            </TableHead>
            <TableHead className="w-[20%] py-2">Համար</TableHead>
            <TableHead className="w-[15%] py-2">Ա/թ</TableHead>
            <TableHead className="w-[33%] py-2">Մատակարար</TableHead>
            <TableHead className="w-[15%] py-2 text-right">Ընդամենը</TableHead>
            <TableHead className="w-[12%] py-2">Տեսակ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} className="text-xs cursor-pointer hover:bg-accent" onClick={() => handleInvoiceClick(invoice)}>
              <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                {rowCheckbox(selected.has(invoice.id), () => setSelected(toggleIn(selected, invoice.id)))}
              </TableCell>
              <TableCell className="font-medium py-2">{invoice.serial_no || invoice.id.substring(0, 8)}</TableCell>
              <TableCell className="py-2">{formatDate(invoice.delivered_at || invoice.issued_at || invoice.created_at)}</TableCell>
              <TableCell className="py-2">
                {invoice.supplier_name || invoice.supplier_tin || "-"}
                {invoice.supplier_warehouse_id === null && (
                  <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 text-amber-600 border-amber-600">
                    Պահեստ չկա
                  </Badge>
                )}
              </TableCell>
              <TableCell className="py-2 text-right font-medium">
                {invoice.total != null ? `${invoice.total.toLocaleString()} ֏` : "-"}
              </TableCell>
              <TableCell className="py-2 text-muted-foreground">{invoice.type || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Խնդրահարույց գրառումներ</h2>
        <p className="text-sm text-muted-foreground">
          Ապրանքագրեր առանց տեղափոխման կամ ապրանքների
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="no-transfer">
              Առանց տեղափոխման ({invoicesNoTransfer.length})
            </TabsTrigger>
            <TabsTrigger value="no-items">
              Առանց ապրանքների ({invoicesNoItems.length})
            </TabsTrigger>
            <TabsTrigger value="mismatch">
              Անհամապատասխան ({mismatches.length})
            </TabsTrigger>
            <TabsTrigger value="no-warehouse">
              Առանց պահեստի ({partnersNoWarehouse.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="no-transfer">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground pb-3">
                  Գնման ապրանքագրեր, որոնց համար տեղափոխում չի ստեղծվել
                </p>
                {invoicesNoTransfer.some((i) => i.supplier_warehouse_id === null) && (
                  <p className="text-xs text-amber-600 pb-3">
                    «Պահեստ չկա» նշված տողերի մատակարարները պահեստ չունեն․ տեղափոխում ստեղծելիս
                    պահեստը կստեղծվի ավտոմատ, կամ նախապես ստեղծեք բոլորը{" "}
                    <button
                      type="button"
                      className="underline font-medium"
                      onClick={() => handleTabChange("no-warehouse")}
                    >
                      «Առանց պահեստի»
                    </button>{" "}
                    ներդիրում
                  </p>
                )}
                {bulkBar(
                  selNoTransfer.size,
                  <Button size="sm" className="h-7 text-xs" disabled={selNoTransfer.size === 0 || bulkProcessing} onClick={handleBulkCreateTransfers}>
                    {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <TruckIcon className="h-3 w-3 mr-1" />}
                    Ստեղծել տեղափոխումներ ({selNoTransfer.size})
                  </Button>
                )}
                {invoiceTable(invoicesNoTransfer, selNoTransfer, setSelNoTransfer, "Բոլոր ապրանքագրերն ունեն տեղափոխում")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="no-items">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground pb-3">
                  Ապրանքագրեր, որոնց տողերը բացակայում են․ լրացվում են աղբյուրից
                </p>
                {bulkBar(
                  selNoItems.size,
                  <Button size="sm" className="h-7 text-xs" disabled={selNoItems.size === 0 || bulkProcessing} onClick={handleBulkSyncItems}>
                    {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <PackagePlus className="h-3 w-3 mr-1" />}
                    Լրացնել ապրանքները ({selNoItems.size})
                  </Button>
                )}
                {invoiceTable(invoicesNoItems, selNoItems, setSelNoItems, "Բոլոր ապրանքագրերն ունեն ապրանքներ")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mismatch">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground pb-3">
                  Տեղափոխումներ, որոնց գումարը կամ ապրանքները չեն համընկնում ապրանքագրի հետ (ձեռքով բաժանվածները հաշվի չեն առնվում)
                </p>
                {bulkBar(
                  selMismatch.size,
                  <Button size="sm" className="h-7 text-xs" disabled={selMismatch.size === 0 || bulkProcessing} onClick={handleBulkRebuildTransfers}>
                    {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    Վերակառուցել ապրանքագրից ({selMismatch.size})
                  </Button>
                )}
                {mismatches.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Անհամապատասխանություններ չկան</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-8 py-2">
                          {rowCheckbox(selMismatch.size === mismatches.length && mismatches.length > 0, () =>
                            setSelMismatch(toggleAll(selMismatch, mismatches.map((m) => m.transfer_id)))
                          )}
                        </TableHead>
                        <TableHead className="w-[16%] py-2">Համար</TableHead>
                        <TableHead className="w-[12%] py-2">Ա/թ</TableHead>
                        <TableHead className="w-[26%] py-2">Մատակարար</TableHead>
                        <TableHead className="w-[13%] py-2 text-right">Ապրանքագիր</TableHead>
                        <TableHead className="w-[13%] py-2 text-right">Տեղափոխում</TableHead>
                        <TableHead className="w-[10%] py-2 text-right">Տարբերություն</TableHead>
                        <TableHead className="w-[10%] py-2">Խնդիր</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mismatches.map((row) => (
                        <TableRow
                          key={row.transfer_id}
                          className="text-xs cursor-pointer hover:bg-accent"
                          onClick={() => {
                            setSelectedTransferId(row.transfer_id)
                            setIsTransferDrawerOpen(true)
                          }}
                        >
                          <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                            {rowCheckbox(selMismatch.has(row.transfer_id), () =>
                              setSelMismatch(toggleIn(selMismatch, row.transfer_id))
                            )}
                          </TableCell>
                          <TableCell className="font-medium py-2">{row.serial_no || row.invoice_id.substring(0, 8)}</TableCell>
                          <TableCell className="py-2">{formatDate(row.delivered_at || row.issued_at || row.transfer_created_at)}</TableCell>
                          <TableCell className="py-2">{row.supplier_name || "-"}</TableCell>
                          <TableCell className="py-2 text-right">
                            {row.invoice_total != null ? `${row.invoice_total.toLocaleString()} ֏` : "-"}
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            {row.transfer_total != null ? `${row.transfer_total.toLocaleString()} ֏` : "-"}
                          </TableCell>
                          <TableCell className={`py-2 text-right font-medium ${(row.diff || 0) > 1 ? "text-destructive" : (row.diff || 0) < -1 ? "text-amber-600" : ""}`}>
                            {row.diff != null ? `${row.diff > 0 ? "+" : ""}${row.diff.toLocaleString()} ֏` : "-"}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex gap-1">
                              {row.total_mismatch && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Գումար</Badge>}
                              {row.items_mismatch && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Ապրանքներ ({row.mismatched_lines})</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="no-warehouse">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground pb-3">
                  Մատակարարներ, որոնք ապրանքագրեր ունեն, բայց պահեստ չունեն․ առանց պահեստի տեղափոխում հնարավոր չէ ստեղծել
                </p>
                {bulkBar(
                  selPartners.size,
                  <Button size="sm" className="h-7 text-xs" disabled={selPartners.size === 0 || bulkProcessing} onClick={handleBulkCreateWarehouses}>
                    {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Warehouse className="h-3 w-3 mr-1" />}
                    Ստեղծել պահեստներ ({selPartners.size})
                  </Button>
                )}
                {partnersNoWarehouse.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Բոլոր մատակարարներն ունեն պահեստ</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-8 py-2">
                          {rowCheckbox(selPartners.size === partnersNoWarehouse.length && partnersNoWarehouse.length > 0, () =>
                            setSelPartners(toggleAll(selPartners, partnersNoWarehouse.map((p) => p.id)))
                          )}
                        </TableHead>
                        <TableHead className="w-[35%] py-2">Անվանում</TableHead>
                        <TableHead className="w-[13%] py-2">ՀՎՀՀ</TableHead>
                        <TableHead className="w-[27%] py-2">Հասցե</TableHead>
                        <TableHead className="w-[12%] py-2 text-right">Ապրանքագրեր</TableHead>
                        <TableHead className="w-[13%] py-2">Վերջին Ա/թ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partnersNoWarehouse.map((partner) => (
                        <TableRow key={partner.id} className="text-xs">
                          <TableCell className="py-2">
                            {rowCheckbox(selPartners.has(partner.id), () => setSelPartners(toggleIn(selPartners, partner.id)))}
                          </TableCell>
                          <TableCell className="font-medium py-2">{partner.name}</TableCell>
                          <TableCell className="py-2">{partner.tin || "-"}</TableCell>
                          <TableCell className="py-2 text-muted-foreground">{partner.address || "-"}</TableCell>
                          <TableCell className="py-2 text-right">{partner.invoice_count}</TableCell>
                          <TableCell className="py-2">{formatDate(partner.last_invoice_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {selectedInvoiceId && (
        <InvoiceDetailDrawer
          open={isInvoiceDrawerOpen}
          onOpenChange={handleInvoiceDrawerChange}
          invoiceId={selectedInvoiceId}
        />
      )}

      <TransferDetailDrawer
        open={isTransferDrawerOpen}
        onOpenChange={handleTransferDrawerChange}
        transferId={selectedTransferId}
      />
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Loader2, TruckIcon, PackagePlus } from "lucide-react"
import { InvoiceDetailDrawer } from "@/components/invoice-detail-drawer"
import { createTransferFromInvoice } from "@/lib/invoice-transfer-handler"

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

const ROW_LIMIT = 200
const TAB_VALUES = ["no-transfer", "no-items"] as const
type TabValue = (typeof TAB_VALUES)[number]

export default function ProblemsPage() {
  const params = useParams<{ tab?: string[] }>()
  const router = useRouter()
  const [invoicesNoTransfer, setInvoicesNoTransfer] = useState<ProblemInvoice[]>([])
  const [invoicesNoItems, setInvoicesNoItems] = useState<ProblemInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [selNoTransfer, setSelNoTransfer] = useState<Set<string>>(new Set())
  const [selNoItems, setSelNoItems] = useState<Set<string>>(new Set())
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false)

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
      const [noTransfer, noItems] = await Promise.all([
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
      ])

      if (noTransfer.error) throw noTransfer.error
      if (noItems.error) throw noItems.error

      setInvoicesNoTransfer((noTransfer.data || []) as ProblemInvoice[])
      setInvoicesNoItems((noItems.data || []) as ProblemInvoice[])
      setSelNoTransfer(new Set())
      setSelNoItems(new Set())
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const toggleIn = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  const toggleAll = (set: Set<string>, allIds: string[]): Set<string> =>
    set.size === allIds.length ? new Set<string>() : new Set(allIds)

  const handleInvoiceClick = (invoice: ProblemInvoice) => {
    setSelectedInvoiceId(invoice.id)
    setIsInvoiceDrawerOpen(true)
  }

  // A drawer action (create transfer, delete) may have resolved the row
  const handleInvoiceDrawerChange = (open: boolean) => {
    setIsInvoiceDrawerOpen(open)
    if (!open) fetchProblems()
  }

  const handleBulkCreateTransfers = async () => {
    const selected = invoicesNoTransfer.filter((i) => selNoTransfer.has(i.id))
    if (selected.length === 0) return
    setBulkProcessing(true)
    let created = 0
    const failed: string[] = []
    try {
      for (const invoice of selected) {
        if (!invoice.supplier_warehouse_id) {
          failed.push(`${invoice.serial_no || invoice.id}: մատակարարը պահեստ չունի`)
          continue
        }
        const { transferId, errors } = await createTransferFromInvoice(
          supabase,
          invoice.id,
          invoice.supplier_warehouse_id
        )
        if (transferId) created++
        else failed.push(`${invoice.serial_no || invoice.id}: ${errors[0] || "անհայտ սխալ"}`)
      }
      toast({
        title: `Ստեղծվեց ${created} տեղափոխում`,
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
              <TableCell className="py-2">{invoice.supplier_name || invoice.supplier_tin || "-"}</TableCell>
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
          </TabsList>

          <TabsContent value="no-transfer">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground pb-3">
                  Գնման ապրանքագրեր, որոնց համար տեղափոխում չի ստեղծվել
                </p>
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
        </Tabs>
      )}

      {selectedInvoiceId && (
        <InvoiceDetailDrawer
          open={isInvoiceDrawerOpen}
          onOpenChange={handleInvoiceDrawerChange}
          invoiceId={selectedInvoiceId}
        />
      )}
    </div>
  )
}

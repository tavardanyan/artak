"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { InvoiceDetailDrawer } from "@/components/invoice-detail-drawer"
import { TransferDetailDrawer } from "@/components/transfer-detail-drawer"

interface ProblemInvoice {
  id: string
  serial_no: string | null
  type: string | null
  created_at: string | null
  issued_at: string | null
  delivered_at: string | null
  supplier_tin: string | null
  supplier_name: string | null
  total_value: number | null
  total_vat_amount: number | null
  total: number | null
}

interface ProblemTransfer {
  id: number
  created_at: string
  invoice_id: string | null
  from_warehouse_name: string | null
  to_warehouse_name: string | null
  invoice_serial_no: string | null
}

const ROW_LIMIT = 200

export default function ProblemsPage() {
  const [invoicesNoTransfer, setInvoicesNoTransfer] = useState<ProblemInvoice[]>([])
  const [invoicesNoItems, setInvoicesNoItems] = useState<ProblemInvoice[]>([])
  const [transfersNoItems, setTransfersNoItems] = useState<ProblemTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false)
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null)
  const [isTransferDrawerOpen, setIsTransferDrawerOpen] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchProblems()
  }, [])

  const fetchProblems = async () => {
    setLoading(true)
    try {
      const [noTransfer, noItems, emptyTransfers] = await Promise.all([
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
          .from("problem_transfer_no_items")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT),
      ])

      if (noTransfer.error) throw noTransfer.error
      if (noItems.error) throw noItems.error
      if (emptyTransfers.error) throw emptyTransfers.error

      setInvoicesNoTransfer((noTransfer.data || []) as ProblemInvoice[])
      setInvoicesNoItems((noItems.data || []) as ProblemInvoice[])
      setTransfersNoItems((emptyTransfers.data || []) as ProblemTransfer[])
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceClick = (invoice: ProblemInvoice) => {
    setSelectedInvoiceId(invoice.id)
    setIsInvoiceDrawerOpen(true)
  }

  const handleTransferClick = (transfer: ProblemTransfer) => {
    setSelectedTransferId(transfer.id)
    setIsTransferDrawerOpen(true)
  }

  // A drawer action (create transfer, delete, split) may have resolved the row
  const handleInvoiceDrawerChange = (open: boolean) => {
    setIsInvoiceDrawerOpen(open)
    if (!open) fetchProblems()
  }

  const handleTransferDrawerChange = (open: boolean) => {
    setIsTransferDrawerOpen(open)
    if (!open) fetchProblems()
  }

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString("hy-AM", { year: "numeric", month: "short", day: "numeric" }) : "-"

  const invoiceTable = (invoices: ProblemInvoice[], emptyText: string) =>
    invoices.length === 0 ? (
      <div className="text-center py-8 text-sm text-muted-foreground">{emptyText}</div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="w-[20%] py-2">Համար</TableHead>
            <TableHead className="w-[15%] py-2">Ա/թ</TableHead>
            <TableHead className="w-[35%] py-2">Մատակարար</TableHead>
            <TableHead className="w-[15%] py-2 text-right">Ընդամենը</TableHead>
            <TableHead className="w-[15%] py-2">Տեսակ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} className="text-xs cursor-pointer hover:bg-accent" onClick={() => handleInvoiceClick(invoice)}>
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
          Ապրանքագրեր առանց տեղափոխման կամ ապրանքների և դատարկ տեղափոխումներ
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                Ապրանքագրեր առանց տեղափոխման ({invoicesNoTransfer.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Գնման ապրանքագրեր, որոնց համար տեղափոխում չի ստեղծվել․ բացեք ապրանքագիրը և ստեղծեք տեղափոխումը
              </p>
            </CardHeader>
            <CardContent>
              {invoiceTable(invoicesNoTransfer, "Բոլոր ապրանքագրերն ունեն տեղափոխում")}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                Ապրանքագրեր առանց ապրանքների ({invoicesNoItems.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Ապրանքագրեր, որոնց տողերը բացակայում են․ կարող է լինել համաժամացման խափանման հետևանք
              </p>
            </CardHeader>
            <CardContent>
              {invoiceTable(invoicesNoItems, "Բոլոր ապրանքագրերն ունեն ապրանքներ")}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                Տեղափոխումներ առանց ապրանքների ({transfersNoItems.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Դատարկ տեղափոխումներ․ ստուգեք և լրացրեք կամ ջնջեք
              </p>
            </CardHeader>
            <CardContent>
              {transfersNoItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Դատարկ տեղափոխումներ չկան</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-[10%] py-2">№</TableHead>
                      <TableHead className="w-[15%] py-2">Ա/թ</TableHead>
                      <TableHead className="w-[30%] py-2">Որտեղից</TableHead>
                      <TableHead className="w-[30%] py-2">Ուր</TableHead>
                      <TableHead className="w-[15%] py-2">Ապրանքագիր</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfersNoItems.map((transfer) => (
                      <TableRow key={transfer.id} className="text-xs cursor-pointer hover:bg-accent" onClick={() => handleTransferClick(transfer)}>
                        <TableCell className="font-medium py-2">#{transfer.id}</TableCell>
                        <TableCell className="py-2">{formatDate(transfer.created_at)}</TableCell>
                        <TableCell className="py-2">{transfer.from_warehouse_name || "-"}</TableCell>
                        <TableCell className="py-2">{transfer.to_warehouse_name || "-"}</TableCell>
                        <TableCell className="py-2 text-muted-foreground">{transfer.invoice_serial_no || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
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

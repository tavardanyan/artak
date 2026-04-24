"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Eye } from "lucide-react"
import { InvoiceDetailDrawer } from "@/components/invoice-detail-drawer"

interface Invoice {
  id: string
  created_at: string
  seen: boolean
  supplier_tin: string | null
  total: number | null
  serial_no: string | null
  issued_at: string | null
  type: string | null
  supplier?: { name: string; tin: string }
}

const INVOICES_PER_PAGE = 20

export default function UncheckedInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [processingInvoices, setProcessingInvoices] = useState<Set<string>>(new Set())
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalInvoices, setTotalInvoices] = useState(0)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchInvoices()
  }, [currentPage])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const { count } = await supabase
        .from("invoice")
        .select("*", { count: "exact", head: true })
        .eq("seen", false)
      setTotalInvoices(count || 0)

      const { data, error } = await supabase
        .from("invoice")
        .select(`
          id, created_at, seen, supplier_tin, total, serial_no, issued_at, type,
          supplier:partner!invoice_supplier_tin_fkey(name, tin)
        `)
        .eq("seen", false)
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * INVOICES_PER_PAGE, currentPage * INVOICES_PER_PAGE - 1)

      if (error) throw error
      setInvoices((data || []) as unknown as Invoice[])
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceClick = (invoice: Invoice) => {
    setSelectedInvoiceId(invoice.id)
    setIsInvoiceDrawerOpen(true)
  }

  const handleMarkInvoiceSeen = async (invoiceId: string) => {
    setProcessingInvoices((prev) => new Set(prev).add(invoiceId))
    try {
      const { error } = await supabase.from("invoice").update({ seen: true }).eq("id", invoiceId)
      if (error) throw error
      setInvoices((prev) => prev.filter((i) => i.id !== invoiceId))
      setTotalInvoices((prev) => prev - 1)
      setIsInvoiceDrawerOpen(false)
      toast({ title: "Հաջողություն", description: "Ապրանքագիրը նշվեց որպես դիտված" })
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setProcessingInvoices((prev) => {
        const n = new Set(prev); n.delete(invoiceId); return n
      })
    }
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("hy-AM", { year: "numeric", month: "short", day: "numeric" })
  const totalPages = Math.ceil(totalInvoices / INVOICES_PER_PAGE)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Չստուգված ապրանքագրեր</h2>
        <p className="text-sm text-muted-foreground">Նոր ստացված, չդիտված ապրանքագրեր</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Ընդամենը {totalInvoices}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Բոլոր ապրանքագրերը ստուգված են</div>
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
                      <TableRow key={invoice.id} className="text-xs cursor-pointer hover:bg-accent" onClick={() => handleInvoiceClick(invoice)}>
                        <TableCell className="font-medium py-2">{invoice.serial_no || invoice.id.substring(0, 8)}</TableCell>
                        <TableCell className="py-2">{formatDate(invoice.issued_at || invoice.created_at)}</TableCell>
                        <TableCell className="py-2">{invoice.supplier?.name || invoice.supplier_tin || "-"}</TableCell>
                        <TableCell className="py-2">
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleMarkInvoiceSeen(invoice.id) }} disabled={isProcessing} className="h-7 text-xs">
                            {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Eye className="h-3 w-3 mr-1" />Դիտված</>}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-muted-foreground">Էջ {currentPage} / {totalPages}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 text-xs">Նախորդ</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-7 text-xs">Հաջորդ</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Check } from "lucide-react"
import { InvoiceDetailDrawer } from "@/components/invoice-detail-drawer"

interface Transfer {
  id: number
  created_at: string
  from: number
  to: number
  invoice_id: string | null
  from_warehouse?: { name: string }
  to_warehouse?: { name: string }
  invoice?: { destination_address: string | null } | null
  transfer_item?: Array<{ qty: number; unit_price: number; unit_vat: number }>
}

interface Warehouse {
  id: number
  name: string
}

const TRANSFERS_PER_PAGE = 20

export default function UncheckedTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [defaultWarehouse, setDefaultWarehouse] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingTransfers, setProcessingTransfers] = useState<Set<number>>(new Set())
  const [selectedWarehouses, setSelectedWarehouses] = useState<Record<number, number>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTransfers, setTotalTransfers] = useState(0)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchDefaultWarehouse()
    fetchWarehouses()
  }, [])

  useEffect(() => {
    if (defaultWarehouse !== null) fetchTransfers()
  }, [currentPage, defaultWarehouse])

  const fetchDefaultWarehouse = async () => {
    const { data } = await supabase.from("settings").select("value").eq("key", "default_transfer_warehouse").single()
    setDefaultWarehouse(data?.value ? Number(data.value) : 114)
  }

  const fetchWarehouses = async () => {
    const { data } = await supabase.from("warehouse").select("id, name, type").neq("type", "supplier").order("name")
    setWarehouses(data || [])
  }

  const fetchTransfers = async () => {
    setLoading(true)
    try {
      const wid = defaultWarehouse || 114
      const { count } = await supabase
        .from("transfer")
        .select("*", { count: "exact", head: true })
        .eq("to", wid)
      setTotalTransfers(count || 0)

      const { data, error } = await supabase
        .from("transfer")
        .select(`
          id, created_at, from, to, invoice_id,
          from_warehouse:warehouse!transfer_from_fkey(name),
          to_warehouse:warehouse!transfer_to_fkey(name),
          invoice:invoice!transfer_invoice_id_fkey(destination_address),
          transfer_item(qty, unit_price, unit_vat)
        `)
        .eq("to", wid)
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * TRANSFERS_PER_PAGE, currentPage * TRANSFERS_PER_PAGE - 1)

      if (error) throw error
      setTransfers((data || []) as unknown as Transfer[])
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTransferWarehouse = async (transferId: number) => {
    setProcessingTransfers((prev) => new Set(prev).add(transferId))
    try {
      const newWarehouseId = selectedWarehouses[transferId] || defaultWarehouse
      if (!newWarehouseId) { toast({ title: "Սխալ", description: "Ընտրեք պահեստ", variant: "destructive" }); return }

      const transfer = transfers.find((t) => t.id === transferId)
      const invoiceId = transfer?.invoice_id

      const { error } = await supabase.from("transfer").update({ to: newWarehouseId }).eq("id", transferId)
      if (error) throw error

      if (invoiceId) {
        await supabase.from("invoice").update({ seen: true }).eq("id", invoiceId)
      }
      setTransfers((prev) => prev.filter((t) => t.id !== transferId))
      setTotalTransfers((prev) => prev - 1)
      toast({ title: "Հաջողություն", description: "Փոխանցումը թարմացվեց" })
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setProcessingTransfers((prev) => {
        const n = new Set(prev); n.delete(transferId); return n
      })
    }
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("hy-AM", { year: "numeric", month: "short", day: "numeric" })
  const totalPages = Math.ceil(totalTransfers / TRANSFERS_PER_PAGE)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Անհայտ փոխանցումներ</h2>
        <p className="text-sm text-muted-foreground">Ապրանքագրերից ստեղծված փոխանցումներ, որոնք պետք է նշանակվեն ճիշտ պահեստ</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Ընդամենը {totalTransfers}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Բոլոր փոխանցումները նշանակված են</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-[12%] py-2">Ա/թ</TableHead>
                    <TableHead className="w-[20%] py-2">Որտեղից</TableHead>
                    <TableHead className="w-[22%] py-2">Հասցե</TableHead>
                    <TableHead className="w-[14%] py-2 text-right">Ընդամենը</TableHead>
                    <TableHead className="w-[24%] py-2">Նոր նշանակում</TableHead>
                    <TableHead className="w-[8%] py-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((transfer) => {
                    const isProcessing = processingTransfers.has(transfer.id)
                    const total = (transfer.transfer_item || []).reduce((s, ti) => s + (ti.qty || 0) * ((ti.unit_price || 0) + (ti.unit_vat || 0)), 0)
                    return (
                      <TableRow key={transfer.id} className="text-xs">
                        <TableCell className="py-2">{formatDate(transfer.created_at)}</TableCell>
                        <TableCell className="py-2">{transfer.from_warehouse?.name || `ID: ${transfer.from}`}</TableCell>
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
                        <TableCell className="py-2 text-right font-medium">{total.toLocaleString()} ֏</TableCell>
                        <TableCell className="py-2">
                          <Select
                            value={selectedWarehouses[transfer.id]?.toString() || defaultWarehouse?.toString() || ""}
                            onValueChange={(value) => setSelectedWarehouses((prev) => ({ ...prev, [transfer.id]: Number(value) }))}
                            disabled={isProcessing}
                          >
                            <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="Ընտրել պահեստ" /></SelectTrigger>
                            <SelectContent>
                              {warehouses.map((w) => (<SelectItem key={w.id} value={w.id.toString()} className="text-xs">{w.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-2">
                          <Button size="sm" onClick={() => handleUpdateTransferWarehouse(transfer.id)} disabled={isProcessing} className="h-7 text-xs">
                            {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Պատրաստ</>}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {transfers.length > 0 && (() => {
                const sumTotal = transfers.reduce((s, t) => s + (t.transfer_item || []).reduce((ss, ti) => ss + (ti.qty || 0) * ((ti.unit_price || 0) + (ti.unit_vat || 0)), 0), 0)
                return (
                  <div className="flex items-center justify-end gap-3 pt-3 mt-2 border-t text-sm">
                    <span className="text-muted-foreground">Ընդամենը այս էջում՝</span>
                    <span className="font-bold">{sumTotal.toLocaleString()} ֏</span>
                  </div>
                )
              })()}
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
        <InvoiceDetailDrawer open={isInvoiceDrawerOpen} onOpenChange={setIsInvoiceDrawerOpen} invoiceId={selectedInvoiceId} />
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { TransferDetailDrawer } from "@/components/transfer-detail-drawer"
import { LabelCell } from "@/components/label-cell"
import { LabelFilter } from "@/components/label-filter"

interface DraftTransfer {
  id: number
  created_at: string
  delivered_at: string | null
  from: number
  to: number
  invoice_id: string | null
  label: number
  from_warehouse?: { name: string }
  to_warehouse?: { name: string }
}

const PAGE_SIZE = 20

export default function DraftTransfersPage() {
  const [draftTransfers, setDraftTransfers] = useState<DraftTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [labelFilter, setLabelFilter] = useState<number | null>(null)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchDraftTransfers()
  }, [currentPage])

  const fetchDraftTransfers = async () => {
    setLoading(true)
    try {
      const { count } = await supabase
        .from("transfer")
        .select("*", { count: "exact", head: true })
        .is("delivered_at", null)
        .is("acepted_at", null)
        .is("rejected_at", null)
      setTotalCount(count || 0)

      const { data, error } = await supabase
        .from("transfer")
        .select(`
          id, created_at, delivered_at, from, to, invoice_id, label,
          from_warehouse:warehouse!transfer_from_fkey(name),
          to_warehouse:warehouse!transfer_to_fkey(name)
        `)
        .is("delivered_at", null)
        .is("acepted_at", null)
        .is("rejected_at", null)
        .order("created_at", { ascending: true })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)

      if (error) throw error
      setDraftTransfers((data || []) as unknown as DraftTransfer[])
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("hy-AM", { year: "numeric", month: "short", day: "numeric" })
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const handleSetLabel = async (transferId: number, label: number) => {
    setDraftTransfers((prev) => prev.map((t) => (t.id === transferId ? { ...t, label } : t)))
    const { error } = await supabase.from("transfer").update({ label }).eq("id", transferId)
    if (error) {
      toast({ title: "Սխալ", description: error.message, variant: "destructive" })
      fetchDraftTransfers()
    }
  }

  const visibleTransfers = labelFilter == null ? draftTransfers : draftTransfers.filter((t) => (t.label ?? 0) === labelFilter)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Սևագիր տեղափոխումներ</h2>
        <p className="text-sm text-muted-foreground">Դեռ չուղարկված տեղափոխումներ</p>
      </div>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Ընդամենը {totalCount}</CardTitle>
          <LabelFilter value={labelFilter} onChange={setLabelFilter} />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : draftTransfers.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Սևագիր տեղափոխումներ չկան</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-[40px] py-2"></TableHead>
                    <TableHead className="w-[10%] py-2">ID</TableHead>
                    <TableHead className="w-[28%] py-2">Սկսած</TableHead>
                    <TableHead className="w-[28%] py-2">Դեպի</TableHead>
                    <TableHead className="w-[28%] py-2">Ստեղծված</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTransfers.map((transfer) => (
                    <TableRow
                      key={transfer.id}
                      className="text-xs cursor-pointer hover:bg-accent"
                      onClick={() => { setSelectedTransferId(transfer.id); setIsDrawerOpen(true) }}
                    >
                      <TableCell className="py-2">
                        <LabelCell value={transfer.label} onChange={(next) => handleSetLabel(transfer.id, next)} />
                      </TableCell>
                      <TableCell className="py-2 font-medium">#{transfer.id}</TableCell>
                      <TableCell className="py-2">{transfer.from_warehouse?.name || `#${transfer.from}`}</TableCell>
                      <TableCell className="py-2">{transfer.to_warehouse?.name || `#${transfer.to}`}</TableCell>
                      <TableCell className="py-2">{formatDate(transfer.created_at)}</TableCell>
                    </TableRow>
                  ))}
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

      {selectedTransferId && (
        <TransferDetailDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} transferId={selectedTransferId} />
      )}
    </div>
  )
}

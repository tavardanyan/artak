"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Package, FileText, Calendar } from "lucide-react"

interface TransferItem {
  id: number
  item_id: number
  qty: number
  unit_price: number
  unit_vat: number
  item?: { name: string; unit: string }
}

interface Transfer {
  id: number
  from: number
  to: number
  created_at: string
  acepted_at: string | null
  delivered_at: string | null
  rejected_at: string | null
  invoice_id: string | null
  from_warehouse?: { name: string; address: string }
  to_warehouse?: { name: string; address: string }
  invoice?: {
    serial_no: string
    supplier_tin: string
    total: number
    created_at: string
    partner?: { name: string }
  }
}

interface TransferDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transferId: number | null
}

export function TransferDetailDrawer({ open, onOpenChange, transferId }: TransferDetailDrawerProps) {
  const [loading, setLoading] = useState(true)
  const [transfer, setTransfer] = useState<Transfer | null>(null)
  const [items, setItems] = useState<TransferItem[]>([])

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open && transferId) {
      fetchTransferData()
    }
  }, [open, transferId])

  const fetchTransferData = async () => {
    if (!transferId) return

    try {
      setLoading(true)

      // Fetch transfer details with invoice if available
      const { data: transferData, error: transferError } = await supabase
        .from("transfer")
        .select(`
          *,
          from_warehouse:warehouse!transfer_from_fkey(name, address),
          to_warehouse:warehouse!transfer_to_fkey(name, address),
          invoice!transfer_invoice_id_fkey(serial_no, supplier_tin, total, created_at, partner!invoice_supplier_tin_fkey(name))
        `)
        .eq("id", transferId)
        .single()

      if (transferError) throw transferError

      setTransfer(transferData)

      // Fetch transfer items
      const { data: itemsData, error: itemsError } = await supabase
        .from("transfer_item")
        .select(`
          *,
          item(name, unit)
        `)
        .eq("transfer_id", transferId)

      if (itemsError) throw itemsError

      setItems(itemsData || [])
    } catch (error) {
      console.error("Error fetching transfer data:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել տեղափոխման տվյալները",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleString("hy-AM", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount) + " ֏"
  }

  const getStatusBadge = (transfer: Transfer) => {
    if (transfer.rejected_at) {
      return <Badge variant="destructive">Մերժված</Badge>
    }
    if (transfer.acepted_at) {
      return <Badge variant="default" className="bg-green-600">Ընդունված</Badge>
    }
    if (transfer.delivered_at) {
      return <Badge variant="secondary">Ուղարկված</Badge>
    }
    return <Badge variant="outline">Սպասման մեջ</Badge>
  }

  const calculateTotal = (item: TransferItem) => {
    return (item.qty * item.unit_price) + (item.qty * item.unit_vat)
  }

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + calculateTotal(item), 0)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[50vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Տեղափոխման մանրամասներ #{transferId}</SheetTitle>
          <SheetDescription>
            {transfer?.from_warehouse?.name || `#${transfer?.from}`} → {transfer?.to_warehouse?.name || `#${transfer?.to}`}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transfer ? (
          <div className="space-y-6 py-6">
            {/* Status and Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
                  Կարգավիճակ և ամսաթվեր
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Վիճակ</span>
                  {getStatusBadge(transfer)}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Ստեղծվել է</p>
                    <p className="font-medium">{formatDate(transfer.created_at)}</p>
                  </div>
                  {transfer.delivered_at && (
                    <div>
                      <p className="text-muted-foreground">Ուղարկված</p>
                      <p className="font-medium">{formatDate(transfer.delivered_at)}</p>
                    </div>
                  )}
                  {transfer.acepted_at && (
                    <div>
                      <p className="text-muted-foreground">Ընդունված</p>
                      <p className="font-medium">{formatDate(transfer.acepted_at)}</p>
                    </div>
                  )}
                  {transfer.rejected_at && (
                    <div>
                      <p className="text-muted-foreground">Մերժված</p>
                      <p className="font-medium">{formatDate(transfer.rejected_at)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Invoice Info */}
            {transfer.invoice_id && transfer.invoice && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Ապրանքագիր
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Համար</span>
                    <span className="font-medium">{(transfer.invoice as any).serial_no || transfer.invoice_id}</span>
                  </div>
                  {transfer.invoice?.partner?.name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Մատակարար</span>
                      <span className="font-medium">{transfer.invoice.partner.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ամսաթիվ</span>
                    <span className="font-medium">{formatDate((transfer.invoice as any).created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transfer Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  Ապրանքներ
                </CardTitle>
                <CardDescription>
                  {items.length} ապրանք
                </CardDescription>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Ապրանքներ չկան</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ապրանք</TableHead>
                          <TableHead className="text-right">Քնկ.</TableHead>
                          <TableHead className="text-right">Գին</TableHead>
                          <TableHead className="text-right">ԱԱՀ</TableHead>
                          <TableHead className="text-right">Ընդամենը</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{(item.item as any)?.name || `#${item.item_id}`}</p>
                                {(item.item as any)?.unit && (
                                  <p className="text-xs text-muted-foreground">{(item.item as any).unit}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{item.qty}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_vat)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(calculateTotal(item))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Total */}
                    <div className="flex justify-between items-center pt-4 border-t">
                      <span className="font-medium">Ընդհանուր</span>
                      <span className="text-lg font-bold">{formatCurrency(calculateGrandTotal())}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            Տեղափոխումը չի գտնվել
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

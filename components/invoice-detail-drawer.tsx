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
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface InvoiceDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
}

interface InvoiceDetail {
  id: string
  serial_no: string | null
  type: string | null
  sort: string | null
  approval_state: string | null
  status: string | null
  correction_state: string | null
  correction_type: string | null
  created_at: string | null
  issued_at: string | null
  approved_at: string | null
  delivered_at: string | null
  dealt_at: string | null
  cancelled_at: string | null
  supplier_tin: string | null
  buyer_tin: string | null
  delivery_address: string | null
  destination_address: string | null
  env_tax: number | null
  total_value: number | null
  total_vat_amount: number | null
  total: number | null
  cancellation_reason: string | null
  canceled_notified: string | null
  ben_canceled_notified: string | null
  ben_issued_notified: string | null
  user_name: string | null
  final_use: boolean | null
  has_codes: boolean | null
  additional_info: string | null
  other_data: string | null
}

interface InvoiceItem {
  id: number
  seq_no: number | null
  name: string | null
  unit: string | null
  quantity: number | null
  unit_price: number | null
  total_value: number | null
  classifier_id: string | null
  deal_type: string | null
  vat_rate: string | null
  vat_amount: number | null
  total: number | null
  inc_env_tax: number | null
  other_data: string | null
}

export function InvoiceDetailDrawer({ open, onOpenChange, invoiceId }: InvoiceDetailDrawerProps) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open && invoiceId) {
      fetchInvoiceDetail()
    }
  }, [open, invoiceId])

  const fetchInvoiceDetail = async () => {
    try {
      setLoading(true)

      // Fetch invoice details
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoice")
        .select("*")
        .eq("id", invoiceId)
        .single()

      if (invoiceError) throw invoiceError

      setInvoice(invoiceData)

      // Fetch invoice items
      const { data: itemsData, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("seq_no", { ascending: true })

      if (itemsError) throw itemsError

      setItems(itemsData || [])
    } catch (error) {
      console.error("Error fetching invoice details:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել հաշիվ-ապրանքագրի տվյալները",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[75vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Հաշիվ-ապրանքագիր</SheetTitle>
          <SheetDescription>
            {invoice?.serial_no || invoiceId}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : invoice ? (
          <div className="space-y-6 py-6">
            {/* Main Info */}
            <Card>
              <CardHeader>
                <CardTitle>Ընդհանուր տեղեկություններ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Համար</p>
                    <p className="text-base mt-1">{invoice.serial_no || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Տեսակ</p>
                    <Badge variant="outline" className="mt-1">{invoice.type || "-"}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ստատուս</p>
                    <Badge
                      variant={invoice.status === "ACTIVE" ? "default" : "secondary"}
                      className="mt-1"
                    >
                      {invoice.status || "-"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Դասակարգում</p>
                    <p className="text-base mt-1">{invoice.sort || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Հաստատման վիճակ</p>
                    <p className="text-base mt-1">{invoice.approval_state || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Օգտատեր</p>
                    <p className="text-base mt-1">{invoice.user_name || "-"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parties */}
            <Card>
              <CardHeader>
                <CardTitle>Կողմեր</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">Մատակարար</h4>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">ՀՎՀՀ</p>
                        <p className="text-base mt-1">{invoice.supplier_tin || "-"}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Ստացող</h4>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">ՀՎՀՀ</p>
                        <p className="text-base mt-1">{invoice.buyer_tin || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial */}
            <Card>
              <CardHeader>
                <CardTitle>Ֆինանսական տվյալներ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Արժեք (առանց ԱԱՀ)</p>
                    <p className="text-lg font-bold mt-1">
                      {invoice.total_value != null ? `${invoice.total_value.toLocaleString()} ֏` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">ԱԱՀ</p>
                    <p className="text-lg font-bold mt-1 text-blue-600">
                      {invoice.total_vat_amount != null ? `${invoice.total_vat_amount.toLocaleString()} ֏` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Շրջակա միջավայրի հարկ</p>
                    <p className="text-lg font-bold mt-1">
                      {invoice.env_tax != null ? `${invoice.env_tax.toLocaleString()} ֏` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ընդհանուր</p>
                    <p className="text-xl font-bold mt-1 text-green-600">
                      {invoice.total != null ? `${invoice.total.toLocaleString()} ֏` : "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle>Ամսաթվեր</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ստեղծման ամսաթիվ</p>
                    <p className="text-base mt-1">{formatDateTime(invoice.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Թողարկման ամսաթիվ</p>
                    <p className="text-base mt-1">{formatDateTime(invoice.issued_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Հաստատման ամսաթիվ</p>
                    <p className="text-base mt-1">{formatDateTime(invoice.approved_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Առաքման ամսաթիվ</p>
                    <p className="text-base mt-1">{formatDateTime(invoice.delivered_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Գործարքի ամսաթիվ</p>
                    <p className="text-base mt-1">{formatDateTime(invoice.dealt_at)}</p>
                  </div>
                  {invoice.cancelled_at && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Չեղարկման ամսաթիվ</p>
                      <p className="text-base mt-1">{formatDateTime(invoice.cancelled_at)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Addresses */}
            {(invoice.delivery_address || invoice.destination_address) && (
              <Card>
                <CardHeader>
                  <CardTitle>Հասցեներ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {invoice.delivery_address && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Առաքման հասցե</p>
                        <p className="text-base mt-1">{invoice.delivery_address}</p>
                      </div>
                    )}
                    {invoice.destination_address && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Նշանակման հասցե</p>
                        <p className="text-base mt-1">{invoice.destination_address}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items */}
            {items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Ապրանքներ և ծառայություններ</CardTitle>
                  <CardDescription>
                    {items.length} տող
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Անվանում</TableHead>
                        <TableHead>Միավոր</TableHead>
                        <TableHead className="text-right">Քանակ</TableHead>
                        <TableHead className="text-right">Միավոր գին</TableHead>
                        <TableHead className="text-right">Արժեք</TableHead>
                        <TableHead className="text-right">ԱԱՀ դրույք</TableHead>
                        <TableHead className="text-right">ԱԱՀ գումար</TableHead>
                        <TableHead className="text-right">Ընդհանուր</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.seq_no || index + 1}</TableCell>
                          <TableCell className="font-medium">{item.name || "-"}</TableCell>
                          <TableCell>{item.unit || "-"}</TableCell>
                          <TableCell className="text-right">
                            {item.quantity != null ? item.quantity.toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.unit_price != null ? `${item.unit_price.toLocaleString()} ֏` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.total_value != null ? `${item.total_value.toLocaleString()} ֏` : "-"}
                          </TableCell>
                          <TableCell className="text-right">{item.vat_rate || "-"}</TableCell>
                          <TableCell className="text-right">
                            {item.vat_amount != null ? `${item.vat_amount.toLocaleString()} ֏` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {item.total != null ? `${item.total.toLocaleString()} ֏` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Additional Info */}
            {(invoice.additional_info || invoice.cancellation_reason) && (
              <Card>
                <CardHeader>
                  <CardTitle>Լրացուցիչ տեղեկություններ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {invoice.additional_info && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Լրացուցիչ տեղեկություններ</p>
                      <p className="text-base mt-1">{invoice.additional_info}</p>
                    </div>
                  )}
                  {invoice.cancellation_reason && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Չեղարկման պատճառ</p>
                      <p className="text-base mt-1">{invoice.cancellation_reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Տվյալները չեն գտնվել
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Calendar, Package } from "lucide-react"

interface TransferItem {
  item_id: number
  qty: number
  unit_price: number
  unit_vat: number
  item?: {
    name: string
    unit: string | null
  }
}

interface Transaction {
  id: number
  from: number
  to: number
  amount: number
  note: string | null
  created_at: string
  accepted_at: string | null
  rejected_at: string | null
  from_account?: { name: string; type: string; currency: string }
  to_account?: { name: string; type: string; currency: string }
  transfer?: {
    id: number
    created_at: string
    delivered_at: string | null
    acepted_at: string | null
    rejected_at: string | null
    from_warehouse?: { name: string }
    to_warehouse?: { name: string }
    transfer_item?: TransferItem[]
    invoice?: {
      id: string
      serial_no: string
      supplier_tin: string
      total: number
      created_at: string
      destination_address: string | null
      partner?: {
        name: string
        tin: string
        address: string | null
      }
    }
  } | null
}

interface TransactionDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: number | null
  accountId?: number
  onUpdate?: () => void
}

export function TransactionDetailDrawer({ open, onOpenChange, transactionId, accountId, onUpdate }: TransactionDetailDrawerProps) {
  const [loading, setLoading] = useState(true)
  const [transaction, setTransaction] = useState<Transaction | null>(null)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open && transactionId) {
      fetchTransactionData()
    }
  }, [open, transactionId])

  const fetchTransactionData = async () => {
    if (!transactionId) return

    try {
      setLoading(true)

      // Fetch transaction details
      const { data: txData, error: txError } = await supabase
        .from("transaction")
        .select(`
          *,
          from_account:account!transaction_from_fkey(name, type, currency),
          to_account:account!transaction_to_fkey(name, type, currency)
        `)
        .eq("id", transactionId)
        .single()

      if (txError) throw txError

      // Fetch transfer information if exists (where transaction_id matches)
      const { data: transferData, error: transferError } = await supabase
        .from("transfer")
        .select(`
          id,
          created_at,
          delivered_at,
          acepted_at,
          rejected_at,
          from_warehouse:warehouse!transfer_from_fkey(name),
          to_warehouse:warehouse!transfer_to_fkey(name),
          transfer_item(
            item_id,
            qty,
            unit_price,
            unit_vat,
            item:item_id(name, unit)
          ),
          invoice:invoice!transfer_invoice_id_fkey(
            id,
            serial_no,
            supplier_tin,
            total,
            created_at,
            destination_address,
            partner:partner!invoice_supplier_tin_fkey(name, tin, address)
          )
        `)
        .eq("transaction_id", transactionId)
        .maybeSingle()

      // Combine transaction with transfer data
      setTransaction({
        ...txData,
        transfer: transferData
      })
    } catch (error) {
      console.error("Error fetching transaction data:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել գործարքի տվյալները",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptTransaction = async () => {
    if (!transaction) return

    try {
      const { error } = await supabase
        .from("transaction")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", transaction.id)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Գործարքը ընդունվեց",
      })

      onOpenChange(false)
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց ընդունել գործարքը",
        variant: "destructive",
      })
    }
  }

  const handleRejectTransaction = async () => {
    if (!transaction) return

    try {
      const { error } = await supabase
        .from("transaction")
        .update({ rejected_at: new Date().toISOString() })
        .eq("id", transaction.id)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Գործարքը մերժվեց",
      })

      onOpenChange(false)
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց մերժել գործարքը",
        variant: "destructive",
      })
    }
  }

  const canModifyTransaction = () => {
    if (!transaction) return false
    return !transaction.accepted_at && !transaction.rejected_at
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

  const formatCurrency = (amount: number, currency: string = "amd") => {
    const symbols: Record<string, string> = {
      amd: "֏",
      usd: "$",
      eur: "€",
      rub: "₽",
    }
    const symbol = symbols[currency.toLowerCase()] || currency.toUpperCase()

    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)

    return `${formatted} ${symbol}`
  }

  const getStatusBadge = (transaction: Transaction) => {
    if (transaction.rejected_at) {
      return <Badge variant="destructive">Մերժված</Badge>
    }
    if (transaction.accepted_at) {
      return <Badge variant="default" className="bg-green-600">Հաստատված</Badge>
    }
    return <Badge variant="secondary">Սպասման մեջ</Badge>
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[50vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Գործարքի մանրամասներ #{transactionId}</SheetTitle>
          <SheetDescription>
            {transaction?.from_account?.name || `#${transaction?.from}`} → {transaction?.to_account?.name || `#${transaction?.to}`}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transaction ? (
          <div className="space-y-6 py-6">
            {/* Amount */}
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Գումար</p>
                  <p className="text-4xl font-bold text-blue-600">
                    {formatCurrency(transaction.amount, transaction.from_account?.currency || "amd")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Transaction Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
                  Մանրամասներ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Վիճակ</span>
                  {getStatusBadge(transaction)}
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Հաշվից</span>
                  <span className="font-medium">{transaction.from_account?.name || `#${transaction.from}`}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Հաշվին</span>
                  <span className="font-medium">{transaction.to_account?.name || `#${transaction.to}`}</span>
                </div>

                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Ստեղծվել է</span>
                  <span className="font-medium">{formatDate(transaction.created_at)}</span>
                </div>

                {transaction.accepted_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Հաստատված</span>
                    <span className="font-medium">{formatDate(transaction.accepted_at)}</span>
                  </div>
                )}

                {transaction.rejected_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Մերժված</span>
                    <span className="font-medium">{formatDate(transaction.rejected_at)}</span>
                  </div>
                )}

                {transaction.note && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Նշում</p>
                    <p className="text-sm">{transaction.note}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transfer Information */}
            {transaction.transfer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4" />
                    Տեղափոխում
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-medium">#{transaction.transfer.id}</span>
                  </div>
                  {transaction.transfer.from_warehouse && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Սկսած պահեստից</span>
                      <span className="font-medium">
                        {transaction.transfer.from_warehouse.name}
                      </span>
                    </div>
                  )}
                  {transaction.transfer.to_warehouse && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Դեպի պահեստ</span>
                      <span className="font-medium">
                        {transaction.transfer.to_warehouse.name}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ստեղծվել է</span>
                    <span className="font-medium">
                      {formatDate(transaction.transfer.created_at)}
                    </span>
                  </div>
                  {transaction.transfer.acepted_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ընդունվել է</span>
                      <span className="font-medium">
                        {formatDate(transaction.transfer.acepted_at)}
                      </span>
                    </div>
                  )}

                  {/* Transfer Items Table */}
                  {transaction.transfer.transfer_item && transaction.transfer.transfer_item.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-3">Ապրանքներ</p>
                      <div className="border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Անվանում</TableHead>
                              <TableHead className="text-right">Քանակ</TableHead>
                              <TableHead className="text-right">Գին</TableHead>
                              <TableHead className="text-right">ԱԱՀ</TableHead>
                              <TableHead className="text-right">Ընդամենը</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transaction.transfer.transfer_item.map((item, index) => {
                              const itemTotal = (item.qty * item.unit_price) + (item.qty * item.unit_vat)
                              return (
                                <TableRow key={index}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{item.item?.name || `Item #${item.item_id}`}</p>
                                      {item.item?.unit && (
                                        <p className="text-xs text-muted-foreground">{item.item.unit}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">{item.qty}</TableCell>
                                  <TableCell className="text-right">{item.unit_price.toLocaleString()} ֏</TableCell>
                                  <TableCell className="text-right">{item.unit_vat.toLocaleString()} ֏</TableCell>
                                  <TableCell className="text-right font-medium">{itemTotal.toLocaleString()} ֏</TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t">
                        <span className="text-sm font-medium">Ընդամենը</span>
                        <span className="text-lg font-bold">
                          {transaction.transfer.transfer_item.reduce((sum, item) => {
                            return sum + (item.qty * item.unit_price) + (item.qty * item.unit_vat)
                          }, 0).toLocaleString()} ֏
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Invoice Information */}
                  {transaction.transfer.invoice && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <p className="text-sm font-medium">Ապրանքագիր</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Համար</span>
                        <span className="font-medium">
                          {transaction.transfer.invoice.serial_no}
                        </span>
                      </div>
                      {transaction.transfer.invoice.partner && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Մատակարար</span>
                            <span className="font-medium">
                              {transaction.transfer.invoice.partner.name}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">ՀՎՀՀ</span>
                            <span className="font-medium font-mono">
                              {transaction.transfer.invoice.partner.tin}
                            </span>
                          </div>
                          {transaction.transfer.invoice.partner.address && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Մատակարարի հասցե</span>
                              <span className="font-medium">
                                {transaction.transfer.invoice.partner.address}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {transaction.transfer.invoice.destination_address && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Նշանակման հասցե</span>
                          <span className="font-medium">
                            {transaction.transfer.invoice.destination_address}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">Ընդամենը</span>
                        <span className="font-bold">
                          {transaction.transfer.invoice.total.toLocaleString()} ֏
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            {canModifyTransaction() && (
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleAcceptTransaction}
                >
                  Ընդունել
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleRejectTransaction}
                >
                  Մերժել
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            Գործարքը չի գտնվել
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

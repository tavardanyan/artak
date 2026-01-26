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
import { useToast } from "@/hooks/use-toast"
import { Loader2, CreditCard, Calendar, ArrowRightLeft } from "lucide-react"

interface Transaction {
  id: number
  from: number
  to: number
  amount: number
  created_at: string
  accepted_at: string | null
  rejected_at: string | null
  from_account?: { name: string; type: string; currency: string }
  to_account?: { name: string; type: string; currency: string }
}

interface TransactionDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: number | null
}

export function TransactionDetailDrawer({ open, onOpenChange, transactionId }: TransactionDetailDrawerProps) {
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
      const { data, error } = await supabase
        .from("transaction")
        .select(`
          *,
          from_account:account!transaction_from_fkey(name, type, currency),
          to_account:account!transaction_to_fkey(name, type, currency)
        `)
        .eq("id", transactionId)
        .single()

      if (error) throw error

      setTransaction(data)
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

  const getAccountTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      bank: "Բանկ",
      cash: "Կանխիկ",
      card: "Քարտ",
      other: "Այլ",
    }
    return types[type] || type
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[500px] overflow-y-auto">
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
                  {getStatusBadge(transaction)}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Ստեղծվել է</p>
                    <p className="font-medium">{formatDate(transaction.created_at)}</p>
                  </div>
                  {transaction.accepted_at && (
                    <div>
                      <p className="text-muted-foreground">Հաստատված</p>
                      <p className="font-medium">{formatDate(transaction.accepted_at)}</p>
                    </div>
                  )}
                  {transaction.rejected_at && (
                    <div>
                      <p className="text-muted-foreground">Մերժված</p>
                      <p className="font-medium">{formatDate(transaction.rejected_at)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* From Account */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowRightLeft className="h-4 w-4" />
                  Հաշվից
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Անվանում</span>
                  <span className="font-medium">{transaction.from_account?.name || `#${transaction.from}`}</span>
                </div>
                {transaction.from_account?.type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Տեսակ</span>
                    <span className="font-medium">{getAccountTypeLabel(transaction.from_account.type)}</span>
                  </div>
                )}
                {transaction.from_account?.currency && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Արժույթ</span>
                    <span className="font-medium">{transaction.from_account.currency.toUpperCase()}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* To Account */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4" />
                  Հաշվին
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Անվանում</span>
                  <span className="font-medium">{transaction.to_account?.name || `#${transaction.to}`}</span>
                </div>
                {transaction.to_account?.type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Տեսակ</span>
                    <span className="font-medium">{getAccountTypeLabel(transaction.to_account.type)}</span>
                  </div>
                )}
                {transaction.to_account?.currency && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Արժույթ</span>
                    <span className="font-medium">{transaction.to_account.currency.toUpperCase()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
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

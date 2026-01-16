"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { handleNumberInput, parseFormattedNumber } from "@/lib/utils/number-format"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Transaction {
  id: number
  from: number
  to: number
  amount: number
  note: string | null
  created_at: string
  accepted_at: string | null
  rejected_at: string | null
  from_account?: { name: string }
  to_account?: { name: string }
}

interface AccountBalance {
  account_id: number
  name: string
  currency: string
  balance: number
}

interface Account {
  id: number
  name: string
  currency: string
}

interface FinanceContentProps {
  accountId: number
  accountName: string
  accountCurrency: string
}

export function FinanceContent({ accountId, accountName, accountCurrency }: FinanceContentProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [isCreateTransactionDrawerOpen, setIsCreateTransactionDrawerOpen] = useState(false)
  const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])

  // Create transaction state
  const [transactionType, setTransactionType] = useState<"incoming" | "outgoing">("outgoing")
  const [otherAccount, setOtherAccount] = useState<number | null>(null)
  const [amount, setAmount] = useState<string>("")
  const [note, setNote] = useState<string>("")

  const { toast } = useToast()
  const supabase = createClient()

  // Fetch account balance
  const fetchBalance = async () => {
    try {
      const { data, error } = await supabase
        .from("account_balance")
        .select("*")
        .eq("account_id", accountId)
        .single()

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching balance:", error)
        return
      }

      setBalance(data?.balance || 0)
    } catch (error) {
      console.error("Error:", error)
    }
  }

  // Fetch transactions for this account
  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("transaction")
        .select(`
          *,
          from_account:from(name),
          to_account:to(name)
        `)
        .or(`from.eq.${accountId},to.eq.${accountId}`)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching transactions:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց բեռնել գործարքները",
          variant: "destructive",
        })
        return
      }

      setTransactions(data || [])
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch accounts list
  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("account")
        .select("id, name, currency")
        .order("name")

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error("Error fetching accounts:", error)
    }
  }

  // Create transaction
  const handleCreateTransaction = async () => {
    if (!otherAccount) {
      toast({
        title: "Սխալ",
        description: "Ընտրեք հաշիվը",
        variant: "destructive",
      })
      return
    }

    const amountNum = parseFormattedNumber(amount)
    if (amountNum <= 0) {
      toast({
        title: "Սխալ",
        description: "Գումարը պետք է լինի 0-ից մեծ",
        variant: "destructive",
      })
      return
    }

    try {
      const transactionData = {
        from: transactionType === "outgoing" ? accountId : otherAccount,
        to: transactionType === "outgoing" ? otherAccount : accountId,
        amount: amountNum,
        note: note || null,
      }

      const { error } = await supabase
        .from("transaction")
        .insert([transactionData])

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Գործարքը հաջողությամբ ստեղծվեց",
      })

      // Reset form
      setTransactionType("outgoing")
      setOtherAccount(null)
      setAmount("")
      setNote("")
      setIsCreateTransactionDrawerOpen(false)

      // Refresh transactions and balance
      fetchTransactions()
      fetchBalance()
    } catch (error) {
      console.error("Error creating transaction:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց ստեղծել գործարքը",
        variant: "destructive",
      })
    }
  }

  // Handle transaction row click
  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsTransactionDrawerOpen(true)
  }

  // Accept transaction
  const handleAcceptTransaction = async (transactionId: number) => {
    try {
      const { error } = await supabase
        .from("transaction")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", transactionId)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Գործարքը ընդունվեց",
      })

      setIsTransactionDrawerOpen(false)
      fetchTransactions()
      fetchBalance()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց ընդունել գործարքը",
        variant: "destructive",
      })
    }
  }

  // Reject transaction
  const handleRejectTransaction = async (transactionId: number) => {
    try {
      const { error } = await supabase
        .from("transaction")
        .update({ rejected_at: new Date().toISOString() })
        .eq("id", transactionId)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Գործարքը մերժվեց",
      })

      setIsTransactionDrawerOpen(false)
      fetchTransactions()
      fetchBalance()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց մերժել գործարքը",
        variant: "destructive",
      })
    }
  }

  const canModifyTransaction = (transaction: Transaction | null) => {
    if (!transaction) return false
    return !transaction.accepted_at && !transaction.rejected_at
  }

  useEffect(() => {
    fetchTransactions()
    fetchBalance()
    fetchAccounts()
  }, [accountId])

  const getTransactionStatus = (transaction: Transaction) => {
    if (transaction.rejected_at) {
      return <Badge variant="destructive">Մերժված</Badge>
    }
    if (transaction.accepted_at) {
      return <Badge variant="outline">Ընդունված</Badge>
    }
    return <Badge variant="default">Սևագիր</Badge>
  }

  const getTransactionType = (transaction: Transaction) => {
    if (transaction.from === accountId) {
      return {
        type: "outgoing",
        icon: <ArrowUpRight className="h-4 w-4 text-red-500" />,
        label: "Ելք",
        account: transaction.to_account?.name || `#${transaction.to}`,
        amount: -transaction.amount,
        color: "text-red-600",
      }
    } else {
      return {
        type: "incoming",
        icon: <ArrowDownLeft className="h-4 w-4 text-green-500" />,
        label: "Մուտք",
        account: transaction.from_account?.name || `#${transaction.from}`,
        amount: transaction.amount,
        color: "text-green-600",
      }
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("hy-AM", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      amd: "֏",
      usd: "$",
      eur: "€",
      rub: "₽",
    }
    return symbols[currency.toLowerCase()] || currency.toUpperCase()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Մնացորդ</p>
            <p className="text-3xl font-bold">
              {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {getCurrencySymbol(accountCurrency)}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateTransactionDrawerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ստեղծել գործարք
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Գործարքներ</CardTitle>
          <CardDescription>
            Բոլոր գործարքները այս հաշվից և դեպի այս հաշիվ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <p className="text-muted-foreground">Բեռնում...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
              <p className="text-muted-foreground">Գործարքներ չկան</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Տեսակ</TableHead>
                  <TableHead>Հաշիվ</TableHead>
                  <TableHead className="text-right">Գումար</TableHead>
                  <TableHead>Ստեղծվել է</TableHead>
                  <TableHead>Ընդունվել է</TableHead>
                  <TableHead>Վիճակ</TableHead>
                  <TableHead>Նշում</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => {
                  const txType = getTransactionType(transaction)
                  return (
                    <TableRow
                      key={transaction.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => handleTransactionClick(transaction)}
                    >
                      <TableCell className="font-medium">#{transaction.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {txType.icon}
                          <span className="text-sm">{txType.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>{txType.account}</TableCell>
                      <TableCell className={`text-right font-semibold ${txType.color}`}>
                        {txType.amount > 0 ? "+" : ""}{txType.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {getCurrencySymbol(accountCurrency)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(transaction.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(transaction.accepted_at)}
                      </TableCell>
                      <TableCell>{getTransactionStatus(transaction)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {transaction.note || "-"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Transaction Drawer */}
      <Sheet open={isCreateTransactionDrawerOpen} onOpenChange={setIsCreateTransactionDrawerOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Ստեղծել նոր գործարք</SheetTitle>
            <SheetDescription>
              Լրացրեք գործարքի տվյալները
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            {/* Transaction Type */}
            <div className="space-y-2">
              <Label>Տեսակ</Label>
              <Select
                value={transactionType}
                onValueChange={(value: "incoming" | "outgoing") => setTransactionType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outgoing">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-red-500" />
                      <span>Ելք</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="incoming">
                    <div className="flex items-center gap-2">
                      <ArrowDownLeft className="h-4 w-4 text-green-500" />
                      <span>Մուտք</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Other Account */}
            <div className="space-y-2">
              <Label>
                {transactionType === "outgoing" ? "Դեպի հաշիվ" : "Սկսած հաշվից"}
              </Label>
              <Select
                value={otherAccount?.toString() || ""}
                onValueChange={(value) => setOtherAccount(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ընտրեք հաշիվը" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter(acc => acc.id !== accountId)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name} ({getCurrencySymbol(account.currency)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Գումար ({getCurrencySymbol(accountCurrency)})</Label>
              <Input
                id="amount"
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(handleNumberInput(e.target.value))}
              />
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Նշում (ընտրովի)</Label>
              <Textarea
                id="note"
                placeholder="Գործարքի նշումը..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>

            {/* Summary */}
            {parseFormattedNumber(amount) > 0 && otherAccount && (
              <div className="p-4 bg-accent rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Ամփոփում</p>
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {transactionType === "outgoing"
                      ? `${accountName} → ${accounts.find(a => a.id === otherAccount)?.name}`
                      : `${accounts.find(a => a.id === otherAccount)?.name} → ${accountName}`
                    }
                  </span>
                </div>
                <p className={`text-2xl font-bold ${transactionType === "outgoing" ? "text-red-600" : "text-green-600"}`}>
                  {transactionType === "outgoing" ? "-" : "+"}
                  {parseFormattedNumber(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {getCurrencySymbol(accountCurrency)}
                </p>
              </div>
            )}
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateTransactionDrawerOpen(false)}
            >
              Չեղարկել
            </Button>
            <Button onClick={handleCreateTransaction}>Ստեղծել գործարք</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Transaction Details Drawer */}
      <Sheet open={isTransactionDrawerOpen} onOpenChange={setIsTransactionDrawerOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Գործարքի մանրամասներ #{selectedTransaction?.id}</SheetTitle>
            <SheetDescription>
              {selectedTransaction && (
                <>
                  {getTransactionType(selectedTransaction).type === "outgoing"
                    ? `${selectedTransaction.from_account?.name || `#${selectedTransaction.from}`} → ${selectedTransaction.to_account?.name || `#${selectedTransaction.to}`}`
                    : `${selectedTransaction.from_account?.name || `#${selectedTransaction.from}`} → ${selectedTransaction.to_account?.name || `#${selectedTransaction.to}`}`
                  }
                </>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            {/* Status and Dates */}
            <div className="flex flex-col gap-4 pb-4 border-b">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Ստեղծվել է</p>
                  <p className="font-medium">{formatDate(selectedTransaction?.created_at || null)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ընդունվել է</p>
                  <p className="font-medium">{formatDate(selectedTransaction?.accepted_at || null)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Մերժվել է</p>
                  <p className="font-medium">{formatDate(selectedTransaction?.rejected_at || null)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Վիճակ</p>
                  <div className="mt-1">{selectedTransaction && getTransactionStatus(selectedTransaction)}</div>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="space-y-4 pb-4 border-b">
              <div>
                <p className="text-sm text-muted-foreground">Տեսակ</p>
                <div className="flex items-center gap-2 mt-1">
                  {selectedTransaction && getTransactionType(selectedTransaction).icon}
                  <span className="font-medium">{selectedTransaction && getTransactionType(selectedTransaction).label}</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Գումար</p>
                <p className={`text-2xl font-bold mt-1 ${selectedTransaction && getTransactionType(selectedTransaction).color}`}>
                  {selectedTransaction && (
                    <>
                      {getTransactionType(selectedTransaction).amount > 0 ? "+" : ""}
                      {getTransactionType(selectedTransaction).amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {getCurrencySymbol(accountCurrency)}
                    </>
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Հաշիվ</p>
                <p className="font-medium mt-1">{selectedTransaction && getTransactionType(selectedTransaction).account}</p>
              </div>

              {selectedTransaction?.note && (
                <div>
                  <p className="text-sm text-muted-foreground">Նշում</p>
                  <p className="mt-1">{selectedTransaction.note}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {canModifyTransaction(selectedTransaction) && (
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => selectedTransaction && handleAcceptTransaction(selectedTransaction.id)}
                >
                  Ընդունել
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => selectedTransaction && handleRejectTransaction(selectedTransaction.id)}
                >
                  Մերժել
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

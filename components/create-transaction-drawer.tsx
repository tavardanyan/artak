"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { ArrowDownLeft, ArrowUpRight } from "lucide-react"

interface Account {
  id: number
  name: string
  currency: string
}

interface CreateTransactionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateTransactionDrawer({ open, onOpenChange, onSuccess }: CreateTransactionDrawerProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactionType, setTransactionType] = useState<"incoming" | "outgoing">("outgoing")
  const [fromAccount, setFromAccount] = useState<string>("")
  const [toAccount, setToAccount] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchAccounts()
      resetForm()
    }
  }, [open])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("account")
        .select("id, name, currency")
        .order("name")

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error("Error fetching accounts:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել հաշիվների ցանկը",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTransactionType("outgoing")
    setFromAccount("")
    setToAccount("")
    setAmount("")
    setNote("")
  }

  const handleSubmit = async () => {
    if (!fromAccount || !toAccount || !amount) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել բոլոր դաշտերը",
        variant: "destructive",
      })
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Սխալ",
        description: "Գումարը պետք է լինի դրական թիվ",
        variant: "destructive",
      })
      return
    }

    if (fromAccount === toAccount) {
      toast({
        title: "Սխալ",
        description: "Հաշիվները չեն կարող նույնը լինել",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)
      const { error } = await supabase
        .from("transaction")
        .insert({
          from: parseInt(fromAccount),
          to: parseInt(toAccount),
          amount: amountNum,
          note: note || null,
        })

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Գործարքը հաջողությամբ ստեղծվեց",
      })

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error("Error creating transaction:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց ստեղծել գործարքը",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
              onValueChange={(value: "incoming" | "outgoing") => {
                setTransactionType(value)
                setFromAccount("")
                setToAccount("")
              }}
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

          {/* From Account */}
          <div className="space-y-2">
            <Label>Ից</Label>
            <Select value={fromAccount} onValueChange={setFromAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Ընտրեք հաշիվը" />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="loading" disabled>Բեռնում...</SelectItem>
                ) : accounts.length === 0 ? (
                  <SelectItem value="empty" disabled>Հաշիվներ չկան</SelectItem>
                ) : (
                  accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name} ({account.currency.toUpperCase()})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* To Account */}
          <div className="space-y-2">
            <Label>Դեպի</Label>
            <Select value={toAccount} onValueChange={setToAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Ընտրեք հաշիվը" />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="loading" disabled>Բեռնում...</SelectItem>
                ) : accounts.length === 0 ? (
                  <SelectItem value="empty" disabled>Հաշիվներ չկան</SelectItem>
                ) : (
                  accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name} ({account.currency.toUpperCase()})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Գումար</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>Նշում (ոչ պարտադիր)</Label>
            <Textarea
              placeholder="Նշում..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <SheetFooter>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || loading}
          >
            {submitting ? "Ստեղծվում է..." : "Ստեղծել գործարք"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

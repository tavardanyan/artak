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

interface Contract {
  id: number
  description: string
  person_id: number
  status: string
  total: number
}

interface Person {
  id: number
  account_id: number
}

interface CreateTransactionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateTransactionDrawer({ open, onOpenChange, onSuccess }: CreateTransactionDrawerProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [transactionType, setTransactionType] = useState<"incoming" | "outgoing">("outgoing")
  const [fromAccount, setFromAccount] = useState<string>("")
  const [toAccount, setToAccount] = useState<string>("")
  const [selectedContract, setSelectedContract] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showContractSelect, setShowContractSelect] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchAccounts()
      fetchPersons()
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

  const fetchPersons = async () => {
    try {
      const { data, error } = await supabase
        .from("person")
        .select("id, account_id")
        .not("account_id", "is", null)

      if (error) throw error
      setPersons(data || [])
    } catch (error) {
      console.error("Error fetching persons:", error)
    }
  }

  const fetchContracts = async (personId: number) => {
    try {
      const { data, error } = await supabase
        .from("contract")
        .select("id, description, person_id, status, total")
        .eq("person_id", personId)
        .eq("status", "in progress")
        .order("created_at", { ascending: false })

      if (error) throw error
      setContracts(data || [])
    } catch (error) {
      console.error("Error fetching contracts:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել պայմանագրերի ցանկը",
        variant: "destructive",
      })
    }
  }

  // Check if selected to-account has an associated person and fetch contracts
  useEffect(() => {
    if (toAccount) {
      // Find person who has this account_id
      const person = persons.find(p => p.account_id.toString() === toAccount)
      if (person) {
        setShowContractSelect(true)
        fetchContracts(person.id)
      } else {
        setShowContractSelect(false)
        setContracts([])
        setSelectedContract("")
      }
    } else {
      setShowContractSelect(false)
      setContracts([])
      setSelectedContract("")
    }
  }, [toAccount, persons])

  const resetForm = () => {
    setTransactionType("outgoing")
    setFromAccount("")
    setToAccount("")
    setSelectedContract("")
    setAmount("")
    setNote("")
    setShowContractSelect(false)
    setContracts([])
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

      // Create transaction
      const { data: transactionData, error: transactionError } = await supabase
        .from("transaction")
        .insert({
          from: parseInt(fromAccount),
          to: parseInt(toAccount),
          amount: amountNum,
          note: note || null,
        })
        .select()
        .single()

      if (transactionError) throw transactionError

      // If contract is selected, create contract_transaction record
      if (selectedContract && showContractSelect) {
        const { error: contractTransactionError } = await supabase
          .from("contract_transaction")
          .insert({
            contact_id: parseInt(selectedContract),
            transaction_id: transactionData.id,
          })

        if (contractTransactionError) throw contractTransactionError
      }

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

          {/* Contract Selection - shown only if to-account has person_id */}
          {showContractSelect && (
            <div className="space-y-2">
              <Label>Պայմանագիր (ոչ պարտադիր)</Label>
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger>
                  <SelectValue placeholder="Ընտրեք պայմանագիրը" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      Ընթացքի մեջ պայմանագրեր չկան
                    </SelectItem>
                  ) : (
                    contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id.toString()}>
                        {contract.description.substring(0, 50)}
                        {contract.description.length > 50 ? "..." : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {contracts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Միայն "Ընթացքի մեջ" վիճակով պայմանագրերը
                </p>
              )}
            </div>
          )}

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

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { handleNumberInput, parseFormattedNumber } from "@/lib/utils/number-format"
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
import { ArrowDownLeft, ArrowUpRight, ChevronsUpDown, Check, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface Account {
  id: number
  name: string
  currency: string
  internal: boolean
}

interface Contract {
  id: number
  description: string
  person_id: number
  status: string
  total: number
  project_id: number
  price: number | null
  qty: number | null
  unit: string | null
  start: string | null
  end: string | null
}

interface Person {
  id: number
  account_id: number
}

interface Project {
  id: number
  name: string
  code: string
}

interface CreateTransactionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (transactionId?: number) => void
}

export function CreateTransactionDrawer({ open, onOpenChange, onSuccess }: CreateTransactionDrawerProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [transactionType, setTransactionType] = useState<"incoming" | "outgoing">("outgoing")
  const [fromAccount, setFromAccount] = useState<string>("")
  const [toAccount, setToAccount] = useState<string>("")
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [selectedContract, setSelectedContract] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [createdAt, setCreatedAt] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showContractSelect, setShowContractSelect] = useState(false)
  const [fromAccountTab, setFromAccountTab] = useState<"all" | "internal" | "external" | "persons">("all")
  const [toAccountTab, setToAccountTab] = useState<"all" | "internal" | "external" | "persons">("all")
  const [fromSearch, setFromSearch] = useState("")
  const [toSearch, setToSearch] = useState("")
  const [fromAccountBalance, setFromAccountBalance] = useState<number | null>(null)
  const [toAccountBalance, setToAccountBalance] = useState<number | null>(null)
  const [contractTransactionsTotal, setContractTransactionsTotal] = useState<number>(0)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchAccounts()
      fetchPersons()
      fetchProjects()
      resetForm()
    }
  }, [open])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("account")
        .select("id, name, currency, internal")
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

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("project")
        .select("id, name, code")
        .order("name")

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error("Error fetching projects:", error)
    }
  }

  const fetchContracts = async (personId: number, projectId?: number) => {
    try {
      let query = supabase
        .from("contract")
        .select("id, description, person_id, status, total, project_id, price, qty, unit, start, end")
        .eq("person_id", personId)
        .eq("status", "in progress")

      // Filter by project if selected
      if (projectId) {
        query = query.eq("project_id", projectId)
      }

      const { data, error } = await query.order("created_at", { ascending: false })

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

  const fetchFromAccountBalance = async (accountId: number) => {
    try {
      const { data, error } = await supabase
        .from("account_balance")
        .select("balance")
        .eq("account_id", accountId)
        .single()

      if (error) {
        console.error("Error fetching from balance:", error)
        setFromAccountBalance(null)
        return
      }

      setFromAccountBalance(data?.balance || 0)
    } catch (error) {
      console.error("Error:", error)
      setFromAccountBalance(null)
    }
  }

  const fetchToAccountBalance = async (accountId: number) => {
    try {
      const { data, error } = await supabase
        .from("account_balance")
        .select("balance")
        .eq("account_id", accountId)
        .single()

      if (error) {
        console.error("Error fetching to balance:", error)
        setToAccountBalance(null)
        return
      }

      setToAccountBalance(data?.balance || 0)
    } catch (error) {
      console.error("Error:", error)
      setToAccountBalance(null)
    }
  }

  const fetchContractTransactions = async (contractId: number) => {
    try {
      // Contracts are linked via contract_transaction table
      const { data, error } = await supabase
        .from("contract_transaction")
        .select("transaction:transaction_id(amount, accepted_at, rejected_at)")
        .eq("contact_id", contractId)

      if (error) {
        console.error("Error fetching contract transactions:", error)
        setContractTransactionsTotal(0)
        return
      }

      const total = (data || []).reduce((sum: number, ct: any) => {
        const t = ct.transaction
        if (!t || !t.accepted_at || t.rejected_at) return sum
        return sum + (t.amount || 0)
      }, 0)
      setContractTransactionsTotal(total)
    } catch (error) {
      console.error("Error:", error)
      setContractTransactionsTotal(0)
    }
  }

  // Fetch from-account balance when it changes
  useEffect(() => {
    if (fromAccount) {
      fetchFromAccountBalance(parseInt(fromAccount))
    } else {
      setFromAccountBalance(null)
    }
  }, [fromAccount])

  // Check if selected to-account has an associated person and fetch contracts
  useEffect(() => {
    if (toAccount) {
      // Find person who has this account_id
      const person = persons.find(p => p.account_id.toString() === toAccount)
      if (person) {
        setShowContractSelect(true)
        const projectId = selectedProject && selectedProject !== "none" ? parseInt(selectedProject) : undefined
        fetchContracts(person.id, projectId)
        fetchToAccountBalance(parseInt(toAccount))
      } else {
        setShowContractSelect(false)
        setContracts([])
        setSelectedContract("")
        setToAccountBalance(null)
      }
    } else {
      setShowContractSelect(false)
      setContracts([])
      setSelectedContract("")
      setToAccountBalance(null)
    }
  }, [toAccount, persons, selectedProject])

  // Fetch contract transactions when contract is selected
  useEffect(() => {
    if (selectedContract && selectedContract !== "none") {
      fetchContractTransactions(parseInt(selectedContract))
    } else {
      setContractTransactionsTotal(0)
    }
  }, [selectedContract])

  const resetForm = () => {
    setTransactionType("outgoing")
    setFromAccount("")
    setToAccount("")
    setSelectedProject("")
    setSelectedContract("")
    setAmount("")
    setNote("")
    setCreatedAt("")
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

    if (!selectedProject) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք ընտրել նախագիծը կամ \"Առանց նախագծի\"",
        variant: "destructive",
      })
      return
    }

    if (showContractSelect && !selectedContract) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք ընտրել պայմանագիրը կամ \"Առանց պայմանագրի\"",
        variant: "destructive",
      })
      return
    }

    const amountNum = parseFormattedNumber(amount)
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
      const transactionPayload: any = {
        from: parseInt(fromAccount),
        to: parseInt(toAccount),
        amount: amountNum,
        note: note || null,
        project_id: selectedProject === "none" ? null : parseInt(selectedProject),
      }

      // A contract-linked payment always belongs to the contract's project,
      // otherwise project expense and contract totals drift apart
      if (selectedContract && selectedContract !== "none" && showContractSelect) {
        const linkedContract = contracts.find(c => c.id.toString() === selectedContract)
        if (linkedContract?.project_id) {
          transactionPayload.project_id = linkedContract.project_id
        }
      }

      // Add custom created_at if specified
      if (createdAt) {
        transactionPayload.created_at = new Date(createdAt).toISOString()
      }

      const { data: transactionData, error: transactionError } = await supabase
        .from("transaction")
        .insert(transactionPayload)
        .select()
        .single()

      if (transactionError) throw transactionError

      // If contract is selected, create contract_transaction record
      if (selectedContract && selectedContract !== "none" && showContractSelect) {
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
      if (onSuccess) onSuccess(transactionData.id)
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

  const selectedContractData = contracts.find(c => c.id.toString() === selectedContract)
  const amountNum = parseFormattedNumber(amount)
  const projectedToBalance = toAccountBalance != null ? toAccountBalance + amountNum : null
  const projectedFromBalance = fromAccountBalance != null ? fromAccountBalance - amountNum : null
  const projectedContractBalance = selectedContractData
    ? selectedContractData.total - (contractTransactionsTotal + amountNum)
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[65vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Ստեղծել նոր գործարք</SheetTitle>
          <SheetDescription>
            Լրացրեք գործարքի տվյալները
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Basic Info Section */}
          <div className="grid grid-cols-2 gap-4">
            {/* Transaction Type - locked to outgoing */}
            <div className="space-y-2">
              <Label>Տեսակ</Label>
              <Select value="outgoing" disabled>
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
                </SelectContent>
              </Select>
            </div>

            {/* Project Selection */}
            <div className="space-y-2">
              <Label>Նախագիծ <span className="text-destructive">*</span></Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Ընտրեք նախագիծը" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Առանց նախագծի</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name} ({project.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Account Section */}
          {(() => {
            const personAccountIds = new Set(persons.map(p => p.account_id))
            const filterAccount = (a: typeof accounts[0], tab: "all" | "internal" | "external" | "persons", search: string) => {
              if (tab === "internal" && !a.internal) return false
              if (tab === "external" && a.internal) return false
              if (tab === "persons" && !personAccountIds.has(a.id)) return false
              if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
              return true
            }
            return (
              <div className="grid grid-cols-2 gap-4">
                {/* From Account */}
                <div className="space-y-2">
                  <Label>Ից</Label>
                  <Tabs value={fromAccountTab} onValueChange={(v) => setFromAccountTab(v as any)} className="w-full">
                    <TabsList className="w-full h-8">
                      <TabsTrigger value="all" className="text-xs flex-1">Բոլորը</TabsTrigger>
                      <TabsTrigger value="internal" className="text-xs flex-1">Ներքին</TabsTrigger>
                      <TabsTrigger value="external" className="text-xs flex-1">Արտաքին</TabsTrigger>
                      <TabsTrigger value="persons" className="text-xs flex-1">Անձինք</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Որոնել հաշիվ..." value={fromSearch} onChange={(e) => setFromSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                  </div>
                  <div className="border rounded-md overflow-y-auto h-[240px]">
                    {accounts.filter(a => filterAccount(a, fromAccountTab, fromSearch)).length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-6">Հաշիվ չի գտնվել</div>
                    ) : (
                      <div className="divide-y">
                        {accounts.filter(a => filterAccount(a, fromAccountTab, fromSearch)).map((account) => (
                          <div
                            key={account.id}
                            onClick={() => setFromAccount(account.id.toString())}
                            className={cn("flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 text-sm", fromAccount === account.id.toString() && "bg-accent")}
                          >
                            <Check className={cn("h-4 w-4 shrink-0", fromAccount === account.id.toString() ? "opacity-100" : "opacity-0")} />
                            <span className="truncate flex-1">{account.name}</span>
                            <span className="text-xs text-muted-foreground">{account.currency.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* To Account */}
                <div className="space-y-2">
                  <Label>Դեպի</Label>
                  <Tabs value={toAccountTab} onValueChange={(v) => setToAccountTab(v as any)} className="w-full">
                    <TabsList className="w-full h-8">
                      <TabsTrigger value="all" className="text-xs flex-1">Բոլորը</TabsTrigger>
                      <TabsTrigger value="internal" className="text-xs flex-1">Ներքին</TabsTrigger>
                      <TabsTrigger value="external" className="text-xs flex-1">Արտաքին</TabsTrigger>
                      <TabsTrigger value="persons" className="text-xs flex-1">Անձինք</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Որոնել հաշիվ..." value={toSearch} onChange={(e) => setToSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                  </div>
                  <div className="border rounded-md overflow-y-auto h-[240px]">
                    {accounts.filter(a => filterAccount(a, toAccountTab, toSearch)).length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-6">Հաշիվ չի գտնվել</div>
                    ) : (
                      <div className="divide-y">
                        {accounts.filter(a => filterAccount(a, toAccountTab, toSearch)).map((account) => (
                          <div
                            key={account.id}
                            onClick={() => setToAccount(account.id.toString())}
                            className={cn("flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 text-sm", toAccount === account.id.toString() && "bg-accent")}
                          >
                            <Check className={cn("h-4 w-4 shrink-0", toAccount === account.id.toString() ? "opacity-100" : "opacity-0")} />
                            <span className="truncate flex-1">{account.name}</span>
                            <span className="text-xs text-muted-foreground">{account.currency.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Account Balances - shown when accounts are selected */}
          {(fromAccount || toAccount) && (fromAccountBalance != null || toAccountBalance != null) && (
            <div className="grid grid-cols-2 gap-4">
              {fromAccount && fromAccountBalance != null && (
                <div className="p-4 bg-accent rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Ից հաշվի մնացորդ</p>
                  <p className="text-2xl font-bold">{fromAccountBalance.toLocaleString()} ֏</p>
                </div>
              )}
              {toAccount && toAccountBalance != null && (
                <div className="p-4 bg-accent rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Դեպի հաշվի մնացորդ</p>
                  <p className="text-2xl font-bold">{toAccountBalance.toLocaleString()} ֏</p>
                </div>
              )}
            </div>
          )}

          {/* Contract Selection - shown only if to-account has person_id */}
          {showContractSelect && (
            <div className="space-y-2">
              <Label>Պայմանագիր <span className="text-destructive">*</span></Label>
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger>
                  <SelectValue placeholder="Ընտրեք պայմանագիրը" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Առանց պայմանագրի</SelectItem>
                  {contracts.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id.toString()}>
                      {contract.description.substring(0, 50)}
                      {contract.description.length > 50 ? "..." : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Contract Details - shown when contract is selected */}
          {selectedContractData && (
            <div className="p-4 bg-accent rounded-lg space-y-3">
              <p className="font-semibold">Պայմանագրի մանրամասներ</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Ընդհանուր գումար</p>
                  <p className="font-medium">{selectedContractData.total.toLocaleString()} ֏</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Վճարված (ընդունված)</p>
                  <p className="font-medium">{contractTransactionsTotal.toLocaleString()} ֏</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Մնացորդ</p>
                  <p className="font-medium text-orange-600">
                    {(selectedContractData.total - contractTransactionsTotal).toLocaleString()} ֏
                  </p>
                </div>
                {selectedContractData.qty && selectedContractData.unit && (
                  <div>
                    <p className="text-muted-foreground">Քանակ</p>
                    <p className="font-medium">{selectedContractData.qty} {selectedContractData.unit}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label>Գումար</Label>
              <Input
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(handleNumberInput(e.target.value))}
              />
            </div>

            {/* Created At */}
            <div className="space-y-2">
              <Label htmlFor="created-at">Ամսաթիվ և ժամ</Label>
              <Input
                id="created-at"
                type="datetime-local"
                value={createdAt}
                onChange={(e) => setCreatedAt(e.target.value)}
              />
            </div>
          </div>

          {/* Projected Balances - shown when amount is entered */}
          {amountNum > 0 && (fromAccount || toAccount) && (
            <div className="space-y-4">
              {/* Account Balance Projections */}
              <div className="grid grid-cols-2 gap-4">
                {fromAccount && projectedFromBalance != null && (
                  <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Ից հաշվի մնացորդը վճարումից հետո</p>
                    <p className={`text-2xl font-bold ${projectedFromBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {projectedFromBalance.toLocaleString()} ֏
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fromAccountBalance?.toLocaleString()} - {amountNum.toLocaleString()} = {projectedFromBalance.toLocaleString()}
                    </p>
                  </div>
                )}
                {toAccount && projectedToBalance != null && (
                  <div className="p-4 bg-primary/10 border-2 border-primary/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Դեպի հաշվի մնացորդը վճարումից հետո</p>
                    <p className={`text-2xl font-bold ${projectedToBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {projectedToBalance.toLocaleString()} ֏
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {toAccountBalance?.toLocaleString()} + {amountNum.toLocaleString()} = {projectedToBalance.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Contract Balance Projection */}
              {selectedContractData && projectedContractBalance != null && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Պայմանագրի մնացորդը վճարումից հետո</p>
                  <p className={`text-2xl font-bold ${projectedContractBalance >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {projectedContractBalance.toLocaleString()} ֏
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedContractData.total.toLocaleString()} - ({contractTransactionsTotal.toLocaleString()} + {amountNum.toLocaleString()}) = {projectedContractBalance.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

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

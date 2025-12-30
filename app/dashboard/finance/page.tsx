"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Wallet, Building2, Pencil } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { FinanceContent } from "@/components/finance-content"

interface Account {
  id: number
  name: string
  type: string
  bank: string | null
  number: string | null
  currency: string
  internal: boolean
}

export default function FinancePage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [accountFilter, setAccountFilter] = useState<"internal" | "external">("internal")
  const { toast } = useToast()

  // Form state for new account
  const [newAccount, setNewAccount] = useState({
    name: "",
    type: "bank",
    bank: "",
    number: "",
    currency: "amd",
  })

  // Form state for editing account
  const [editAccount, setEditAccount] = useState({
    id: 0,
    name: "",
    type: "bank",
    bank: "",
    number: "",
    currency: "amd",
    internal: true,
  })

  const supabase = createClient()

  // Fetch accounts from Supabase
  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("account")
        .select("*")
        .order("id", { ascending: true })

      if (error) {
        console.error("Error fetching accounts:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց բեռնել հաշիվների ցանկը",
          variant: "destructive",
        })
        return
      }

      setAccounts(data || [])
      if (data && data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0])
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  // Add new account
  const handleAddAccount = async () => {
    if (!newAccount.name) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել հաշվի անվանումը",
        variant: "destructive",
      })
      return
    }

    try {
      const { data, error } = await supabase
        .from("account")
        .insert([newAccount])
        .select()

      if (error) {
        console.error("Error adding account:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց ավելացնել հաշիվը",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Հաջողություն",
        description: "Հաշիվը հաջողությամբ ավելացվեց",
      })

      // Reset form
      setNewAccount({ name: "", type: "bank", bank: "", number: "", currency: "amd" })
      setIsDrawerOpen(false)

      // Refresh list
      fetchAccounts()
    } catch (error) {
      console.error("Error:", error)
    }
  }

  // Open edit drawer
  const handleEditClick = (account: Account, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditAccount({
      id: account.id,
      name: account.name,
      type: account.type,
      bank: account.bank || "",
      number: account.number || "",
      currency: account.currency,
      internal: account.internal,
    })
    setIsEditDrawerOpen(true)
  }

  // Update account
  const handleUpdateAccount = async () => {
    if (!editAccount.name) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել հաշվի անվանումը",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase
        .from("account")
        .update({
          name: editAccount.name,
          type: editAccount.type,
          bank: editAccount.bank || null,
          number: editAccount.number || null,
          currency: editAccount.currency,
        })
        .eq("id", editAccount.id)

      if (error) {
        console.error("Error updating account:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց թարմացնել հաշիվը",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Հաջողություն",
        description: "Հաշիվը հաջողությամբ թարմացվեց",
      })

      setIsEditDrawerOpen(false)

      // Refresh list and update selected account if it was edited
      fetchAccounts()
      if (selectedAccount?.id === editAccount.id) {
        setSelectedAccount({
          ...editAccount,
          bank: editAccount.bank || null,
          number: editAccount.number || null,
        })
      }
    } catch (error) {
      console.error("Error:", error)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      bank: "Բանկ",
      cash: "Կանխիկ",
      card: "Քարտ",
      other: "Այլ",
    }
    return types[type] || type
  }

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      bank: "default",
      cash: "secondary",
      card: "outline",
      other: "outline",
    }
    return variants[type] || "outline"
  }

  const getCurrencyLabel = (currency: string) => {
    const currencies: Record<string, string> = {
      amd: "֏",
      usd: "$",
      eur: "€",
      rub: "₽",
    }
    return currencies[currency.toLowerCase()] || currency.toUpperCase()
  }

  // Filter accounts based on internal/external
  const filteredAccounts = accounts.filter(account =>
    accountFilter === "internal" ? account.internal : !account.internal
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-6">
      {/* Sidebar with account list */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <div className="mb-4">
          <h2 className="text-2xl font-bold mb-3">Հաշիվներ</h2>

          {/* Filter Tabs */}
          <Tabs value={accountFilter} onValueChange={(value) => setAccountFilter(value as "internal" | "external")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="internal">Ներքին</TabsTrigger>
              <TabsTrigger value="external">Արտաքին</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Account List */}
        <div className="space-y-2 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Բեռնում...</p>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {accountFilter === "internal" ? "Ներքին հաշիվներ չկան" : "Արտաքին հաշիվներ չկան"}
              </p>
              <p className="text-xs text-muted-foreground">
                Սեղմեք ներքևի կոճակը՝ ավելացնելու համար
              </p>
            </div>
          ) : (
            filteredAccounts.map((account) => (
              <Card
                key={account.id}
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  selectedAccount?.id === account.id
                    ? "border-primary bg-accent"
                    : ""
                }`}
                onClick={() => setSelectedAccount(account)}
              >
                <CardHeader className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate flex items-center gap-2">
                        {account.name}
                        <span className="text-sm font-normal text-muted-foreground">
                          {getCurrencyLabel(account.currency)}
                        </span>
                      </CardTitle>
                      {account.bank && (
                        <CardDescription className="text-xs mt-1 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{account.bank}</span>
                        </CardDescription>
                      )}
                      {account.number && (
                        <CardDescription className="text-xs">
                          {account.number}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={getTypeBadgeVariant(account.type)} className="flex-shrink-0">
                      {getTypeLabel(account.type)}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}

          {/* Add New Account Button at Bottom */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <Card className="cursor-pointer transition-colors hover:bg-accent border-dashed mt-2">
                <CardHeader className="p-4">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Plus className="h-5 w-5" />
                    <span className="font-medium">Ավելացնել նոր հաշիվ</span>
                  </div>
                </CardHeader>
              </Card>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Ավելացնել նոր հաշիվ</SheetTitle>
                <SheetDescription>
                  Լրացրեք հաշվի տվյալները
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 py-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Անվանում</Label>
                  <Input
                    id="name"
                    placeholder="Հաշվի անվանումը"
                    value={newAccount.name}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Տեսակ</Label>
                  <Select
                    value={newAccount.type}
                    onValueChange={(value) =>
                      setNewAccount({ ...newAccount, type: value })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Բանկ</SelectItem>
                      <SelectItem value="cash">Կանխիկ</SelectItem>
                      <SelectItem value="card">Քարտ</SelectItem>
                      <SelectItem value="other">Այլ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Արժույթ</Label>
                  <Select
                    value={newAccount.currency}
                    onValueChange={(value) =>
                      setNewAccount({ ...newAccount, currency: value })
                    }
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amd">AMD (֏)</SelectItem>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                      <SelectItem value="rub">RUB (₽)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank">Բանկ</Label>
                  <Input
                    id="bank"
                    placeholder="Բանկի անվանումը"
                    value={newAccount.bank}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, bank: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="number">Հաշվի համար</Label>
                  <Input
                    id="number"
                    placeholder="Հաշվի համարը"
                    value={newAccount.number}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, number: e.target.value })
                    }
                  />
                </div>
              </div>

              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  Չեղարկել
                </Button>
                <Button onClick={handleAddAccount}>Ավելացնել</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        {selectedAccount ? (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold tracking-tight">
                    {selectedAccount.name}
                  </h2>
                  <Badge variant={getTypeBadgeVariant(selectedAccount.type)}>
                    {getTypeLabel(selectedAccount.type)}
                  </Badge>
                  <span className="text-2xl text-muted-foreground">
                    {getCurrencyLabel(selectedAccount.currency)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleEditClick(selectedAccount, e)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Խմբագրել
                </Button>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                {selectedAccount.bank && (
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {selectedAccount.bank}
                  </div>
                )}
                {selectedAccount.number && (
                  <div>{selectedAccount.number}</div>
                )}
              </div>
            </div>

            <FinanceContent
              accountId={selectedAccount.id}
              accountName={selectedAccount.name}
              accountCurrency={selectedAccount.currency}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Ընտրեք հաշիվը ձախ կողմից
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Account Drawer */}
      <Sheet open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Խմբագրել հաշիվը</SheetTitle>
            <SheetDescription>
              Փոփոխեք հաշվի տվյալները
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Անվանում</Label>
              <Input
                id="edit-name"
                placeholder="Հաշվի անվանումը"
                value={editAccount.name}
                onChange={(e) =>
                  setEditAccount({ ...editAccount, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-type">Տեսակ</Label>
              <Select
                value={editAccount.type}
                onValueChange={(value) =>
                  setEditAccount({ ...editAccount, type: value })
                }
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Բանկ</SelectItem>
                  <SelectItem value="cash">Կանխիկ</SelectItem>
                  <SelectItem value="card">Քարտ</SelectItem>
                  <SelectItem value="other">Այլ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-currency">Արժույթ</Label>
              <Select
                value={editAccount.currency}
                onValueChange={(value) =>
                  setEditAccount({ ...editAccount, currency: value })
                }
              >
                <SelectTrigger id="edit-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amd">AMD (֏)</SelectItem>
                  <SelectItem value="usd">USD ($)</SelectItem>
                  <SelectItem value="eur">EUR (€)</SelectItem>
                  <SelectItem value="rub">RUB (₽)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-bank">Բանկ</Label>
              <Input
                id="edit-bank"
                placeholder="Բանկի անվանումը"
                value={editAccount.bank}
                onChange={(e) =>
                  setEditAccount({ ...editAccount, bank: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-number">Հաշվի համար</Label>
              <Input
                id="edit-number"
                placeholder="Հաշվի համարը"
                value={editAccount.number}
                onChange={(e) =>
                  setEditAccount({ ...editAccount, number: e.target.value })
                }
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDrawerOpen(false)}
            >
              Չեղարկել
            </Button>
            <Button onClick={handleUpdateAccount}>Պահպանել</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

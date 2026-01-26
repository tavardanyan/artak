"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Handshake, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PartnerEditDrawer } from "@/components/partner-edit-drawer"

interface PartnerStats {
  total_transfers: number
  total_transfers_sum: number
  approved_transfers: number
  approved_transfers_sum: number
  pending_transfers: number
  pending_transfers_sum: number
  total_transactions: number
}

interface Partner {
  id: number
  name: string
  tin: string | null
  address: string | null
  type: string
  account_id: number | null
  warehouse_id: number | null
  account?: { name: string; currency: string }
  warehouse?: { name: string }
  stats?: PartnerStats
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const router = useRouter()
  const { toast } = useToast()

  // Form state
  const [partnerName, setPartnerName] = useState("")
  const [partnerTin, setPartnerTin] = useState("")
  const [partnerAddress, setPartnerAddress] = useState("")
  const [partnerType, setPartnerType] = useState("client")

  // Warehouse creation
  const [createWarehouse, setCreateWarehouse] = useState(false)
  const [warehouseName, setWarehouseName] = useState("")
  const [warehouseAddress, setWarehouseAddress] = useState("")

  // Account creation
  const [createAccount, setCreateAccount] = useState(false)
  const [accountName, setAccountName] = useState("")
  const [accountType, setAccountType] = useState("bank")
  const [accountBank, setAccountBank] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountCurrency, setAccountCurrency] = useState("amd")

  const supabase = createClient()

  // Fetch partners from Supabase
  const fetchPartners = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("partner")
        .select(`
          *,
          account:account_id(name, currency),
          warehouse:warehouse_id(name)
        `)
        .order("id", { ascending: true })

      if (error) {
        console.error("Error fetching partners:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց բեռնել գործընկերների ցանկը",
          variant: "destructive",
        })
        return
      }

      // Fetch statistics for each partner
      const partnersWithStats = await Promise.all(
        (data || []).map(async (partner) => {
          const stats: PartnerStats = {
            total_transfers: 0,
            total_transfers_sum: 0,
            approved_transfers: 0,
            approved_transfers_sum: 0,
            pending_transfers: 0,
            pending_transfers_sum: 0,
            total_transactions: 0,
          }

          // Get transfer statistics if partner has a warehouse
          if (partner.warehouse_id) {
            // Get all transfers FROM this partner's warehouse
            const { data: transfers } = await supabase
              .from("transfer")
              .select(`
                id,
                acepted_at,
                rejected_at,
                transfer_item(qty, unit_price, unit_vat)
              `)
              .eq("from", partner.warehouse_id)

            if (transfers) {
              stats.total_transfers = transfers.length

              transfers.forEach((transfer: any) => {
                // Calculate transfer total
                const transferTotal = (transfer.transfer_item || []).reduce((sum: number, item: any) => {
                  return sum + (item.qty * item.unit_price) + (item.qty * item.unit_vat)
                }, 0)

                stats.total_transfers_sum += transferTotal

                // Check if approved (acepted_at is set and rejected_at is null)
                if (transfer.acepted_at && !transfer.rejected_at) {
                  stats.approved_transfers++
                  stats.approved_transfers_sum += transferTotal
                } else if (!transfer.acepted_at && !transfer.rejected_at) {
                  stats.pending_transfers++
                  stats.pending_transfers_sum += transferTotal
                }
              })
            }
          }

          // Get transaction statistics if partner has an account
          if (partner.account_id) {
            // Get sum of all approved transactions TO this partner's account
            const { data: transactions } = await supabase
              .from("transaction")
              .select("amount")
              .eq("to", partner.account_id)
              .not("accepted_at", "is", null)
              .is("rejected_at", null)

            if (transactions) {
              stats.total_transactions = transactions.reduce((sum, t) => sum + t.amount, 0)
            }
          }

          return {
            ...partner,
            stats
          }
        })
      )

      setPartners(partnersWithStats)
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  // Add new partner
  const handleAddPartner = async () => {
    if (!partnerName) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել գործընկերի անվանումը",
        variant: "destructive",
      })
      return
    }

    if (createWarehouse && !warehouseName) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել պահեստի անվանումը",
        variant: "destructive",
      })
      return
    }

    if (createAccount && !accountName) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել հաշվի անվանումը",
        variant: "destructive",
      })
      return
    }

    try {
      let warehouseId = null
      let accountId = null

      // Create warehouse if needed
      if (createWarehouse) {
        const { data: warehouse, error: warehouseError } = await supabase
          .from("warehouse")
          .insert([{
            name: warehouseName,
            address: warehouseAddress || null,
            type: "partner",
          }])
          .select()
          .single()

        if (warehouseError) throw warehouseError
        warehouseId = warehouse.id
      }

      // Create account if needed
      if (createAccount) {
        const { data: account, error: accountError } = await supabase
          .from("account")
          .insert([{
            name: accountName,
            type: accountType,
            bank: accountBank || null,
            number: accountNumber || null,
            currency: accountCurrency,
            internal: false,
          }])
          .select()
          .single()

        if (accountError) throw accountError
        accountId = account.id
      }

      // Create partner
      const { error: partnerError } = await supabase
        .from("partner")
        .insert([{
          name: partnerName,
          tin: partnerTin || null,
          address: partnerAddress || null,
          type: partnerType,
          warehouse_id: warehouseId,
          account_id: accountId,
        }])

      if (partnerError) throw partnerError

      toast({
        title: "Հաջողություն",
        description: "Գործընկերը հաջողությամբ ավելացվեց",
      })

      // Reset form
      resetForm()
      setIsDrawerOpen(false)

      // Refresh list
      fetchPartners()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց ավելացնել գործընկերը",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setPartnerName("")
    setPartnerTin("")
    setPartnerAddress("")
    setPartnerType("client")
    setCreateWarehouse(false)
    setWarehouseName("")
    setWarehouseAddress("")
    setCreateAccount(false)
    setAccountName("")
    setAccountType("bank")
    setAccountBank("")
    setAccountNumber("")
    setAccountCurrency("amd")
  }

  useEffect(() => {
    fetchPartners()
  }, [])

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      client: "Հաճախորդ",
      supplier: "Մատակարար",
      contractor: "Կապալառու",
      customer: "Պատվիրատու",
      other: "Այլ",
    }
    return types[type] || type
  }

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      client: "default",
      supplier: "secondary",
      contractor: "outline",
      customer: "default",
      other: "outline",
    }
    return variants[type] || "outline"
  }

  const formatCurrency = (amount: number | undefined, currency: string = "amd") => {
    if (amount === undefined) return "-"

    const currencySymbols: Record<string, string> = {
      amd: "֏",
      usd: "$",
      eur: "€",
      rub: "₽",
    }

    const symbol = currencySymbols[currency.toLowerCase()] || currency.toUpperCase()
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)

    return `${formatted} ${symbol}`
  }

  const getFilteredPartners = () => {
    if (activeTab === "all") return partners
    if (activeTab === "suppliers") return partners.filter(p => p.type === "supplier")
    if (activeTab === "customers") return partners.filter(p => p.type === "client" || p.type === "customer")
    if (activeTab === "others") return partners.filter(p => p.type !== "supplier" && p.type !== "client" && p.type !== "customer")
    return partners
  }

  const filteredPartners = getFilteredPartners()

  const getTabCounts = () => {
    return {
      all: partners.length,
      suppliers: partners.filter(p => p.type === "supplier").length,
      customers: partners.filter(p => p.type === "client" || p.type === "customer").length,
      others: partners.filter(p => p.type !== "supplier" && p.type !== "client" && p.type !== "customer").length,
    }
  }

  const tabCounts = getTabCounts()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Գործընկերներ</h2>
          <p className="text-muted-foreground">
            Կառավարեք ձեր գործընկերների ցանկը
          </p>
        </div>
        <Button onClick={() => setIsDrawerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ավելացնել գործընկեր
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            Բոլորը ({tabCounts.all})
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            Մատակարարներ ({tabCounts.suppliers})
          </TabsTrigger>
          <TabsTrigger value="customers">
            Հաճախորդներ ({tabCounts.customers})
          </TabsTrigger>
          <TabsTrigger value="others">
            Այլ ({tabCounts.others})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === "all" && "Բոլոր գործընկերները"}
                {activeTab === "suppliers" && "Մատակարարներ"}
                {activeTab === "customers" && "Հաճախորդներ"}
                {activeTab === "others" && "Այլ գործընկերներ"}
              </CardTitle>
              <CardDescription>
                {activeTab === "all" && "Ձեր բոլոր գործընկերների ցանկ"}
                {activeTab === "suppliers" && "Ձեր մատակարարների ցանկ"}
                {activeTab === "customers" && "Ձեր հաճախորդների և պատվիրատուների ցանկ"}
                {activeTab === "others" && "Կապալառուներ և այլ գործընկերներ"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <p className="text-muted-foreground">Բեռնում...</p>
                </div>
              ) : filteredPartners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Handshake className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">
                    {activeTab === "all" && "Գործընկերներ չկան"}
                    {activeTab === "suppliers" && "Մատակարարներ չկան"}
                    {activeTab === "customers" && "Հաճախորդներ չկան"}
                    {activeTab === "others" && "Այլ գործընկերներ չկան"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Անվանում</TableHead>
                        <TableHead>ՀՎՀՀ</TableHead>
                        <TableHead>Տեսակ</TableHead>
                        <TableHead className="text-center">Հաշիվ</TableHead>
                        <TableHead className="text-center">Պահեստ</TableHead>
                        <TableHead className="text-right">Տեղափոխություն (ընդամենը)</TableHead>
                        <TableHead className="text-right">Վճարումներ</TableHead>
                        <TableHead className="text-right">Մնացորդ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPartners.map((partner) => {
                        const currency = partner.account?.currency || "amd"
                        const balance = (partner.stats?.total_transfers_sum || 0) - (partner.stats?.total_transactions || 0)

                        return (
                          <TableRow
                            key={partner.id}
                            className="cursor-pointer hover:bg-accent/50"
                            onClick={() => {
                              setSelectedPartnerId(partner.id)
                              setIsEditDrawerOpen(true)
                            }}
                          >
                            <TableCell className="font-medium">{partner.name}</TableCell>
                            <TableCell>{partner.tin || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={getTypeBadgeVariant(partner.type)}>
                                {getTypeLabel(partner.type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {partner.account_id ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/dashboard/finance?id=${partner.account_id}`)
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {partner.warehouse_id ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/dashboard/warehouse?id=${partner.warehouse_id}`)
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-medium">
                                  {formatCurrency(partner.stats?.total_transfers_sum || 0, currency)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({partner.stats?.total_transfers || 0})
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-blue-600">
                              {formatCurrency(partner.stats?.total_transactions || 0, currency)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-bold ${balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(balance, currency)}
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={5} className="font-bold">Ընդամենը</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(
                            filteredPartners.reduce((sum, p) => sum + (p.stats?.total_transfers_sum || 0), 0),
                            "amd"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          {formatCurrency(
                            filteredPartners.reduce((sum, p) => sum + (p.stats?.total_transactions || 0), 0),
                            "amd"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {(() => {
                            const totalBalance = filteredPartners.reduce((sum, p) => {
                              const balance = (p.stats?.total_transfers_sum || 0) - (p.stats?.total_transactions || 0)
                              return sum + balance
                            }, 0)
                            return (
                              <span className={totalBalance >= 0 ? 'text-red-600' : 'text-green-600'}>
                                {formatCurrency(totalBalance, "amd")}
                              </span>
                            )
                          })()}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Partner Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-[50vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Ավելացնել նոր գործընկեր</SheetTitle>
            <SheetDescription>
              Լրացրեք գործընկերի տվյալները
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Partner Info */}
            <div className="space-y-4">
              <h3 className="font-semibold">Գործընկերի տվյալներ</h3>

              <div className="space-y-2">
                <Label htmlFor="partner-name">Անվանում *</Label>
                <Input
                  id="partner-name"
                  placeholder="Գործընկերի անվանումը"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner-tin">ՀՎՀՀ</Label>
                <Input
                  id="partner-tin"
                  placeholder="00000000"
                  value={partnerTin}
                  onChange={(e) => setPartnerTin(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner-address">Հասցե</Label>
                <Input
                  id="partner-address"
                  placeholder="Գործընկերի հասցեն"
                  value={partnerAddress}
                  onChange={(e) => setPartnerAddress(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner-type">Տեսակ</Label>
                <Select value={partnerType} onValueChange={setPartnerType}>
                  <SelectTrigger id="partner-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Հաճախորդ</SelectItem>
                    <SelectItem value="supplier">Մատակարար</SelectItem>
                    <SelectItem value="contractor">Կապալառու</SelectItem>
                    <SelectItem value="customer">Պատվիրատու</SelectItem>
                    <SelectItem value="other">Այլ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Create Warehouse Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="create-warehouse">Ստեղծել պահեստ</Label>
                  <p className="text-sm text-muted-foreground">
                    Ստեղծել առանձին պահեստ այս գործընկերի համար
                  </p>
                </div>
                <Switch
                  id="create-warehouse"
                  checked={createWarehouse}
                  onCheckedChange={setCreateWarehouse}
                />
              </div>

              {createWarehouse && (
                <div className="space-y-4 pl-4 border-l-2">
                  <div className="space-y-2">
                    <Label htmlFor="warehouse-name">Պահեստի անվանում *</Label>
                    <Input
                      id="warehouse-name"
                      placeholder="Պահեստի անվանումը"
                      value={warehouseName}
                      onChange={(e) => setWarehouseName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="warehouse-address">Պահեստի հասցե</Label>
                    <Input
                      id="warehouse-address"
                      placeholder="Պահեստի հասցեն"
                      value={warehouseAddress}
                      onChange={(e) => setWarehouseAddress(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Create Account Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="create-account">Ստեղծել հաշիվ</Label>
                  <p className="text-sm text-muted-foreground">
                    Ստեղծել ֆինանսական հաշիվ այս գործընկերի համար
                  </p>
                </div>
                <Switch
                  id="create-account"
                  checked={createAccount}
                  onCheckedChange={setCreateAccount}
                />
              </div>

              {createAccount && (
                <div className="space-y-4 pl-4 border-l-2">
                  <div className="space-y-2">
                    <Label htmlFor="account-name">Հաշվի անվանում *</Label>
                    <Input
                      id="account-name"
                      placeholder="Հաշվի անվանումը"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-type">Հաշվի տեսակ</Label>
                    <Select value={accountType} onValueChange={setAccountType}>
                      <SelectTrigger id="account-type">
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
                    <Label htmlFor="account-bank">Բանկ</Label>
                    <Input
                      id="account-bank"
                      placeholder="Բանկի անվանումը"
                      value={accountBank}
                      onChange={(e) => setAccountBank(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-number">Հաշվեհամար</Label>
                    <Input
                      id="account-number"
                      placeholder="Հաշվեհամարը"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-currency">Արժույթ</Label>
                    <Select value={accountCurrency} onValueChange={setAccountCurrency}>
                      <SelectTrigger id="account-currency">
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
                </div>
              )}
            </div>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm()
                setIsDrawerOpen(false)
              }}
            >
              Չեղարկել
            </Button>
            <Button onClick={handleAddPartner}>Ավելացնել</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Partner Edit Drawer */}
      <PartnerEditDrawer
        open={isEditDrawerOpen}
        onOpenChange={setIsEditDrawerOpen}
        partnerId={selectedPartnerId}
        onSuccess={fetchPartners}
      />
    </div>
  )
}

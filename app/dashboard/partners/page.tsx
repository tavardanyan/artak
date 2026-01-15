"use client"

import { useState, useEffect } from "react"
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Handshake } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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
  account_balance?: number
  pending_balance?: number
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
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

      // Fetch balances for partners with accounts
      const partnersWithBalances = await Promise.all(
        (data || []).map(async (partner) => {
          if (partner.account_id) {
            const { data: balanceData } = await supabase
              .from("account_balance")
              .select("balance, pending_balance")
              .eq("account_id", partner.account_id)
              .single()

            return {
              ...partner,
              account_balance: balanceData?.balance || 0,
              pending_balance: balanceData?.pending_balance || 0
            }
          }
          return partner
        })
      )

      setPartners(partnersWithBalances)
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

      <Card>
        <CardHeader>
          <CardTitle>Բոլոր գործընկերները</CardTitle>
          <CardDescription>
            Ձեր հաճախորդների, մատակարարների և կապալառուների ցանկ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <p className="text-muted-foreground">Բեռնում...</p>
            </div>
          ) : partners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Handshake className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
              <p className="text-muted-foreground">Գործընկերներ չկան</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Անվանում</TableHead>
                  <TableHead>ՀՎՀՀ</TableHead>
                  <TableHead>Հասցե</TableHead>
                  <TableHead>Տեսակ</TableHead>
                  <TableHead>Հաշիվ</TableHead>
                  <TableHead>Մնացորդ</TableHead>
                  <TableHead>Ընթացիկ մնացորդ</TableHead>
                  <TableHead>Պահեստ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => (
                  <TableRow key={partner.id} className="cursor-pointer hover:bg-accent">
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>{partner.tin || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {partner.address || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(partner.type)}>
                        {getTypeLabel(partner.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{partner.account?.name || "-"}</TableCell>
                    <TableCell className="font-medium">
                      {partner.account_id
                        ? formatCurrency(partner.account_balance, partner.account?.currency)
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="font-medium">
                      {partner.account_id
                        ? formatCurrency(partner.pending_balance, partner.account?.currency)
                        : "-"
                      }
                    </TableCell>
                    <TableCell>{partner.warehouse?.name || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
    </div>
  )
}

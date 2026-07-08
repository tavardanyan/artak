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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, ArrowRightLeft, CreditCard, Package, DollarSign, User, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { TransferDetailDrawer } from "@/components/transfer-detail-drawer"

interface PartnerStats {
  total_transfers: number
  total_transfers_sum: number
  approved_transfers: number
  approved_transfers_sum: number
  pending_transfers: number
  pending_transfers_sum: number
  total_transactions: number
  balance: number
  currency: string
}

interface Partner {
  id: number
  name: string
  tin: string | null
  address: string | null
  type: string
  account_id: number | null
  warehouse_id: number | null
}

interface Transfer {
  id: number
  created_at: string
  from: number
  to: number
  acepted_at: string | null
  rejected_at: string | null
  from_warehouse?: { name: string }
  to_warehouse?: { name: string }
  transfer_item?: Array<{
    qty: number
    unit_price: number
    unit_vat: number
  }>
}

interface Person {
  id: number
  type: string
  first_name: string
  last_lame: string | null
  bday: string | null
  email: string | null
  phone: string | null
  address: string | null
  position: string[] | null
  second_phone: string | null
  nickname: string | null
  partner_id: number | null
  account_id: number | null
}

interface PartnerEditDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  partnerId: number | null
  onSuccess: () => void
  projectId?: number | null
  projectWarehouseId?: number | null
  projectAccountId?: number | null
}

export function PartnerEditDrawer({ open, onOpenChange, partnerId, onSuccess, projectId, projectWarehouseId, projectAccountId }: PartnerEditDrawerProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [transferPage, setTransferPage] = useState(1)
  const [transferTotalCount, setTransferTotalCount] = useState(0)
  const [loadingTransfers, setLoadingTransfers] = useState(false)
  const [persons, setPersons] = useState<Person[]>([])
  const [activeTab, setActiveTab] = useState("details")

  // Detail drawer states
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null)
  const [isTransferDetailOpen, setIsTransferDetailOpen] = useState(false)

  const TRANSFERS_PAGE_SIZE = 10

  // Form state
  const [name, setName] = useState("")
  const [tin, setTin] = useState("")
  const [address, setAddress] = useState("")
  const [type, setType] = useState("client")

  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (open && partnerId) {
      fetchPartnerData()
    }
  }, [open, partnerId])

  const fetchPartnerData = async () => {
    if (!partnerId) return

    try {
      setLoading(true)

      // Fetch partner details
      const { data: partnerData, error: partnerError } = await supabase
        .from("partner")
        .select("*")
        .eq("id", partnerId)
        .single()

      if (partnerError) throw partnerError

      setPartner(partnerData)
      setName(partnerData.name)
      setTin(partnerData.tin || "")
      setAddress(partnerData.address || "")
      setType(partnerData.type)

      // Initialize statistics
      const statsData: PartnerStats = {
        total_transfers: 0,
        total_transfers_sum: 0,
        approved_transfers: 0,
        approved_transfers_sum: 0,
        pending_transfers: 0,
        pending_transfers_sum: 0,
        total_transactions: 0,
        balance: 0,
        currency: "amd"
      }

      // Fetch ALL transfers FROM partner's warehouse for statistics
      if (partnerData.warehouse_id) {
        // Get account currency if available
        if (partnerData.account_id) {
          const { data: accountData } = await supabase
            .from("account")
            .select("currency")
            .eq("id", partnerData.account_id)
            .single()

          if (accountData) {
            statsData.currency = accountData.currency
          }
        }

        // Fetch ALL transfers for statistics
        let transferQuery = supabase
          .from("transfer")
          .select(`
            id,
            acepted_at,
            rejected_at,
            transfer_item(qty, unit_price, unit_vat)
          `)
          .eq("from", partnerData.warehouse_id)

        // Filter by project warehouse if provided
        if (projectWarehouseId) {
          transferQuery = transferQuery.eq("to", projectWarehouseId)
        }

        const { data: allTransfersData } = await transferQuery

        if (allTransfersData) {
          statsData.total_transfers = allTransfersData.length

          allTransfersData.forEach((transfer: any) => {
            const transferTotal = (transfer.transfer_item || []).reduce((sum: number, item: any) => {
              return sum + (item.qty * item.unit_price) + (item.qty * item.unit_vat)
            }, 0)

            statsData.total_transfers_sum += transferTotal

            if (transfer.acepted_at && !transfer.rejected_at) {
              statsData.approved_transfers++
              statsData.approved_transfers_sum += transferTotal
            } else if (!transfer.acepted_at && !transfer.rejected_at) {
              statsData.pending_transfers++
              statsData.pending_transfers_sum += transferTotal
            }
          })
        }

        // Fetch first page of transfers for display (server-side pagination)
        await fetchTransfersPage(partnerData.warehouse_id, 1)
      } else {
        setTransfers([])
        setTransferTotalCount(0)
        setTransferPage(1)
      }

      // Fetch transactions TO partner's account
      if (partnerData.account_id) {
        // Fetch ALL transactions for statistics
        let statsTransactionQuery = supabase
          .from("transaction")
          .select("amount")
          .eq("to", partnerData.account_id)
          .not("accepted_at", "is", null)
          .is("rejected_at", null)

        // Filter by project if provided
        if (projectId) {
          statsTransactionQuery = statsTransactionQuery.eq("project_id", projectId)
        }

        const { data: allTransactionsData } = await statsTransactionQuery

        if (allTransactionsData) {
          statsData.total_transactions = allTransactionsData.reduce((sum, t) => sum + t.amount, 0)
        }
      }

      // Calculate balance
      statsData.balance = statsData.total_transfers_sum - statsData.total_transactions
      setStats(statsData)

      // Fetch persons related to this partner
      const { data: personsData } = await supabase
        .from("person")
        .select("*")
        .eq("partner_id", partnerId)
        .order("id", { ascending: false })

      setPersons(personsData || [])
    } catch (error) {
      console.error("Error fetching partner data:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել գործընկերի տվյալները",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchTransfersPage = async (warehouseId: number, page: number) => {
    setLoadingTransfers(true)
    try {
      let query = supabase
        .from("transfer")
        .select(`
          id,
          created_at,
          from,
          to,
          acepted_at,
          rejected_at,
          from_warehouse:warehouse!transfer_from_fkey(name),
          to_warehouse:warehouse!transfer_to_fkey(name),
          transfer_item(qty, unit_price, unit_vat)
        `, { count: "exact" })
        .eq("from", warehouseId)

      // Filter by project warehouse if provided
      if (projectWarehouseId) {
        query = query.eq("to", projectWarehouseId)
      }

      const from = (page - 1) * TRANSFERS_PAGE_SIZE
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, from + TRANSFERS_PAGE_SIZE - 1)

      if (error) throw error
      setTransfers((data || []) as unknown as Transfer[])
      setTransferTotalCount(count || 0)
      setTransferPage(page)
    } catch (error) {
      console.error("Error fetching transfers:", error)
    } finally {
      setLoadingTransfers(false)
    }
  }

  const handleSave = async () => {
    if (!partner || !name) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել անվանումը",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)

      const { error } = await supabase
        .from("partner")
        .update({
          name,
          tin: tin || null,
          address: address || null,
          type,
        })
        .eq("id", partner.id)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Գործընկերը հաջողությամբ թարմացվեց",
      })

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating partner:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց թարմացնել գործընկերը",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("hy-AM", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const calculateTransferTotal = (transfer: Transfer) => {
    if (!transfer.transfer_item) return 0
    return transfer.transfer_item.reduce((sum, item) => {
      return sum + (item.qty * item.unit_price) + (item.qty * item.unit_vat)
    }, 0)
  }

  const getStatusBadge = (accepted: string | null, rejected: string | null) => {
    if (accepted) {
      return <Badge variant="default" className="bg-green-600">Հաստատված</Badge>
    }
    if (rejected) {
      return <Badge variant="destructive">Մերժված</Badge>
    }
    return <Badge variant="secondary">Սպասման մեջ</Badge>
  }

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      supplier: "Մատակարար",
      client: "Հաճախորդ",
      customer: "Հաճախորդ",
      contractor: "Կապալառու",
    }
    return types[type] || type
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[75vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Խմբագրել գործընկերը</SheetTitle>
          <SheetDescription>
            Փոփոխեք գործընկերի տվյալները և դիտեք վերջին գործարքները
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : partner ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full py-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Մանրամասներ</TabsTrigger>
              <TabsTrigger value="contacts">Կոնտակտներ ({persons.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-6">
              {/* Main Info Section */}
              <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Հիմնական տվյալներ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Անվանում *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Գործընկերի անվանումը"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tin">ՀՎՀՀ</Label>
                    <Input
                      id="tin"
                      value={tin}
                      onChange={(e) => setTin(e.target.value)}
                      placeholder="ՀՎՀՀ"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Հասցե</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Հասցե"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Տեսակ</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="supplier">Մատակարար</SelectItem>
                        <SelectItem value="client">Հաճախորդ</SelectItem>
                        <SelectItem value="customer">Պատվիրատու</SelectItem>
                        <SelectItem value="contractor">Կապալառու</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Պահպանվում է...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Պահպանել
                      </>
                    )}
                  </Button>
                  {partner.warehouse_id && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        router.push(`/dashboard/warehouse?id=${partner.warehouse_id}`)
                        onOpenChange(false)
                      }}
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Պահեստ
                    </Button>
                  )}
                  {partner.account_id && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        router.push(`/dashboard/finance?id=${partner.account_id}`)
                        onOpenChange(false)
                      }}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Հաշիվ
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            {stats && (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Ֆինանսական ամփոփագիր
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Տեղափոխություններ (ընդամենը)</p>
                      <p className="text-lg font-bold">{formatCurrency(stats.total_transfers_sum, stats.currency)}</p>
                      <p className="text-xs text-muted-foreground">({stats.total_transfers})</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Հաստատված տեղափոխություն</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(stats.approved_transfers_sum, stats.currency)}</p>
                      <p className="text-xs text-muted-foreground">({stats.approved_transfers})</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Չհաստատված տեղափոխություն</p>
                      <p className="text-lg font-bold text-orange-600">{formatCurrency(stats.pending_transfers_sum, stats.currency)}</p>
                      <p className="text-xs text-muted-foreground">({stats.pending_transfers})</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Վճարումներ</p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.total_transactions, stats.currency)}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Մնացորդ</p>
                      <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(stats.balance, stats.currency)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.balance >= 0 ? 'Պարտք մեզ' : 'Պարտք նրանց'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Transfers Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ArrowRightLeft className="h-4 w-4" />
                  Տեղափոխություններ
                </CardTitle>
                <CardDescription>
                  Տեղափոխությունները այս գործընկերից
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransfers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : transfers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ArrowRightLeft className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Տեղափոխություններ չկան</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Ամսաթիվ</TableHead>
                          <TableHead className="text-xs">Դեպի</TableHead>
                          <TableHead className="text-xs text-right">Գումար</TableHead>
                          <TableHead className="text-xs">Կարգավիճակ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfers.map((transfer) => (
                          <TableRow
                            key={transfer.id}
                            className="text-xs cursor-pointer hover:bg-accent/50"
                            onClick={() => {
                              setSelectedTransferId(transfer.id)
                              setIsTransferDetailOpen(true)
                            }}
                          >
                            <TableCell className="py-2">
                              {formatDate(transfer.created_at)}
                            </TableCell>
                            <TableCell className="py-2">
                              {(transfer.to_warehouse as any)?.name || "-"}
                            </TableCell>
                            <TableCell className="py-2 text-right font-medium">
                              {formatCurrency(calculateTransferTotal(transfer))}
                            </TableCell>
                            <TableCell className="py-2">
                              {getStatusBadge(transfer.acepted_at, transfer.rejected_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {transferTotalCount > TRANSFERS_PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Ընդամենը՝ {transferTotalCount.toLocaleString()} • Էջ {transferPage}/{Math.max(1, Math.ceil(transferTotalCount / TRANSFERS_PAGE_SIZE))}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={transferPage <= 1 || loadingTransfers || !partner?.warehouse_id}
                        onClick={() => partner?.warehouse_id && fetchTransfersPage(partner.warehouse_id, transferPage - 1)}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Նախորդ
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={transferPage >= Math.ceil(transferTotalCount / TRANSFERS_PAGE_SIZE) || loadingTransfers || !partner?.warehouse_id}
                        onClick={() => partner?.warehouse_id && fetchTransfersPage(partner.warehouse_id, transferPage + 1)}
                      >
                        Հաջորդ
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </TabsContent>

            <TabsContent value="contacts" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Կոնտակտային անձինք
                    </CardTitle>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Ավելացնել
                    </Button>
                  </div>
                  <CardDescription>
                    Գործընկերի հետ կապված անձինք
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {persons.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Կոնտակտներ չկան</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {persons.map((person) => (
                        <Card key={person.id} className="border">
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Անուն Ազգանուն</p>
                                <p className="font-medium">
                                  {person.first_name} {person.last_lame || ""}
                                  {person.nickname && <span className="text-muted-foreground text-sm"> ({person.nickname})</span>}
                                </p>
                              </div>
                              {person.position && person.position.length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Պաշտոն</p>
                                  <p className="font-medium">{person.position.join(", ")}</p>
                                </div>
                              )}
                              {person.phone && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Հեռախոս</p>
                                  <p className="font-medium">{person.phone}</p>
                                  {person.second_phone && (
                                    <p className="text-sm text-muted-foreground">{person.second_phone}</p>
                                  )}
                                </div>
                              )}
                              {person.email && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Էլ. փոստ</p>
                                  <p className="font-medium">{person.email}</p>
                                </div>
                              )}
                              {person.bday && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Ծննդյան օր</p>
                                  <p className="font-medium">{new Date(person.bday).toLocaleDateString("hy-AM")}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs text-muted-foreground">Տեսակ</p>
                                <Badge variant="outline">{person.type}</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            Գործընկերը չի գտնվել
          </div>
        )}
      </SheetContent>

      {/* Nested Detail Drawers */}
      <TransferDetailDrawer
        open={isTransferDetailOpen}
        onOpenChange={setIsTransferDetailOpen}
        transferId={selectedTransferId}
      />
    </Sheet>
  )
}

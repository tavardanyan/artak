"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { handleNumberInput, parseFormattedNumber } from "@/lib/utils/number-format"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Calendar,
  DollarSign,
  Package,
  Receipt,
  Loader2,
  Handshake,
  MapPin,
  FileText,
  Briefcase,
  Plus,
  ArrowUpRight,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { WarehouseContent } from "@/components/warehouse-content"
import { EditProjectDrawer } from "@/components/edit-project-drawer"

interface Project {
  id: number
  name: string
  code: string
  type: string
  address: string | null
  partner_id: number
  start: string | null
  end: string | null
  agreement_date: string | null
  budget: number | null
  status: string
  created_at: string
  partner?: {
    id: number
    name: string
    tin: string | null
    address: string | null
    warehouse_id: number | null
    account_id: number | null
    warehouse?: {
      id: number
      name: string
    }
    account?: {
      id: number
      name: string
      currency: string
    }
  }
}

interface Transaction {
  id: number
  from: number
  to: number
  amount: number
  note: string | null
  created_at: string
  from_account?: {
    name: string
    currency: string
  }
  to_account?: {
    name: string
    currency: string
  }
}

interface ContractTransaction {
  id: number
  contact_id: number
  transaction_id: number
  transaction?: {
    id: number
    amount: number
    created_at: string
    from_account?: {
      name: string
      currency: string
    }
    to_account?: {
      name: string
      currency: string
    }
  }
}

interface Contract {
  id: number
  created_at: string
  start: string | null
  end: string | null
  description: string
  price: number | null
  unit: string | null
  qty: number | null
  total: number
  status: string
  project_id: number
  person_id: number
  person?: {
    first_name: string
    last_lame: string | null
    position: string | null
  }
  contract_transaction?: ContractTransaction[]
}

interface Person {
  id: number
  first_name: string
  last_lame: string | null
  position: string | null
}

interface Contact {
  id: number
  first_name: string
  last_lame: string | null
  phone: string | null
  email: string | null
  position: string | null
  partner_id: number | null
}

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Ակտիվ", variant: "default" },
    planning: { label: "Պլանավորում", variant: "secondary" },
    completed: { label: "Ավարտված", variant: "outline" },
    cancelled: { label: "Չեղարկված", variant: "destructive" },
  }

  const statusInfo = statusMap[status] || { label: status, variant: "outline" as const }
  return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
}

const getContractStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    planned: { label: "Պլանավորված", variant: "secondary" },
    "in progress": { label: "Ընթացքի մեջ", variant: "default" },
    done: { label: "Կատարված", variant: "outline" },
    rejected: { label: "Մերժված", variant: "destructive" },
  }

  const statusInfo = statusMap[status] || { label: status, variant: "outline" as const }
  return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
}

const getTypeLabel = (type: string) => {
  const types: Record<string, string> = {
    construction: "Շինարարություն",
    renovation: "Վերանորոգում",
    design: "Դիզայն",
    consulting: "Խորհրդատվություն",
    other: "Այլ",
  }
  return types[type] || type
}

const formatCurrency = (amount: number, currency: string = "amd") => {
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

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleDateString("hy-AM", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("hy-AM", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()
  const { toast } = useToast()

  const [project, setProject] = useState<Project | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [staff, setStaff] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [isContractDrawerOpen, setIsContractDrawerOpen] = useState(false)
  const [isEditContractDrawerOpen, setIsEditContractDrawerOpen] = useState(false)
  const [isEditProjectDrawerOpen, setIsEditProjectDrawerOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)

  useEffect(() => {
    fetchProject()
  }, [projectId])

  useEffect(() => {
    if (project?.id) {
      fetchTransactions()
      fetchContracts()
      fetchStaff()
      fetchContacts()
    }
  }, [project])

  const fetchProject = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("project")
        .select(`
          *,
          partner:partner_id(
            *,
            warehouse:warehouse_id(id, name),
            account:account_id(id, name, currency)
          )
        `)
        .eq("id", projectId)
        .single()

      if (error) throw error
      setProject(data)
    } catch (error) {
      console.error("Error fetching project:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել նախագծի տվյալները",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }


  const fetchTransactions = async () => {
    if (!project?.id) return

    try {
      const { data, error } = await supabase
        .from("transaction")
        .select(`
          *,
          from_account:from(name, currency),
          to_account:to(name, currency)
        `)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error("Error fetching transactions:", error)
    }
  }

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from("contract")
        .select(`
          *,
          person:person_id(first_name, last_lame, position)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Fetch contract transactions separately for each contract
      if (data && data.length > 0) {
        const contractsWithTransactions = await Promise.all(
          data.map(async (contract) => {
            const { data: ctData, error: ctError } = await supabase
              .from("contract_transaction")
              .select(`
                contact_id,
                transaction_id,
                transaction:transaction_id(
                  id,
                  amount,
                  created_at,
                  from_account:from(name, currency),
                  to_account:to(name, currency)
                )
              `)
              .eq("contact_id", contract.id)

            if (ctError) {
              console.error("Error fetching contract transactions:", ctError)
              return { ...contract, contract_transaction: [] }
            }

            return {
              ...contract,
              contract_transaction: ctData?.map(ct => ({
                id: ct.contact_id, // Using contact_id as id
                contact_id: ct.contact_id,
                transaction_id: ct.transaction_id,
                transaction: ct.transaction
              })) || []
            }
          })
        )

        setContracts(contractsWithTransactions)
      } else {
        setContracts(data || [])
      }
    } catch (error) {
      console.error("Error fetching contracts:", error)
    }
  }

  const fetchStaff = async () => {
    try {
      const { data, error} = await supabase
        .from("person")
        .select("id, first_name, last_lame, position")
        .eq("type", "staff")
        .order("first_name")

      if (error) throw error
      setStaff(data || [])
    } catch (error) {
      console.error("Error fetching staff:", error)
    }
  }

  const fetchContacts = async () => {
    if (!project?.partner_id) return

    try {
      const { data, error} = await supabase
        .from("person")
        .select("id, first_name, last_lame, phone, email, position, partner_id")
        .eq("type", "contact")
        .eq("partner_id", project.partner_id)
        .order("first_name")

      if (error) throw error
      setContacts(data || [])
    } catch (error) {
      console.error("Error fetching contacts:", error)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Նախագիծը չի գտնվել</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
            {getStatusBadge(project.status)}
            <Badge variant="outline">{getTypeLabel(project.type)}</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Կոդ: {project.code}
            </span>
            {project.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {project.address}
              </span>
            )}
          </div>
        </div>
        <Button onClick={() => setIsEditProjectDrawerOpen(true)}>
          Խմբագրել նախագիծը
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Ընդհանուր</TabsTrigger>
          <TabsTrigger value="contracts">
            Աշխատանքներ
            {contracts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {contracts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Կոնտակտներ
            {contacts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {contacts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="warehouse">
            Պահեստ
          </TabsTrigger>
          <TabsTrigger value="transactions">
            Գործարքներ
            {transactions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {transactions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Financial Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Budget Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Բյուջե</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {project.budget ? project.budget.toLocaleString() + " ֏" : "-"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Նախատեսված ընդհանուր բյուջե
                </p>
              </CardContent>
            </Card>

            {/* Total Contracts Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Պայմանագրեր</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {contracts.reduce((sum, c) => sum + c.total, 0).toLocaleString()} ֏
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {contracts.length} պայմանագիր
                </p>
              </CardContent>
            </Card>

            {/* Paid Amount Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Վճարված</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {contracts
                    .reduce((sum, c) => {
                      const contractPaid = (c.contract_transaction || []).reduce(
                        (total, ct) => total + (ct.transaction?.amount || 0),
                        0
                      )
                      return sum + contractPaid
                    }, 0)
                    .toLocaleString()} ֏
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ընդունված վճարումներ
                </p>
              </CardContent>
            </Card>

            {/* Budget Difference Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Մնացորդ</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {project.budget ? (
                  <>
                    <div className={`text-2xl font-bold ${
                      project.budget - contracts.reduce((sum, c) => sum + c.total, 0) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {(project.budget - contracts.reduce((sum, c) => sum + c.total, 0)).toLocaleString()} ֏
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Բյուջե - Պայմանագրեր
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">-</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Բյուջե սահմանված չէ
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Date Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Գործընկեր</CardTitle>
                <Handshake className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{project.partner?.name}</div>
                {project.partner?.tin && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ՀՎՀՀ: {project.partner.tin}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Պայմանագիր</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {formatDate(project.agreement_date)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Սկիզբ</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {formatDate(project.start)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ավարտ</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {formatDate(project.end)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Գործընկերի տվյալներ</CardTitle>
                <CardDescription>Նախագծի գործընկերոջ տեղեկատվությունը</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Անվանում</p>
                  <p className="text-base mt-1">{project.partner?.name}</p>
                </div>
                {project.partner?.tin && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">ՀՎՀՀ</p>
                    <p className="text-base mt-1">{project.partner.tin}</p>
                  </div>
                )}
                {project.partner?.address && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Հասցե</p>
                    <p className="text-base mt-1">{project.partner.address}</p>
                  </div>
                )}
                {project.partner?.warehouse && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Պահեստ</p>
                    <p className="text-base mt-1">{project.partner.warehouse.name}</p>
                  </div>
                )}
                {project.partner?.account && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Հաշիվ</p>
                    <p className="text-base mt-1">
                      {project.partner.account.name} ({project.partner.account.currency.toUpperCase()})
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Նախագծի մանրամասներ</CardTitle>
                <CardDescription>Հիմնական տեղեկատվություն</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Կոդ</p>
                  <p className="text-base mt-1">{project.code}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Տեսակ</p>
                  <p className="text-base mt-1">{getTypeLabel(project.type)}</p>
                </div>
                {project.address && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Հասցե</p>
                    <p className="text-base mt-1">{project.address}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Վիճակ</p>
                  <div className="mt-1">{getStatusBadge(project.status)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ստեղծվել է</p>
                  <p className="text-base mt-1">{formatDate(project.created_at)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Outgoing Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Ելքային գործարքներ</CardTitle>
              <CardDescription>Վերջին ելքային գործարքների ցանկ</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.filter(t => t.from === project.partner?.account_id).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ArrowUpRight className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">Ելքային գործարքներ չկան</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {transactions
                    .filter(t => t.from === project.partner?.account_id)
                    .slice(0, 6)
                    .map((transaction) => (
                      <Card key={transaction.id} className="hover:bg-accent/50 transition-colors">
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ArrowUpRight className="h-4 w-4 text-red-500" />
                                <span className="text-sm font-medium text-muted-foreground">Ելք</span>
                              </div>
                              <Badge variant="outline">
                                {new Date(transaction.created_at).toLocaleDateString('hy-AM')}
                              </Badge>
                            </div>

                            <div className="flex items-baseline justify-between">
                              <span className="text-2xl font-bold">
                                {transaction.amount.toLocaleString('hy-AM')}
                              </span>
                              <span className="text-sm font-medium text-muted-foreground">
                                {transaction.to_account?.currency.toUpperCase()}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Ից:</span>
                                <span className="font-medium">{transaction.from_account?.name}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Դեպի:</span>
                                <span className="font-medium">{transaction.to_account?.name}</span>
                              </div>
                            </div>

                            {transaction.note && (
                              <div className="pt-2 border-t">
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {transaction.note}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Աշխատանքային պայմանագրեր</CardTitle>
                  <CardDescription>Նախագծի աշխատանքների և պայմանագրերի ցանկ</CardDescription>
                </div>
                <Button onClick={() => setIsContractDrawerOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ավելացնել պայմանագիր
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Briefcase className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">Պայմանագրեր չկան</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Աշխատակից</TableHead>
                      <TableHead>Նկարագրություն</TableHead>
                      <TableHead className="text-right">Քանակ</TableHead>
                      <TableHead className="text-right">Գին</TableHead>
                      <TableHead className="text-right">Ընդամենը</TableHead>
                      <TableHead className="text-right">Գործարքներ</TableHead>
                      <TableHead>Վիճակ</TableHead>
                      <TableHead>Սկիզբ</TableHead>
                      <TableHead>Ավարտ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => {
                      const personName = contract.person
                        ? `${contract.person.first_name} ${contract.person.last_lame || ""}`.trim()
                        : "-"

                      // Calculate transaction totals
                      const contractTransactions = contract.contract_transaction || []
                      const transactionCount = contractTransactions.length
                      const transactionTotal = contractTransactions.reduce((sum, ct) => {
                        return sum + (ct.transaction?.amount || 0)
                      }, 0)

                      return (
                        <TableRow
                          key={contract.id}
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => {
                            setSelectedContract(contract)
                            setIsEditContractDrawerOpen(true)
                          }}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{personName}</p>
                              {contract.person?.position && (
                                <p className="text-xs text-muted-foreground">
                                  {contract.person.position}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="line-clamp-2">{contract.description}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            {contract.qty || "-"} {contract.unit || ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {contract.price ? formatCurrency(contract.price) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(contract.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {transactionCount > 0 ? (
                              <div>
                                <p className="font-medium">{formatCurrency(transactionTotal)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {transactionCount} գործարք
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getContractStatusBadge(contract.status)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(contract.start)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(contract.end)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Կոնտակտներ</CardTitle>
              <CardDescription>
                Գործընկեր {project.partner?.name}-ի հետ կապված կոնտակտներ
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Կոնտակտներ չկան
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Անուն</TableHead>
                      <TableHead>Պաշտոն</TableHead>
                      <TableHead>Հեռախոս</TableHead>
                      <TableHead>Էլ. փոստ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">
                          {contact.first_name} {contact.last_lame || ""}
                        </TableCell>
                        <TableCell>
                          {contact.position || "-"}
                        </TableCell>
                        <TableCell>{contact.phone || "-"}</TableCell>
                        <TableCell>{contact.email || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warehouse Tab */}
        <TabsContent value="warehouse" className="space-y-4">
          {!project.partner?.warehouse_id ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                <p className="text-muted-foreground">Գործընկերն իր պահեստ չունի</p>
              </CardContent>
            </Card>
          ) : (
            <WarehouseContent
              warehouseId={project.partner.warehouse_id}
              warehouseName={project.partner.warehouse?.name || "Պահեստ"}
            />
          )}
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Հաշվի գործարքներ</CardTitle>
              <CardDescription>
                {project.partner?.account?.name || "Հաշիվ"} - Գործարքների պատմություն
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!project.partner?.account_id ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">Գործընկերն իր հաշիվ չունի</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">Գործարքներ չկան</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ամսաթիվ</TableHead>
                      <TableHead>Ստացող</TableHead>
                      <TableHead>Ուղարկող</TableHead>
                      <TableHead className="text-right">Գումար</TableHead>
                      <TableHead>Նշում</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => {
                      const isIncoming = transaction.to === project.partner?.account_id
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="text-sm">
                            {formatDateTime(transaction.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className={isIncoming ? "font-medium text-green-600" : ""}>
                              {transaction.to_account?.name || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className={!isIncoming ? "font-medium text-red-600" : ""}>
                              {transaction.from_account?.name || "-"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={isIncoming ? "text-green-600" : "text-red-600"}>
                              {isIncoming ? "+" : "-"}
                              {formatCurrency(
                                transaction.amount,
                                transaction.from_account?.currency || "amd"
                              )}
                            </span>
                          </TableCell>
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
        </TabsContent>
      </Tabs>

      {/* Create Contract Drawer */}
      <CreateContractDrawer
        open={isContractDrawerOpen}
        onOpenChange={setIsContractDrawerOpen}
        projectId={projectId}
        staff={staff}
        onSuccess={fetchContracts}
      />

      {/* Edit Contract Drawer */}
      {selectedContract && (
        <EditContractDrawer
          open={isEditContractDrawerOpen}
          onOpenChange={setIsEditContractDrawerOpen}
          contract={selectedContract}
          staff={staff}
          onSuccess={fetchContracts}
        />
      )}

      {/* Edit Project Drawer */}
      {project && (
        <EditProjectDrawer
          open={isEditProjectDrawerOpen}
          onOpenChange={setIsEditProjectDrawerOpen}
          project={project}
          onSuccess={fetchProject}
        />
      )}
    </div>
  )
}

function CreateContractDrawer({
  open,
  onOpenChange,
  projectId,
  staff,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  staff: Person[]
  onSuccess: () => void
}) {
  const [personId, setPersonId] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [unit, setUnit] = useState("")
  const [qty, setQty] = useState("")
  const [total, setTotal] = useState("")
  const [status, setStatus] = useState("planned")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  // Auto-calculate total when price or qty changes
  useEffect(() => {
    const priceNum = parseFormattedNumber(price)
    const qtyNum = parseFormattedNumber(qty)
    const calculatedTotal = priceNum * qtyNum
    setTotal(calculatedTotal > 0 ? handleNumberInput(calculatedTotal.toString()) : "")
  }, [price, qty])

  const resetForm = () => {
    setPersonId("")
    setDescription("")
    setPrice("")
    setUnit("")
    setQty("")
    setTotal("")
    setStatus("planned")
    setStartDate("")
    setEndDate("")
  }

  const handleSubmit = async () => {
    // Validation
    if (!personId || !description || !total) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել պարտադիր դաշտերը",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from("contract")
        .insert({
          project_id: parseInt(projectId),
          person_id: parseInt(personId),
          description,
          price: price ? parseFormattedNumber(price) : null,
          unit: unit || null,
          qty: qty ? parseFormattedNumber(qty) : null,
          total: parseFormattedNumber(total),
          status,
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate ? new Date(endDate).toISOString() : null,
        })

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Պայմանագիրը հաջողությամբ ավելացվեց",
      })

      resetForm()
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error creating contract:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց ստեղծել պայմանագիրը",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[50vw]">
        <SheetHeader>
          <SheetTitle>Ստեղծել պայմանագիր</SheetTitle>
          <SheetDescription>
            Ավելացրեք նոր աշխատանքային պայմանագիր
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label htmlFor="person">
              Աշխատակից <span className="text-destructive">*</span>
            </Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger id="person">
                <SelectValue placeholder="Ընտրել աշխատակցին" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((person) => (
                  <SelectItem key={person.id} value={person.id.toString()}>
                    {person.first_name} {person.last_lame || ""}
                    {person.position && (
                      <span className="text-muted-foreground text-xs ml-2">
                        ({person.position})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Նկարագրություն <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Աշխատանքի նկարագրությունը"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qty">Քանակ</Label>
              <Input
                id="qty"
                type="text"
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(handleNumberInput(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Միավոր</Label>
              <Input
                id="unit"
                placeholder="օր, մ², կտ և այլն"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Գին</Label>
            <Input
              id="price"
              type="text"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(handleNumberInput(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total">
              Ընդամենը <span className="text-destructive">*</span>
            </Label>
            <Input
              id="total"
              type="text"
              placeholder="0"
              value={total}
              onChange={(e) => setTotal(handleNumberInput(e.target.value))}
            />
            {price && qty && (
              <p className="text-xs text-muted-foreground">
                Ավտոմատ հաշվարկված: {qty} × {price} = {total}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Վիճակ</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Պլանավորված</SelectItem>
                <SelectItem value="in progress">Ընթացքի մեջ</SelectItem>
                <SelectItem value="done">Կատարված</SelectItem>
                <SelectItem value="rejected">Մերժված</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Սկիզբ</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">Ավարտ</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm()
              onOpenChange(false)
            }}
            disabled={isSubmitting}
          >
            Չեղարկել
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Ստեղծում..." : "Ստեղծել"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function EditContractDrawer({
  open,
  onOpenChange,
  contract,
  staff,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: Contract
  staff: Person[]
  onSuccess: () => void
}) {
  const [personId, setPersonId] = useState(contract.person_id.toString())
  const [description, setDescription] = useState(contract.description)
  const [price, setPrice] = useState(contract.price?.toString() || "")
  const [unit, setUnit] = useState(contract.unit || "")
  const [qty, setQty] = useState(contract.qty?.toString() || "")
  const [total, setTotal] = useState(contract.total.toString())
  const [status, setStatus] = useState(contract.status)
  const [startDate, setStartDate] = useState(
    contract.start ? new Date(contract.start).toISOString().split("T")[0] : ""
  )
  const [endDate, setEndDate] = useState(
    contract.end ? new Date(contract.end).toISOString().split("T")[0] : ""
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  // Auto-calculate total when price or qty changes
  useEffect(() => {
    const priceNum = parseFormattedNumber(price)
    const qtyNum = parseFormattedNumber(qty)
    const calculatedTotal = priceNum * qtyNum
    setTotal(calculatedTotal > 0 ? handleNumberInput(calculatedTotal.toString()) : "")
  }, [price, qty])

  // Update form when contract changes
  useEffect(() => {
    setPersonId(contract.person_id.toString())
    setDescription(contract.description)
    setPrice(contract.price ? handleNumberInput(contract.price.toString()) : "")
    setUnit(contract.unit || "")
    setQty(contract.qty ? handleNumberInput(contract.qty.toString()) : "")
    setTotal(handleNumberInput(contract.total.toString()))
    setStatus(contract.status)
    setStartDate(
      contract.start ? new Date(contract.start).toISOString().split("T")[0] : ""
    )
    setEndDate(
      contract.end ? new Date(contract.end).toISOString().split("T")[0] : ""
    )
  }, [contract])

  const handleSubmit = async () => {
    // Validation
    if (!personId || !description || !total) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել պարտադիր դաշտերը",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from("contract")
        .update({
          person_id: parseInt(personId),
          description,
          price: price ? parseFormattedNumber(price) : null,
          unit: unit || null,
          qty: qty ? parseFormattedNumber(qty) : null,
          total: parseFormattedNumber(total),
          status,
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate ? new Date(endDate).toISOString() : null,
        })
        .eq("id", contract.id)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Պայմանագիրը հաջողությամբ թարմացվեց",
      })

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error updating contract:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց թարմացնել պայմանագիրը",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[50vw]">
        <SheetHeader>
          <SheetTitle>Խմբագրել պայմանագիրը</SheetTitle>
          <SheetDescription>
            Թարմացրեք աշխատանքային պայմանագրի տվյալները
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label htmlFor="person">
              Աշխատակից <span className="text-destructive">*</span>
            </Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger id="person">
                <SelectValue placeholder="Ընտրել աշխատակցին" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((person) => (
                  <SelectItem key={person.id} value={person.id.toString()}>
                    {person.first_name} {person.last_lame || ""}
                    {person.position && (
                      <span className="text-muted-foreground text-xs ml-2">
                        ({person.position})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Նկարագրություն <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Աշխատանքի նկարագրությունը"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qty">Քանակ</Label>
              <Input
                id="qty"
                type="text"
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(handleNumberInput(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Միավոր</Label>
              <Input
                id="unit"
                placeholder="օր, մ², կտ և այլն"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Գին</Label>
            <Input
              id="price"
              type="text"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(handleNumberInput(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total">
              Ընդամենը <span className="text-destructive">*</span>
            </Label>
            <Input
              id="total"
              type="text"
              placeholder="0"
              value={total}
              onChange={(e) => setTotal(handleNumberInput(e.target.value))}
            />
            {price && qty && (
              <p className="text-xs text-muted-foreground">
                Ավտոմատ հաշվարկված: {qty} × {price} = {total}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Վիճակ</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Պլանավորված</SelectItem>
                <SelectItem value="in progress">Ընթացքի մեջ</SelectItem>
                <SelectItem value="done">Կատարված</SelectItem>
                <SelectItem value="rejected">Մերժված</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Սկիզբ</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">Ավարտ</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Contract Transactions Section */}
          {contract.contract_transaction && contract.contract_transaction.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <Label>Գործարքներ ({contract.contract_transaction.length})</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {contract.contract_transaction.map((ct) => (
                  <div
                    key={ct.id}
                    className="p-3 border rounded-md bg-muted/50 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {formatCurrency(ct.transaction?.amount || 0)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(ct.transaction?.created_at)}
                      </span>
                    </div>
                    {ct.transaction?.from_account && ct.transaction?.to_account && (
                      <p className="text-xs text-muted-foreground">
                        {ct.transaction.from_account.name} → {ct.transaction.to_account.name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Ընդամենը վճարված:</span>
                <span className="font-bold">
                  {formatCurrency(
                    contract.contract_transaction.reduce(
                      (sum, ct) => sum + (ct.transaction?.amount || 0),
                      0
                    )
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Մնացած:</span>
                <span className="font-medium">
                  {formatCurrency(
                    contract.total -
                      contract.contract_transaction.reduce(
                        (sum, ct) => sum + (ct.transaction?.amount || 0),
                        0
                      )
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Չեղարկել
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Պահպանում..." : "Պահպանել"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Calendar,
  Calendar as CalendarIcon,
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
import { ProjectDocuments } from "@/components/project-documents"
import { TaskDrawer } from "@/components/task-drawer"
import { EditProjectDrawer } from "@/components/edit-project-drawer"
import { PartnerEditDrawer } from "@/components/partner-edit-drawer"
import { TransactionDetailDrawer } from "@/components/transaction-detail-drawer"

interface Project {
  id: number
  name: string
  code: string
  type: string
  address: string | null
  partner_id: number
  parent_project: number | null
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

interface SupplierStats {
  total_transfers: number
  total_transfers_sum: number
  approved_transfers: number
  approved_transfers_sum: number
  pending_transfers: number
  pending_transfers_sum: number
  total_transactions: number
}

interface Supplier {
  id: number
  name: string
  tin: string | null
  type: string
  warehouse_id: number | null
  account_id: number | null
  account?: { name: string; currency: string }
  warehouse?: { name: string }
  stats?: SupplierStats
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [isContractDrawerOpen, setIsContractDrawerOpen] = useState(false)
  const [isEditContractDrawerOpen, setIsEditContractDrawerOpen] = useState(false)
  const [isEditProjectDrawerOpen, setIsEditProjectDrawerOpen] = useState(false)
  const [isPartnerDrawerOpen, setIsPartnerDrawerOpen] = useState(false)
  const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null)
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null)
  const [internalAccountIds, setInternalAccountIds] = useState<Set<number>>(new Set())
  const [warehouseStockValue, setWarehouseStockValue] = useState(0)
  const [tasks, setTasks] = useState<Array<{ id: number; title: string; text: string | null; project_id: number | null; day: string; seen: boolean }>>([])
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [subProjectAggregates, setSubProjectAggregates] = useState<{
    budget: number
    contractsRemaining: number
    txDifference: number
    supplierDebt: number
    warehouseStockValue: number
  } | null>(null)

  useEffect(() => {
    fetchProject()
    fetchInternalAccounts()
  }, [projectId])

  useEffect(() => {
    if (project?.id) {
      fetchTransactions()
      fetchContracts()
      fetchStaff()
      fetchContacts()
      fetchSuppliers()
      fetchWarehouseStockValue()
      fetchSubProjectAggregates()
      fetchTasks()
    }
  }, [project])

  const fetchTasks = async () => {
    if (!project?.id) return
    const { data } = await supabase
      .from("task")
      .select("id, title, text, project_id, day, seen")
      .eq("project_id", project.id)
      .order("day", { ascending: false })
    setTasks(data || [])
  }

  const fetchSubProjectAggregates = async () => {
    if (!project?.id) {
      setSubProjectAggregates(null)
      return
    }
    const { data: subs } = await supabase
      .from("project")
      .select(`
        id,
        budget,
        partner:partner_id(account_id, warehouse_id)
      `)
      .eq("parent_project", project.id)

    if (!subs || subs.length === 0) {
      setSubProjectAggregates(null)
      return
    }

    let budget = 0, contractsRemaining = 0, txDifference = 0, supplierDebt = 0, warehouseStockValue = 0

    for (const sub of subs as any[]) {
      budget += sub.budget || 0

      // Contracts: remaining to pay = total of non-rejected contracts - paid
      const { data: subContracts } = await supabase
        .from("contract")
        .select("id, total, status")
        .eq("project_id", sub.id)
        .neq("status", "rejected")
      const contractTotals = (subContracts || []).reduce((s: number, c: any) => s + (c.total || 0), 0)
      let contractPaid = 0
      if (subContracts && subContracts.length > 0) {
        const ids = subContracts.map((c: any) => c.id)
        const { data: cts } = await supabase
          .from("contract_transaction")
          .select("contact_id, transaction:transaction_id(amount)")
          .in("contact_id", ids)
        contractPaid = (cts || []).reduce((s: number, ct: any) => s + (ct.transaction?.amount || 0), 0)
      }
      contractsRemaining += contractTotals - contractPaid

      // Transactions for diff (matches table logic)
      const { data: subTxs } = await supabase
        .from("transaction")
        .select("amount, from")
        .eq("project_id", sub.id)
      const partnerAccId = sub.partner?.account_id
      ;(subTxs || []).forEach((t: any) => {
        if (partnerAccId && t.from === partnerAccId) txDifference += t.amount
        else txDifference -= t.amount
      })

      // Supplier debt for sub project: get suppliers (transfers in) and payments
      if (sub.partner?.warehouse_id) {
        const { data: subTransfers } = await supabase
          .from("transfer")
          .select(`id, from, transfer_item(qty, unit_amount)`)
          .eq("to", sub.partner.warehouse_id)
          .not("acepted_at", "is", null)
          .is("rejected_at", null)
        // Group by from warehouse
        const supplierWarehouseIds = new Set((subTransfers || []).map((t: any) => t.from))
        if (supplierWarehouseIds.size > 0) {
          const { data: supplierPartners } = await supabase
            .from("partner")
            .select("warehouse_id, account_id")
            .in("warehouse_id", Array.from(supplierWarehouseIds))
          const partnerByWh = new Map((supplierPartners || []).map((p: any) => [p.warehouse_id, p]))
          for (const wid of supplierWarehouseIds) {
            const partnerInfo = partnerByWh.get(wid)
            if (!partnerInfo) continue
            const transfersForSupplier = (subTransfers || []).filter((t: any) => t.from === wid)
            const transfersSum = transfersForSupplier.reduce((s: number, t: any) => {
              return s + (t.transfer_item || []).reduce((ss: number, ti: any) => ss + (ti.qty * ti.unit_amount), 0)
            }, 0)
            let paidToSupplier = 0
            if (partnerInfo.account_id) {
              const { data: pmts } = await supabase
                .from("transaction")
                .select("amount")
                .eq("to", partnerInfo.account_id)
                .eq("project_id", sub.id)
                .not("accepted_at", "is", null)
                .is("rejected_at", null)
              paidToSupplier = (pmts || []).reduce((s: number, t: any) => s + t.amount, 0)
            }
            supplierDebt += transfersSum - paidToSupplier
          }
        }
      }

      // Warehouse stock value
      if (sub.partner?.warehouse_id) {
        const { data: stockData } = await supabase
          .from("warehouse_item_stock")
          .select("item_id, stock_qty")
          .eq("warehouse_id", sub.partner.warehouse_id)
        for (const s of stockData || []) {
          const { data: tis } = await supabase
            .from("transfer_item")
            .select("unit_amount, transfer:transfer_id(acepted_at, to, from)")
            .eq("item_id", s.item_id)
            .not("transfer.acepted_at", "is", null)
            .or(`to.eq.${sub.partner.warehouse_id},from.eq.${sub.partner.warehouse_id}`, { foreignTable: "transfer" })
          const valid = (tis || []).map((t: any) => t.unit_amount).filter((p: any) => p != null)
          const avg = valid.length > 0 ? valid.reduce((a: number, b: number) => a + b, 0) / valid.length : 0
          warehouseStockValue += avg * s.stock_qty
        }
      }
    }

    setSubProjectAggregates({ budget, contractsRemaining, txDifference, supplierDebt, warehouseStockValue })
  }

  const fetchWarehouseStockValue = async () => {
    if (!project?.partner?.warehouse_id) {
      setWarehouseStockValue(0)
      return
    }
    const warehouseId = project.partner.warehouse_id
    const { data: stockData } = await supabase
      .from("warehouse_item_stock")
      .select("item_id, stock_qty")
      .eq("warehouse_id", warehouseId)
    if (!stockData || stockData.length === 0) {
      setWarehouseStockValue(0)
      return
    }
    // Compute avg_price per item from accepted transfer_items, then sum value
    const prices = await Promise.all(
      stockData.map(async (s: any) => {
        const { data: transferItems } = await supabase
          .from("transfer_item")
          .select("unit_amount, transfer:transfer_id(acepted_at, to, from)")
          .eq("item_id", s.item_id)
          .not("transfer.acepted_at", "is", null)
          .or(`to.eq.${warehouseId},from.eq.${warehouseId}`, { foreignTable: "transfer" })
        const valid = (transferItems || []).map((t: any) => t.unit_amount).filter((p: any) => p != null)
        const avg = valid.length > 0 ? valid.reduce((a: number, b: number) => a + b, 0) / valid.length : 0
        return avg * s.stock_qty
      })
    )
    setWarehouseStockValue(prices.reduce((a, b) => a + b, 0))
  }

  const fetchInternalAccounts = async () => {
    const { data } = await supabase.from("account").select("id").eq("internal", true)
    setInternalAccountIds(new Set((data || []).map(a => a.id)))
  }

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

  const fetchSuppliers = async () => {
    if (!project?.id || !project?.partner?.warehouse_id) return

    try {
      // Get all suppliers (partners of type supplier)
      const { data: partnersData, error: partnersError } = await supabase
        .from("partner")
        .select(`
          id,
          name,
          tin,
          type,
          warehouse_id,
          account_id,
          warehouse:warehouse_id(name),
          account:account_id(name, currency)
        `)
        .eq("type", "supplier")

      if (partnersError) throw partnersError

      // For each supplier, calculate stats based on transfers TO the project's warehouse
      const suppliersWithStats = await Promise.all(
        (partnersData || []).map(async (supplier) => {
          const stats: SupplierStats = {
            total_transfers: 0,
            total_transfers_sum: 0,
            approved_transfers: 0,
            approved_transfers_sum: 0,
            pending_transfers: 0,
            pending_transfers_sum: 0,
            total_transactions: 0,
          }

          // Get transfers FROM supplier's warehouse TO project's warehouse
          if (supplier.warehouse_id && project.partner?.warehouse_id) {
            const { data: transfers } = await supabase
              .from("transfer")
              .select(`
                id,
                acepted_at,
                rejected_at,
                transfer_item(qty, unit_price, unit_vat)
              `)
              .eq("from", supplier.warehouse_id)
              .eq("to", project.partner.warehouse_id)

            if (transfers) {
              stats.total_transfers = transfers.length

              transfers.forEach((transfer: any) => {
                const transferTotal = (transfer.transfer_item || []).reduce((sum: number, item: any) => {
                  return sum + (item.qty * item.unit_price) + (item.qty * item.unit_vat)
                }, 0)

                stats.total_transfers_sum += transferTotal

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

          // Get all transactions TO supplier's account tagged with this project
          // (regardless of which internal account paid)
          if (supplier.account_id) {
            const { data: transactions } = await supabase
              .from("transaction")
              .select("amount")
              .eq("to", supplier.account_id)
              .eq("project_id", project.id)
              .not("accepted_at", "is", null)
              .is("rejected_at", null)

            if (transactions) {
              stats.total_transactions = transactions.reduce((sum, t) => sum + t.amount, 0)
            }
          }

          return {
            ...supplier,
            stats
          }
        })
      )

      // Only show suppliers that have activity
      const activeSuppliers = suppliersWithStats.filter(
        s => (s.stats?.total_transfers || 0) > 0 || (s.stats?.total_transactions || 0) > 0
      )

      setSuppliers(activeSuppliers as unknown as Supplier[])
    } catch (error) {
      console.error("Error fetching suppliers:", error)
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
          <TabsTrigger value="suppliers">
            Մատակարարներ
          </TabsTrigger>
          <TabsTrigger value="transactions">
            Գործարքներ
            {transactions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {transactions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents">Փաստաթղթեր</TabsTrigger>
          <TabsTrigger value="tasks">
            Առաջադրանքներ
            {tasks.length > 0 && (
              <Badge variant="secondary" className="ml-2">{tasks.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Key Financial Indicators */}
          {(() => {
            const contractsRemaining = contracts.reduce((sum, c) => {
              if (c.status === "rejected") return sum
              return sum + c.total
            }, 0) - contracts.reduce((sum, c) => {
              return sum + (c.contract_transaction || []).reduce((s, ct) => s + (ct.transaction?.amount || 0), 0)
            }, 0)

            const partnerAccountId = project.partner?.account_id
            let txIncome = 0, txOutcome = 0
            transactions.forEach(t => {
              if (partnerAccountId && t.from === partnerAccountId) txIncome += t.amount
              else txOutcome += t.amount
            })
            const txDifference = txIncome - txOutcome

            const supplierDebt = suppliers.reduce((sum, s) => {
              return sum + ((s.stats?.total_transfers_sum || 0) - (s.stats?.total_transactions || 0))
            }, 0)

            // Combine self + sub-projects when this is a parent
            const totalBudget = (project.budget || 0) + (subProjectAggregates?.budget || 0)
            const totalContractsRemaining = contractsRemaining + (subProjectAggregates?.contractsRemaining || 0)
            const totalTxDifference = txDifference + (subProjectAggregates?.txDifference || 0)
            const totalSupplierDebt = supplierDebt + (subProjectAggregates?.supplierDebt || 0)
            const totalWarehouseStockValue = warehouseStockValue + (subProjectAggregates?.warehouseStockValue || 0)

            const renderValue = (own: number, total: number, label: string, colorClass?: string) => (
              <div>
                <p className="text-sm text-muted-foreground mb-1">{label}</p>
                <p className={`text-2xl font-bold ${colorClass || ""}`}>{formatCurrency(total)}</p>
                {subProjectAggregates && total !== own && (
                  <p className="text-xs text-muted-foreground mt-1">սեփական՝ {formatCurrency(own)}</p>
                )}
              </div>
            )

            return (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Բյուջե</p>
                      <p className="text-2xl font-bold">
                        {totalBudget ? formatCurrency(totalBudget) : "-"}
                      </p>
                      {subProjectAggregates && project.budget !== totalBudget && (
                        <p className="text-xs text-muted-foreground mt-1">
                          սեփական՝ {project.budget ? formatCurrency(project.budget) : "-"}
                        </p>
                      )}
                    </div>
                    {renderValue(
                      contractsRemaining,
                      totalContractsRemaining,
                      "Մնում է վճարել",
                      totalContractsRemaining > 0 ? "text-red-600" : "text-green-600"
                    )}
                    {renderValue(
                      txDifference,
                      totalTxDifference,
                      "Տարբերություն (գործարքներ)",
                      totalTxDifference >= 0 ? "text-green-600" : "text-red-600"
                    )}
                    {renderValue(
                      supplierDebt,
                      totalSupplierDebt,
                      "Մատակարարների պարտք",
                      totalSupplierDebt > 0 ? "text-red-600" : "text-green-600"
                    )}
                    {renderValue(
                      warehouseStockValue,
                      totalWarehouseStockValue,
                      "Պահեստի արժեք"
                    )}
                  </div>
                  {subProjectAggregates && (
                    <p className="text-xs text-muted-foreground mt-4">
                      * Արժեքները ներառում են այս նախագծի և բոլոր ենթանախագծերի տվյալները
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          {/* Project Summary Cards (Contracts by Position, Transactions In/Out, Supplier Transactions) */}
          {(() => {
            // Contracts by status
            const contractsByStatus: Record<string, number> = { planned: 0, "in progress": 0, done: 0 }
            contracts.forEach(c => {
              if (c.status in contractsByStatus) {
                contractsByStatus[c.status] += c.total || 0
              }
            })
            // Total actually paid via contract_transaction (regardless of contract.total)
            const totalPaid = contracts.reduce((sum, c) => {
              return sum + (c.contract_transaction || []).reduce((s, ct) => s + (ct.transaction?.amount || 0), 0)
            }, 0)

            // Transactions: matches transactions table logic
            // Income (+) = partner is sender (from === partner_account)
            // Outcome (-) = everything else
            const partnerAccountId = project.partner?.account_id
            let income = 0, outcome = 0
            transactions.forEach(t => {
              if (partnerAccountId && t.from === partnerAccountId) {
                income += t.amount
              } else {
                outcome += t.amount
              }
            })

            // Supplier transactions for this project
            const supplierAccountIds = new Set(
              suppliers.map(s => s.account_id).filter(Boolean) as number[]
            )
            let supplierPaid = 0
            transactions.forEach(t => {
              if (supplierAccountIds.has(t.to)) supplierPaid += t.amount
            })
            // Debt = sum of (transfers - paid) across suppliers (matches suppliers table balance)
            const supplierDebt = suppliers.reduce((sum, s) => {
              return sum + ((s.stats?.total_transfers_sum || 0) - (s.stats?.total_transactions || 0))
            }, 0)

            return (
              <div className="grid gap-4 md:grid-cols-3">
                {/* Contracts by Status */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Պայմանագրերի ամփոփում</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Պլանավորված:</span>
                        <span className="font-medium">{formatCurrency(contractsByStatus.planned)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Ընթացքի մեջ:</span>
                        <span className="font-medium">{formatCurrency(contractsByStatus["in progress"])}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Կատարված:</span>
                        <span className="font-medium">{formatCurrency(contractsByStatus.done)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <span className="font-medium">Փաստացի վճարված:</span>
                        <span className="font-bold text-green-600">{formatCurrency(totalPaid)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Մնում է վճարել:</span>
                        <span className={`font-bold ${(contractsByStatus.planned + contractsByStatus["in progress"] + contractsByStatus.done - totalPaid) > 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCurrency(contractsByStatus.planned + contractsByStatus["in progress"] + contractsByStatus.done - totalPaid)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Project Transactions In/Out */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Բոլոր գործարքներ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Մուտքեր:</span>
                        <span className="font-medium text-green-600">+{formatCurrency(income)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Ելքեր:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(outcome)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <span className="font-medium">Տարբերություն:</span>
                        <span className={`font-bold ${income - outcome >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(income - outcome)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Supplier Transactions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Մատակարարների գործարքներ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Արդեն վճարված:</span>
                        <span className="font-medium text-green-600">{formatCurrency(supplierPaid)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <span className="font-medium">Պարտք:</span>
                        <span className={`font-bold ${supplierDebt > 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCurrency(supplierDebt)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          })()}

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
              {contracts.length > 0 && (() => {
                const totalAmount = contracts.reduce((sum, c) => sum + c.total, 0)
                const totalPaid = contracts.reduce((sum, c) => {
                  return sum + (c.contract_transaction || []).reduce((s, ct) => s + (ct.transaction?.amount || 0), 0)
                }, 0)
                return (
                  <div className="flex justify-end items-center gap-8 pt-4 mt-4 border-t">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Ընդամենը գումար</p>
                      <p className="text-lg font-bold">{formatCurrency(totalAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Ընդամենը գործարքներ</p>
                      <p className="text-lg font-bold">{formatCurrency(totalPaid)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Մնացորդ</p>
                      <p className={`text-lg font-bold ${totalAmount - totalPaid > 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatCurrency(totalAmount - totalPaid)}
                      </p>
                    </div>
                  </div>
                )
              })()}
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

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5" />
                Մատակարարներ
              </CardTitle>
              <CardDescription>
                Նախագծի մատակարարների ցանկ և վիճակագրություն
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Handshake className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">Ակտիվ մատակարարներ չկան</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Անվանում</TableHead>
                      <TableHead>ՀՎՀՀ</TableHead>
                      <TableHead className="text-right">Տեղափոխություն (ընդամենը)</TableHead>
                      <TableHead className="text-right">Վճարումներ</TableHead>
                      <TableHead className="text-right">Մնացորդ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => {
                      const currency = supplier.account?.currency || "amd"
                      const balance = (supplier.stats?.total_transfers_sum || 0) - (supplier.stats?.total_transactions || 0)

                      return (
                        <TableRow
                          key={supplier.id}
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => {
                            setSelectedPartnerId(supplier.id)
                            setIsPartnerDrawerOpen(true)
                          }}
                        >
                          <TableCell className="font-medium">{supplier.name}</TableCell>
                          <TableCell>{supplier.tin || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-medium">
                                {formatCurrency(supplier.stats?.total_transfers_sum || 0, currency)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({supplier.stats?.total_transfers || 0})
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {formatCurrency(supplier.stats?.total_transactions || 0, currency)}
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
                      <TableCell colSpan={2} className="font-bold">Ընդամենը</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(
                          suppliers.reduce((sum, s) => sum + (s.stats?.total_transfers_sum || 0), 0),
                          "amd"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        {formatCurrency(
                          suppliers.reduce((sum, s) => sum + (s.stats?.total_transactions || 0), 0),
                          "amd"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {(() => {
                          const totalBalance = suppliers.reduce((sum, s) => {
                            const balance = (s.stats?.total_transfers_sum || 0) - (s.stats?.total_transactions || 0)
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
              )}
            </CardContent>
          </Card>
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
                      const isIncoming = transaction.from === project.partner?.account_id
                      return (
                        <TableRow
                          key={transaction.id}
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => {
                            setSelectedTransactionId(transaction.id)
                            setIsTransactionDrawerOpen(true)
                          }}
                        >
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
              {project.partner?.account_id && transactions.length > 0 && (() => {
                const totals = transactions.reduce((acc, t) => {
                  const currency = t.from_account?.currency || "amd"
                  const isIncoming = t.from === project.partner?.account_id
                  acc[currency] = (acc[currency] || 0) + (isIncoming ? t.amount : -t.amount)
                  return acc
                }, {} as Record<string, number>)
                return (
                  <div className="flex justify-end items-center gap-6 pt-4 mt-4 border-t">
                    <span className="font-medium">Ընդամենը</span>
                    <div className="flex flex-col items-end gap-1">
                      {Object.entries(totals).map(([currency, total]) => (
                        <span
                          key={currency}
                          className={`text-lg font-bold ${total >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {total >= 0 ? "+" : ""}{formatCurrency(total, currency)}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <ProjectDocuments projectId={project.id} />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Առաջադրանքներ</CardTitle>
                  <CardDescription>Նախագծի հետ կապված առաջադրանքներ</CardDescription>
                </div>
                <Button onClick={() => { setSelectedTask(null); setIsTaskDrawerOpen(true) }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ավելացնել առաջադրանք
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Առաջադրանքներ չկան</p>
                </div>
              ) : (() => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const future = tasks.filter(t => new Date(t.day).setHours(0,0,0,0) >= today.getTime())
                const past = tasks.filter(t => new Date(t.day).setHours(0,0,0,0) < today.getTime())
                const renderRow = (t: typeof tasks[0]) => {
                  const taskDate = new Date(t.day); taskDate.setHours(0, 0, 0, 0)
                  const isPast = taskDate.getTime() < today.getTime()
                  const colorClass = !isPast && !t.seen
                    ? "text-green-700 dark:text-green-400"
                    : !isPast && t.seen
                    ? "text-blue-700 dark:text-blue-400"
                    : isPast && t.seen
                    ? "text-muted-foreground"
                    : "text-red-700 dark:text-red-400"
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => { setSelectedTask(t); setIsTaskDrawerOpen(true) }}
                    >
                      <TableCell className="font-medium">{formatDate(t.day)}</TableCell>
                      <TableCell className={colorClass}>{t.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{t.text || "-"}</TableCell>
                      <TableCell>
                        {t.seen ? (
                          <Badge variant="secondary">Դիտված</Badge>
                        ) : (
                          <Badge variant="outline">Նոր</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                }
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">Ամսաթիվ</TableHead>
                        <TableHead>Վերնագիր</TableHead>
                        <TableHead>Նկարագրություն</TableHead>
                        <TableHead className="w-[100px]">Վիճակ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {future.map(renderRow)}
                      {(future.length > 0 || past.length > 0) && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={4} className="py-2">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px bg-primary" />
                              <Badge variant="default" className="bg-primary">Այսօր</Badge>
                              <div className="flex-1 h-px bg-primary" />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {past.map(renderRow)}
                    </TableBody>
                  </Table>
                )
              })()}
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

      {/* Partner Detail Drawer - filtered by project */}
      {project && (
        <PartnerEditDrawer
          open={isPartnerDrawerOpen}
          onOpenChange={setIsPartnerDrawerOpen}
          partnerId={selectedPartnerId}
          onSuccess={fetchSuppliers}
          projectId={project.id}
          projectWarehouseId={project.partner?.warehouse_id}
          projectAccountId={project.partner?.account_id}
        />
      )}

      {/* Transaction Detail Drawer */}
      <TransactionDetailDrawer
        open={isTransactionDrawerOpen}
        onOpenChange={setIsTransactionDrawerOpen}
        transactionId={selectedTransactionId}
        accountId={project?.partner?.account_id || undefined}
        onUpdate={fetchTransactions}
      />

      {/* Task Drawer */}
      <TaskDrawer
        open={isTaskDrawerOpen}
        onOpenChange={setIsTaskDrawerOpen}
        task={selectedTask}
        onSuccess={fetchTasks}
      />
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

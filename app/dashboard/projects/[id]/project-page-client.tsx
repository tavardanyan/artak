"use client"

import { useState, useEffect, Fragment } from "react"
import { createClient } from "@/lib/supabase/client"

export interface ProjectDashboardData {
  project_id: number
  warehouse_id: number | null
  budget: number
  parent_project: number | null
  tx_income: number
  tx_outcome: number
  contracts_planned: number
  contracts_in_progress: number
  contracts_done: number
  contracts_paid: number
  contracts_remaining: number
  supplier_debt_real: number
  supplier_debt_ximichit: number
  warehouse_stock_value: number
  transfer_vat_incoming: number
  sub_projects: ProjectDashboardData[]
}
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
  ChevronRight,
  ChevronDown,
  Trash2,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
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
  warehouse_id: number | null
  parent_project: number | null
  start: string | null
  end: string | null
  agreement_date: string | null
  budget: number | null
  status: string
  created_at: string
  oversight?: any
  warehouse?: { id: number; name: string }
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
  accepted_at?: string | null
  rejected_at?: string | null
  from_account?: {
    name: string
    currency: string
  }
  to_account?: {
    name: string
    currency: string
  }
}

interface ContractGroup {
  id: number
  project_id: number
  person_id: number
  name: string
}

interface ContractTransaction {
  id: number
  contact_id: number | null
  group_id?: number | null
  transaction_id: number
  transaction?: {
    id: number
    amount: number
    created_at: string
    note?: string | null
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
  group_id: number
  person?: {
    first_name: string
    last_lame: string | null
    position: string[] | null
  }
  contract_transaction?: ContractTransaction[]
}

interface Person {
  id: number
  first_name: string
  last_lame: string | null
  position: string[] | null
}

interface Contact {
  id: number
  first_name: string
  last_lame: string | null
  phone: string | null
  email: string | null
  position: string[] | null
  partner_id: number | null
}

interface SupplierStats {
  total_transfers: number
  total_transfers_sum: number
  total_transfers_sum_ximichit: number
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

export default function ProjectPageClient({
  projectId,
  initialDashboard,
}: {
  projectId: string
  initialDashboard: ProjectDashboardData
}) {
  const supabase = createClient()
  const { toast } = useToast()

  const [project, setProject] = useState<Project | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [contractGroups, setContractGroups] = useState<ContractGroup[]>([])
  const [groupPayments, setGroupPayments] = useState<Map<number, ContractTransaction[]>>(new Map())
  const [contacts, setContacts] = useState<Contact[]>([])
  const [staff, setStaff] = useState<Person[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  // Keep the selected tab visible in the horizontally-scrollable tab bar
  useEffect(() => {
    const el = document.querySelector(`[data-tab-value="${activeTab}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [activeTab])
  const [isContractDrawerOpen, setIsContractDrawerOpen] = useState(false)
  const [groupContractsByPerson, setGroupContractsByPerson] = useState(true)
  const [expandedContractGroups, setExpandedContractGroups] = useState<Set<string>>(new Set())
  // Accepted project payments to persons that are NOT linked to any contract, grouped per person
  const [unlinkedStaffPayments, setUnlinkedStaffPayments] = useState<{
    person_id: number
    name: string
    positions: string[]
    total: number
    count: number
  }[]>([])
  const [isEditContractDrawerOpen, setIsEditContractDrawerOpen] = useState(false)
  const [isEditProjectDrawerOpen, setIsEditProjectDrawerOpen] = useState(false)
  const [isPartnerDrawerOpen, setIsPartnerDrawerOpen] = useState(false)
  const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null)
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null)
  const [internalAccountIds, setInternalAccountIds] = useState<Set<number>>(new Set())
  const [warehouseStockValue, setWarehouseStockValue] = useState(initialDashboard.warehouse_stock_value || 0)
  const [incomingTransferStats, setIncomingTransferStats] = useState({
    totalAll: 0,
    totalWithVat: 0,
    vatTotal: initialDashboard.transfer_vat_incoming || 0,
    totalWithoutInvoice: 0,
  })
  const [tasks, setTasks] = useState<Array<{ id: number; title: string; text: string | null; project_id: number | null; day: string; seen: boolean }>>([])
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [subProjectAggregates, setSubProjectAggregates] = useState<{
    budget: number
    contractsRemaining: number
    txIncome: number
    txOutcome: number
    supplierDebt: number
    warehouseStockValue: number
  } | null>(() => {
    if (!initialDashboard.sub_projects || initialDashboard.sub_projects.length === 0) return null
    return initialDashboard.sub_projects.reduce(
      (acc, sub) => ({
        budget: acc.budget + (sub.budget || 0),
        contractsRemaining: acc.contractsRemaining + (sub.contracts_remaining || 0),
        txIncome: acc.txIncome + (sub.tx_income || 0),
        txOutcome: acc.txOutcome + (sub.tx_outcome || 0),
        supplierDebt: acc.supplierDebt + (sub.supplier_debt_real || 0),
        warehouseStockValue: acc.warehouseStockValue + (sub.warehouse_stock_value || 0),
      }),
      { budget: 0, contractsRemaining: 0, txIncome: 0, txOutcome: 0, supplierDebt: 0, warehouseStockValue: 0 }
    )
  })

  useEffect(() => {
    fetchProject()
    fetchInternalAccounts()
  }, [projectId])

  useEffect(() => {
    if (project?.id) {
      fetchTransactions()
      fetchContracts()
      fetchUnlinkedStaffPayments()
      fetchStaff()
      fetchContacts()
      fetchSuppliers()
      fetchWarehouseStockValue()
      fetchSubProjectAggregates()
      fetchTasks()
      fetchTransferVat()
    }
  }, [project])

  const fetchTransferVat = async () => {
    if (!project?.warehouse_id) {
      setIncomingTransferStats({ totalAll: 0, totalWithVat: 0, vatTotal: 0, totalWithoutInvoice: 0 })
      return
    }
    const wid = project.warehouse_id
    // All accepted incoming transfers into the project warehouse
    const { data } = await supabase
      .from("transfer")
      .select(`id, invoice_id, transfer_item(qty, unit_price, unit_vat)`)
      .eq("to", wid)
      .not("acepted_at", "is", null)
      .is("rejected_at", null)

    let totalAll = 0, totalWithVat = 0, vatTotal = 0, totalWithoutInvoice = 0
    ;(data || []).forEach((t: any) => {
      const items = t.transfer_item || []
      const total = items.reduce(
        (s: number, ti: any) => s + (ti.qty || 0) * ((ti.unit_price || 0) + (ti.unit_vat || 0)),
        0
      )
      const vat = items.reduce((s: number, ti: any) => s + (ti.qty || 0) * (ti.unit_vat || 0), 0)

      totalAll += total
      vatTotal += vat
      if (vat !== 0) totalWithVat += total
      if (!t.invoice_id) totalWithoutInvoice += total
    })
    setIncomingTransferStats({ totalAll, totalWithVat, vatTotal, totalWithoutInvoice })
  }

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
        warehouse_id,
        partner:partner_id(account_id, warehouse_id)
      `)
      .eq("parent_project", project.id)

    if (!subs || subs.length === 0) {
      setSubProjectAggregates(null)
      return
    }

    let budget = 0, contractsRemaining = 0, txIncome = 0, txOutcome = 0, supplierDebt = 0, warehouseStockValue = 0

    for (const sub of subs as any[]) {
      budget += sub.budget || 0

      // Contracts: remaining to pay = total of non-rejected contracts - paid
      const { data: subContracts } = await supabase
        .from("contract")
        .select("id, total, status, group_id")
        .eq("project_id", sub.id)
        .neq("status", "rejected")
      const contractTotals = (subContracts || []).reduce((s: number, c: any) => s + (c.total || 0), 0)
      let contractPaid = 0
      if (subContracts && subContracts.length > 0) {
        const ids = subContracts.map((c: any) => c.id)
        const gids = Array.from(new Set((subContracts || []).map((c: any) => c.group_id).filter(Boolean)))
        // Payments link either to a group or (legacy) directly to a contract
        const orParts: string[] = []
        if (gids.length > 0) orParts.push(`group_id.in.(${gids.join(",")})`)
        orParts.push(`and(group_id.is.null,contact_id.in.(${ids.join(",")}))`)
        const { data: cts } = await supabase
          .from("contract_transaction")
          .select("contact_id, group_id, transaction:transaction_id!inner(amount, accepted_at, rejected_at)")
          .or(orParts.join(","))
          .not("transaction.accepted_at", "is", null)
          .is("transaction.rejected_at", null)
        contractPaid = (cts || []).reduce((s: number, ct: any) => s + (ct.transaction?.amount || 0), 0)
      }
      contractsRemaining += contractTotals - contractPaid

      // Transactions for diff (matches table logic) — accepted only
      const { data: subTxs } = await supabase
        .from("transaction")
        .select("amount, from")
        .eq("project_id", sub.id)
        .not("accepted_at", "is", null)
        .is("rejected_at", null)
      const partnerAccId = sub.partner?.account_id
      ;(subTxs || []).forEach((t: any) => {
        if (partnerAccId && t.from === partnerAccId) txIncome += t.amount
        else txOutcome += t.amount
      })

      // Supplier debt for sub project: get suppliers (transfers in) and payments
      if (sub.warehouse_id) {
        const { data: subTransfers } = await supabase
          .from("transfer")
          .select(`id, from, transfer_item(qty, unit_amount)`)
          .eq("to", sub.warehouse_id)
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

      // Warehouse stock value - FIFO valuation, matches warehouse items balance total
      if (sub.warehouse_id) {
        const { data: fifoData } = await supabase
          .from("warehouse_item_fifo")
          .select("fifo_value")
          .eq("warehouse_id", sub.warehouse_id)
        warehouseStockValue += (fifoData || []).reduce((s: number, f: any) => s + (f.fifo_value || 0), 0)
      }
    }

    setSubProjectAggregates({ budget, contractsRemaining, txIncome, txOutcome, supplierDebt, warehouseStockValue })
  }

  const fetchWarehouseStockValue = async () => {
    if (!project?.warehouse_id) {
      setWarehouseStockValue(0)
      return
    }
    const warehouseId = project.warehouse_id
    // FIFO valuation from the warehouse_item_fifo view — matches the warehouse items table total
    const { data: fifoData } = await supabase
      .from("warehouse_item_fifo")
      .select("fifo_value")
      .eq("warehouse_id", warehouseId)
    setWarehouseStockValue((fifoData || []).reduce((s: number, f: any) => s + (f.fifo_value || 0), 0))
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
          warehouse:warehouse_id(id, name),
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
      const [contractsRes, groupsRes] = await Promise.all([
        supabase
          .from("contract")
          .select(`
            *,
            person:person_id(first_name, last_lame, position)
          `)
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("contract_group")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at"),
      ])

      if (contractsRes.error) throw contractsRes.error
      if (groupsRes.error) throw groupsRes.error

      const data = contractsRes.data || []
      const groups = (groupsRes.data || []) as ContractGroup[]

      // One query for all payments: group-linked rows plus legacy rows that
      // only carry a contract link
      const contractIds = data.map((c: any) => c.id)
      const groupIds = groups.map((g) => g.id)
      let payments: any[] = []
      if (groupIds.length > 0 || contractIds.length > 0) {
        const orParts: string[] = []
        if (groupIds.length > 0) orParts.push(`group_id.in.(${groupIds.join(",")})`)
        if (contractIds.length > 0) orParts.push(`and(group_id.is.null,contact_id.in.(${contractIds.join(",")}))`)
        const { data: ctData, error: ctError } = await supabase
          .from("contract_transaction")
          .select(`
            contact_id,
            group_id,
            transaction_id,
            transaction:transaction_id(
              id,
              amount,
              created_at,
              note,
              accepted_at,
              rejected_at,
              from_account:from(name, currency),
              to_account:to(name, currency)
            )
          `)
          .or(orParts.join(","))
        if (ctError) console.error("Error fetching contract transactions:", ctError)
        // Only accepted payments count as contract payments
        payments = (ctData || []).filter(
          (ct: any) => ct.transaction?.accepted_at && !ct.transaction?.rejected_at
        )
      }

      const groupIdOfContract = new Map<number, number>(data.map((c: any) => [c.id, c.group_id]))
      const byGroup = new Map<number, ContractTransaction[]>()
      const byContract = new Map<number, ContractTransaction[]>()
      payments.forEach((ct: any) => {
        const row: ContractTransaction = {
          id: ct.transaction_id,
          contact_id: ct.contact_id,
          group_id: ct.group_id,
          transaction_id: ct.transaction_id,
          transaction: ct.transaction,
        }
        const gid = ct.group_id ?? (ct.contact_id != null ? groupIdOfContract.get(ct.contact_id) : undefined)
        if (gid != null) {
          if (!byGroup.has(gid)) byGroup.set(gid, [])
          byGroup.get(gid)!.push(row)
        }
        if (ct.contact_id != null) {
          if (!byContract.has(ct.contact_id)) byContract.set(ct.contact_id, [])
          byContract.get(ct.contact_id)!.push(row)
        }
      })

      setContracts(data.map((c: any) => ({ ...c, contract_transaction: byContract.get(c.id) || [] })))
      setContractGroups(groups)
      setGroupPayments(byGroup)
    } catch (error) {
      console.error("Error fetching contracts:", error)
    }
  }

  const fetchUnlinkedStaffPayments = async () => {
    if (!project?.id) return
    try {
      // Accepted project payments with their contract links (empty link = "without contract")
      const { data: txs } = await supabase
        .from("transaction")
        .select("id, amount, to, contract_transaction(transaction_id)")
        .eq("project_id", project.id)
        .not("accepted_at", "is", null)
        .is("rejected_at", null)

      const unlinked = (txs || []).filter((t: any) => !(t.contract_transaction || []).length)
      if (unlinked.length === 0) {
        setUnlinkedStaffPayments([])
        return
      }

      // Keep only payments that went to a person's account
      const accountIds = Array.from(new Set(unlinked.map((t: any) => t.to)))
      const { data: personsData } = await supabase
        .from("person")
        .select("id, first_name, last_lame, position, account_id")
        .in("account_id", accountIds)

      const personByAccount = new Map((personsData || []).map((p: any) => [p.account_id, p]))
      const byPerson = new Map<number, { person_id: number; name: string; positions: string[]; total: number; count: number }>()
      unlinked.forEach((t: any) => {
        const p = personByAccount.get(t.to)
        if (!p) return
        const entry = byPerson.get(p.id) || {
          person_id: p.id,
          name: `${p.first_name} ${p.last_lame || ""}`.trim(),
          positions: p.position || [],
          total: 0,
          count: 0,
        }
        entry.total += t.amount
        entry.count += 1
        byPerson.set(p.id, entry)
      })
      setUnlinkedStaffPayments(Array.from(byPerson.values()))
    } catch (error) {
      console.error("Error fetching unlinked staff payments:", error)
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
    if (!project?.id || !project?.warehouse_id) return

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
            total_transfers_sum_ximichit: 0,
            approved_transfers: 0,
            approved_transfers_sum: 0,
            pending_transfers: 0,
            pending_transfers_sum: 0,
            total_transactions: 0,
          }

          // Get transfers FROM supplier's warehouse TO project's warehouse
          if (supplier.warehouse_id && project.warehouse_id) {
            const { data: transfers } = await supabase
              .from("transfer")
              .select(`
                id,
                acepted_at,
                rejected_at,
                ximichit,
                transfer_item(qty, unit_price, unit_vat)
              `)
              .eq("from", supplier.warehouse_id)
              .eq("to", project.warehouse_id)

            if (transfers) {
              stats.total_transfers = transfers.length

              transfers.forEach((transfer: any) => {
                const transferTotal = (transfer.transfer_item || []).reduce((sum: number, item: any) => {
                  return sum + (item.qty * item.unit_price) + (item.qty * item.unit_vat)
                }, 0)

                if (transfer.acepted_at && !transfer.rejected_at) {
                  // Only accepted transfers count toward totals and balance
                  if (transfer.ximichit) {
                    stats.total_transfers_sum_ximichit += transferTotal
                  } else {
                    stats.total_transfers_sum += transferTotal
                  }
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
        <div
          className="-mx-4 sm:mx-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        >
          <TabsList className="w-max max-w-none mx-4 sm:mx-0">
            <TabsTrigger value="overview" data-tab-value="overview">Ընդհանուր</TabsTrigger>
            <TabsTrigger value="contracts" data-tab-value="contracts">
              Աշխատանքներ
              {contracts.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px] sm:ml-2 sm:h-5 sm:px-2 sm:text-xs">
                  {contracts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contacts" data-tab-value="contacts">
              Կոնտակտներ
              {contacts.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px] sm:ml-2 sm:h-5 sm:px-2 sm:text-xs">
                  {contacts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="warehouse" data-tab-value="warehouse">
              Պահեստ
            </TabsTrigger>
            <TabsTrigger value="suppliers" data-tab-value="suppliers">
              Մատակարարներ
            </TabsTrigger>
            <TabsTrigger value="transactions" data-tab-value="transactions">
              Գործարքներ
              {transactions.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px] sm:ml-2 sm:h-5 sm:px-2 sm:text-xs">
                  {transactions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents" data-tab-value="documents">Փաստաթղթեր</TabsTrigger>
            <TabsTrigger value="tasks" data-tab-value="tasks">
              Առաջադրանքներ
              {tasks.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px] sm:ml-2 sm:h-5 sm:px-2 sm:text-xs">{tasks.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Key Financial Indicators */}
          {(() => {
            // Use SSR-supplied values when local state hasn't loaded yet
            const hasContracts = contracts.length > 0
            const hasTransactions = transactions.length > 0
            const hasSuppliers = suppliers.length > 0

            const contractsRemaining = hasContracts
              ? contracts.reduce((sum, c) => {
                  if (c.status === "rejected") return sum
                  return sum + c.total
                }, 0) - contracts.reduce((sum, c) => {
                  return sum + (c.contract_transaction || []).reduce((s, ct) => s + (ct.transaction?.amount || 0), 0)
                }, 0)
              : initialDashboard.contracts_remaining

            const partnerAccountId = project.partner?.account_id
            let txIncome = 0, txOutcome = 0
            if (hasTransactions) {
              transactions.forEach(t => {
                // Only accepted, non-rejected transactions count toward totals
                if (!t.accepted_at || t.rejected_at) return
                if (partnerAccountId && t.from === partnerAccountId) txIncome += t.amount
                else txOutcome += t.amount
              })
            } else {
              txIncome = initialDashboard.tx_income
              txOutcome = initialDashboard.tx_outcome
            }
            const txDifference = txIncome - txOutcome

            // supplierDebt split by ximichit: non-ximichit (real expense) vs ximichit (documented only)
            const supplierDebtReal = hasSuppliers
              ? suppliers.reduce((sum, s) => sum + ((s.stats?.total_transfers_sum || 0) - (s.stats?.total_transactions || 0)), 0)
              : initialDashboard.supplier_debt_real
            const supplierDebtXimichit = hasSuppliers
              ? suppliers.reduce((sum, s) => sum + (s.stats?.total_transfers_sum_ximichit || 0), 0)
              : initialDashboard.supplier_debt_ximichit
            const supplierDebt = supplierDebtReal // keep for compatibility

            // Combine self + sub-projects when this is a parent
            const totalBudget = (project.budget || 0) + (subProjectAggregates?.budget || 0)
            const totalTxIncome = txIncome + (subProjectAggregates?.txIncome || 0)
            const totalTxOutcome = txOutcome + (subProjectAggregates?.txOutcome || 0)
            const totalSupplierDebt = supplierDebt + (subProjectAggregates?.supplierDebt || 0)
            const totalWarehouseStockValue = warehouseStockValue + (subProjectAggregates?.warehouseStockValue || 0)

            // Real (non-ximichit) and ximichit expense totals
            const expensesReal = txOutcome + supplierDebtReal
            const expensesXimichit = supplierDebtXimichit
            const totalExpensesReal = totalTxOutcome + totalSupplierDebt
            const totalExpensesXimichit = expensesXimichit + 0 // sub-project ximichit split not tracked yet

            const renderValue = (own: number, total: number, label: string, colorClass?: string) => (
              <div>
                <p className="text-sm text-muted-foreground mb-1">{label}</p>
                <p className={`text-2xl font-bold ${colorClass || ""}`}>{formatCurrency(own)}</p>
                {subProjectAggregates && total !== own && (
                  <p className="text-xs text-muted-foreground mt-1">ընդհանուր՝ {formatCurrency(total)}</p>
                )}
              </div>
            )

            return (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Պայմանագրային արժեք</p>
                      <p className="text-2xl font-bold">
                        {project.budget ? formatCurrency(project.budget) : "-"}
                      </p>
                      {subProjectAggregates && project.budget !== totalBudget && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ընդհանուր՝ {totalBudget ? formatCurrency(totalBudget) : "-"}
                        </p>
                      )}
                    </div>
                    {renderValue(
                      txIncome,
                      totalTxIncome,
                      "Մուտքեր",
                      "text-green-600"
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Ծախսեր</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(expensesReal)}</p>
                      {expensesXimichit > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">+ խիմիչիտ՝ {formatCurrency(expensesXimichit)}</p>
                      )}
                      {subProjectAggregates && totalExpensesReal !== expensesReal && (
                        <p className="text-xs text-muted-foreground mt-1">ընդհանուր՝ {formatCurrency(totalExpensesReal)}</p>
                      )}
                    </div>
                    {renderValue(
                      warehouseStockValue,
                      totalWarehouseStockValue,
                      "Պահեստի արժեք"
                    )}
                  </div>
                  {subProjectAggregates && (
                    <p className="text-xs text-muted-foreground mt-4">
                      * «Ընդհանուր» արժեքները ներառում են այս նախագծի և բոլոր ենթանախագծերի տվյալները
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          {/* Project Summary Cards (Contracts by Position, Transactions In/Out, Supplier Transactions) */}
          {(() => {
            const hasContracts = contracts.length > 0
            // Contracts by status (use SSR data if local state is empty)
            const contractsByStatus: Record<string, number> = hasContracts
              ? { planned: 0, "in progress": 0, done: 0 }
              : {
                  planned: initialDashboard.contracts_planned,
                  "in progress": initialDashboard.contracts_in_progress,
                  done: initialDashboard.contracts_done,
                }
            if (hasContracts) {
              contracts.forEach(c => {
                if (c.status in contractsByStatus) {
                  contractsByStatus[c.status] += c.total || 0
                }
              })
            }
            // Total actually paid via contract_transaction (regardless of contract.total)
            const totalPaid = hasContracts
              ? contracts.reduce((sum, c) => {
                  return sum + (c.contract_transaction || []).reduce((s, ct) => s + (ct.transaction?.amount || 0), 0)
                }, 0)
              : initialDashboard.contracts_paid

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

                {/* Incomings List */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Մուտքերի ցանկ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const incomingsList = transactions
                        .filter(t => partnerAccountId && t.from === partnerAccountId)
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      if (incomingsList.length === 0) {
                        return <p className="text-sm text-muted-foreground py-2">Մուտքեր չկան</p>
                      }
                      return (
                        <div className="space-y-2 max-h-[180px] overflow-y-auto">
                          {incomingsList.map((t) => (
                            <div
                              key={t.id}
                              className="flex items-start justify-between gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded px-1 py-1"
                              onClick={() => {
                                setSelectedTransactionId(t.id)
                                setIsTransactionDrawerOpen(true)
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-muted-foreground">{formatDate(t.created_at)}</p>
                                {t.note && <p className="text-xs truncate">{t.note}</p>}
                              </div>
                              <span className="font-medium text-green-600 whitespace-nowrap">
                                +{formatCurrency(t.amount, t.from_account?.currency || "amd")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>

                {/* Supplier Transactions - commented out
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
                */}

                {/* Incoming transfers / VAT breakdown */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Մուտքային տեղափոխումներ / ԱԱՀ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(incomingTransferStats.vatTotal)}</p>
                    <p className="text-xs text-muted-foreground mb-3">ԱԱՀ ընդամենը</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Բոլոր մուտքերը</span>
                        <span className="font-medium">{formatCurrency(incomingTransferStats.totalAll)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">ԱԱՀ-ով մուտքեր</span>
                        <span className="font-medium">{formatCurrency(incomingTransferStats.totalWithVat)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Առանց հաշիվ-ապրանքագրի</span>
                        <span className="font-medium">{formatCurrency(incomingTransferStats.totalWithoutInvoice)}</span>
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
                <CardTitle className="text-sm font-medium">Պայմանագրի ամսաթիվ</CardTitle>
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
                <CardTitle className="text-sm font-medium">Պայմանագրի սկիզբ</CardTitle>
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
                <CardTitle className="text-sm font-medium">Պայմանագրի ավարտ</CardTitle>
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

          {/* Oversight inspectors */}
          {(() => {
            const ov = project.oversight as any
            const hasAny = (p: any) => p && (p.name || p.tin || p.number || p.director || p.contact)
            const tech = ov?.technical
            const author = ov?.author
            if (!hasAny(tech) && !hasAny(author)) return null

            const Field = ({ label, value }: { label: string; value?: string | null }) => (
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm mt-0.5">{value || "—"}</p>
              </div>
            )
            const PersonBlock = ({ title, p }: { title: string; p: any }) => (
              <div>
                <h4 className="font-medium text-sm mb-3">{title}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Field label="Անվանում" value={p?.name} /></div>
                  <Field label="ՀՎՀՀ" value={p?.tin} />
                  <Field label="Համար" value={p?.number} />
                  <Field label="Տնօրեն" value={p?.director} />
                  <Field label="Կոնտակտ" value={p?.contact} />
                </div>
              </div>
            )
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Հսկիչներ</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {hasAny(tech) && <PersonBlock title="Տեխնիկական հսկիչ" p={tech} />}
                  {hasAny(author) && <PersonBlock title="Հեղինակային հսկիչ" p={author} />}
                </CardContent>
              </Card>
            )
          })()}

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
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="group-contracts"
                      checked={groupContractsByPerson}
                      onCheckedChange={setGroupContractsByPerson}
                    />
                    <label htmlFor="group-contracts" className="text-sm cursor-pointer whitespace-nowrap">
                      Խմբավորել ըստ անձի
                    </label>
                  </div>
                  <Button onClick={() => setIsContractDrawerOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ավելացնել պայմանագիր
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {contracts.length === 0 && unlinkedStaffPayments.length === 0 ? (
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
                    {(() => {
                      const renderContractRow = (contract: Contract, indent = false) => {
                        const personName = contract.person
                          ? `${contract.person.first_name} ${contract.person.last_lame || ""}`.trim()
                          : "-"
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
                            <TableCell className={indent ? "pl-10" : undefined}>
                              {indent ? (
                                <span className="text-xs text-muted-foreground">№{contract.id}</span>
                              ) : (
                                <div>
                                  <p className="font-medium">{personName}</p>
                                  {contract.person?.position && contract.person.position.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      {contract.person.position.join(", ")}
                                    </p>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <p className="line-clamp-2">{contract.description}</p>
                              {!indent && (
                                <p className="text-xs text-muted-foreground">{groupNameOf(contract.group_id)}</p>
                              )}
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
                      }

                      const groupNameOf = (gid: number) =>
                        contractGroups.find((g) => g.id === gid)?.name || `Խումբ #${gid}`
                      const groupPaidOf = (gid: number) =>
                        (groupPayments.get(gid) || []).reduce((s, ct) => s + (ct.transaction?.amount || 0), 0)

                      // Contracts nested under their group, preserving group order of first appearance
                      const renderGroupedContracts = (personContracts: Contract[]) => {
                        const byGid: { gid: number; rows: Contract[] }[] = []
                        const gidIndex = new Map<number, number>()
                        personContracts.forEach((c) => {
                          if (!gidIndex.has(c.group_id)) {
                            gidIndex.set(c.group_id, byGid.length)
                            byGid.push({ gid: c.group_id, rows: [] })
                          }
                          byGid[gidIndex.get(c.group_id)!].rows.push(c)
                        })
                        return byGid.map(({ gid, rows }) => {
                          const gTotal = rows.reduce((s, c) => s + c.total, 0)
                          const gPaid = groupPaidOf(gid)
                          return (
                            <Fragment key={`cg-${gid}`}>
                              <TableRow className="bg-muted/30">
                                <TableCell className="pl-8">
                                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    {groupNameOf(gid)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {rows.length} պայմանագիր
                                </TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell className="text-right text-sm font-medium">{formatCurrency(gTotal)}</TableCell>
                                <TableCell className="text-right text-sm font-medium">
                                  {gPaid > 0 ? formatCurrency(gPaid) : <span className="text-muted-foreground font-normal">-</span>}
                                </TableCell>
                                <TableCell colSpan={3} />
                              </TableRow>
                              {rows.map((contract) => renderContractRow(contract, true))}
                            </Fragment>
                          )
                        })
                      }

                      if (!groupContractsByPerson) {
                        return contracts.map((contract) => renderContractRow(contract))
                      }

                      // Group contracts by person, preserving order of first appearance
                      const groups: { key: string; name: string; positions: string[]; contracts: Contract[] }[] = []
                      const groupIndex = new Map<string, number>()
                      contracts.forEach((contract) => {
                        const key = contract.person_id ? `p${contract.person_id}` : "none"
                        const name = contract.person
                          ? `${contract.person.first_name} ${contract.person.last_lame || ""}`.trim()
                          : "-"
                        if (!groupIndex.has(key)) {
                          groupIndex.set(key, groups.length)
                          groups.push({ key, name, positions: contract.person?.position || [], contracts: [] })
                        }
                        groups[groupIndex.get(key)!].contracts.push(contract)
                      })

                      // Persons paid on this project without any contract link get their own group
                      unlinkedStaffPayments.forEach((up) => {
                        const key = `p${up.person_id}`
                        if (!groupIndex.has(key)) {
                          groupIndex.set(key, groups.length)
                          groups.push({ key, name: up.name, positions: up.positions, contracts: [] })
                        }
                      })

                      const unlinkedByKey = new Map(unlinkedStaffPayments.map((up) => [`p${up.person_id}`, up]))

                      return groups.map((group) => {
                        const isExpanded = expandedContractGroups.has(group.key)
                        const unlinked = unlinkedByKey.get(group.key)
                        const groupTotal = group.contracts.reduce((s, c) => s + c.total, 0)
                        // Paid rolls up from contract groups (covers group-linked payments too)
                        const personGroupIds = Array.from(new Set(group.contracts.map((c) => c.group_id)))
                        const groupPaid =
                          personGroupIds.reduce((s, gid) => s + groupPaidOf(gid), 0) + (unlinked?.total || 0)
                        return (
                          <Fragment key={group.key}>
                            <TableRow
                              className="cursor-pointer bg-muted/50 hover:bg-accent"
                              onClick={() => {
                                setExpandedContractGroups((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(group.key)) next.delete(group.key)
                                  else next.add(group.key)
                                  return next
                                })
                              }}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  )}
                                  <div>
                                    <p className="font-medium">{group.name}</p>
                                    {group.positions.length > 0 && (
                                      <p className="text-xs text-muted-foreground">{group.positions.join(", ")}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {group.contracts.length} պայմանագիր
                                {unlinked ? ` + ${unlinked.count} առանց պայմ.` : ""}
                              </TableCell>
                              <TableCell />
                              <TableCell />
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(groupTotal)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {groupPaid > 0 ? formatCurrency(groupPaid) : <span className="text-muted-foreground font-normal">-</span>}
                              </TableCell>
                              <TableCell colSpan={3} />
                            </TableRow>
                            {isExpanded && renderGroupedContracts(group.contracts)}
                            {isExpanded && unlinked && (
                              <TableRow key={`${group.key}-unlinked`} className="text-muted-foreground">
                                <TableCell className="pl-10">
                                  <span className="text-xs">Առանց պայմանագրի</span>
                                </TableCell>
                                <TableCell className="text-sm">
                                  Նախագծին կապված վճարումներ առանց պայմանագրի
                                </TableCell>
                                <TableCell />
                                <TableCell />
                                <TableCell />
                                <TableCell className="text-right">
                                  <div>
                                    <p className="font-medium text-foreground">{formatCurrency(unlinked.total)}</p>
                                    <p className="text-xs">{unlinked.count} գործարք</p>
                                  </div>
                                </TableCell>
                                <TableCell colSpan={3} />
                              </TableRow>
                            )}
                          </Fragment>
                        )
                      })
                    })()}
                  </TableBody>
                </Table>
              )}
              {(contracts.length > 0 || unlinkedStaffPayments.length > 0) && (() => {
                const totalAmount = contracts.reduce((sum, c) => sum + c.total, 0)
                const unlinkedTotal = unlinkedStaffPayments.reduce((sum, up) => sum + up.total, 0)
                const totalPaid = contracts.reduce((sum, c) => {
                  return sum + (c.contract_transaction || []).reduce((s, ct) => s + (ct.transaction?.amount || 0), 0)
                }, 0) + unlinkedTotal
                return (
                  <div className="flex justify-end items-center gap-8 pt-4 mt-4 border-t">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Ընդամենը գումար</p>
                      <p className="text-lg font-bold">{formatCurrency(totalAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Ընդամենը գործարքներ</p>
                      <p className="text-lg font-bold">{formatCurrency(totalPaid)}</p>
                      {unlinkedTotal > 0 && (
                        <p className="text-xs text-muted-foreground">որից առանց պայմ.՝ {formatCurrency(unlinkedTotal)}</p>
                      )}
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
                          {contact.position && contact.position.length > 0 ? contact.position.join(", ") : "-"}
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
          {!project.warehouse_id ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                <p className="text-muted-foreground">Նախագիծը պահեստ չունի</p>
              </CardContent>
            </Card>
          ) : (
            <WarehouseContent
              warehouseId={project.warehouse_id}
              warehouseName={project.warehouse?.name || "Պահեստ"}
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
          group={contractGroups.find((g) => g.id === selectedContract.group_id) || null}
          groupContracts={contracts.filter((c) => c.group_id === selectedContract.group_id)}
          groupPaymentRows={groupPayments.get(selectedContract.group_id) || []}
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
          projectWarehouseId={project.warehouse_id}
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

interface ContractLine {
  description: string
  qty: string
  unit: string
  price: string
  total: string
}

const emptyContractLine = (): ContractLine => ({ description: "", qty: "", unit: "", price: "", total: "" })

// Edit drawer lines map to existing contract rows; new lines have no contractId yet
interface EditContractLine extends ContractLine {
  contractId: number | null
  txCount: number
}

const emptyEditContractLine = (): EditContractLine => ({ ...emptyContractLine(), contractId: null, txCount: 0 })

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
  const [status, setStatus] = useState("planned")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [lines, setLines] = useState<ContractLine[]>([emptyContractLine()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [personGroups, setPersonGroups] = useState<ContractGroup[]>([])
  // "new" = create a new group; otherwise an existing group id as string
  const [groupChoice, setGroupChoice] = useState("")
  const [newGroupName, setNewGroupName] = useState("")

  const supabase = createClient()
  const { toast } = useToast()

  // Groups belong to (project, person) — refresh the list when the person changes
  useEffect(() => {
    if (!personId) {
      setPersonGroups([])
      setGroupChoice("")
      return
    }
    const fetchGroups = async () => {
      const { data } = await supabase
        .from("contract_group")
        .select("*")
        .eq("project_id", parseInt(projectId))
        .eq("person_id", parseInt(personId))
        .order("created_at")
      const groups = (data || []) as ContractGroup[]
      setPersonGroups(groups)
      setGroupChoice(groups.length === 0 ? "new" : "")
    }
    fetchGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId])

  const updateLine = (index: number, field: keyof ContractLine, value: string) => {
    setLines((prev) => {
      const next = [...prev]
      const line = { ...next[index], [field]: value }
      // Auto-calculate total when qty or price changes
      if (field === "qty" || field === "price") {
        const t = parseFormattedNumber(line.qty) * parseFormattedNumber(line.price)
        if (t > 0) line.total = handleNumberInput(t.toString())
      }
      next[index] = line
      return next
    })
  }

  const grandTotal = lines.reduce((sum, l) => sum + parseFormattedNumber(l.total), 0)

  const resetForm = () => {
    setPersonId("")
    setStatus("planned")
    setStartDate("")
    setEndDate("")
    setLines([emptyContractLine()])
    setPersonGroups([])
    setGroupChoice("")
    setNewGroupName("")
  }

  const handleSubmit = async () => {
    if (!personId) {
      toast({ title: "Սխալ", description: "Խնդրում ենք ընտրել աշխատակցին", variant: "destructive" })
      return
    }
    if (!groupChoice) {
      toast({ title: "Սխալ", description: "Խնդրում ենք ընտրել պայմանագրի խումբը", variant: "destructive" })
      return
    }
    if (groupChoice === "new" && !newGroupName.trim()) {
      toast({ title: "Սխալ", description: "Խնդրում ենք լրացնել խմբի անունը", variant: "destructive" })
      return
    }

    // Each non-empty line becomes a separate contract
    const filledLines = lines.filter(
      (l) => l.description.trim() || l.qty || l.price || l.total
    )
    if (filledLines.length === 0) {
      toast({ title: "Սխալ", description: "Ավելացրեք նվազագույնը մեկ ծառայություն", variant: "destructive" })
      return
    }
    const invalid = filledLines.find((l) => !l.description.trim() || parseFormattedNumber(l.total) <= 0)
    if (invalid) {
      toast({
        title: "Սխալ",
        description: "Յուրաքանչյուր տող պետք է ունենա նկարագրություն և ընդհանուր գումար",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Resolve the contract group: reuse the selected one or create it now
      let groupId: number
      if (groupChoice === "new") {
        const { data: newGroup, error: groupError } = await supabase
          .from("contract_group")
          .insert({
            project_id: parseInt(projectId),
            person_id: parseInt(personId),
            name: newGroupName.trim(),
          })
          .select("id")
          .single()
        if (groupError || !newGroup) throw groupError || new Error("Group insert returned no row")
        groupId = newGroup.id
      } else {
        groupId = parseInt(groupChoice)
      }

      const payload = filledLines.map((l) => ({
        project_id: parseInt(projectId),
        person_id: parseInt(personId),
        group_id: groupId,
        description: l.description.trim(),
        price: l.price ? parseFormattedNumber(l.price) : null,
        unit: l.unit || null,
        qty: l.qty ? parseFormattedNumber(l.qty) : null,
        total: parseFormattedNumber(l.total),
        status,
        start: startDate ? new Date(startDate).toISOString() : null,
        end: endDate ? new Date(endDate).toISOString() : null,
      }))

      const { error } = await supabase.from("contract").insert(payload)
      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: payload.length === 1
          ? "Պայմանագիրը հաջողությամբ ավելացվեց"
          : `Ստեղծվեց ${payload.length} պայմանագիր`,
      })

      resetForm()
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error creating contracts:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց ստեղծել պայմանագրերը",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[70vw]">
        <SheetHeader>
          <SheetTitle>Ստեղծել պայմանագրեր</SheetTitle>
          <SheetDescription>
            Ավելացրեք ծառայությունները տողերով․ յուրաքանչյուր տողը կդառնա առանձին պայմանագիր
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-6">
          <div className="grid grid-cols-2 gap-4">
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
                      {person.position && person.position.length > 0 && (
                        <span className="text-muted-foreground text-xs ml-2">
                          ({person.position.join(", ")})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-group">
                Պայմանագրի խումբ <span className="text-destructive">*</span>
              </Label>
              <Select value={groupChoice} onValueChange={setGroupChoice} disabled={!personId}>
                <SelectTrigger id="contract-group">
                  <SelectValue placeholder={personId ? "Ընտրել խումբը" : "Նախ ընտրեք աշխատակցին"} />
                </SelectTrigger>
                <SelectContent>
                  {personGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id.toString()}>
                      {g.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Նոր խումբ</SelectItem>
                </SelectContent>
              </Select>
              {groupChoice === "new" && (
                <Input
                  placeholder="Խմբի անունը"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
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

          {/* Service lines — each becomes a separate contract */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label>Ծառայություններ</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, emptyContractLine()])}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ավելացնել տող
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Ծառայություն</TableHead>
                    <TableHead className="w-[10%]">Քնկ.</TableHead>
                    <TableHead className="w-[12%]">Միավոր</TableHead>
                    <TableHead className="w-[14%]">Գին</TableHead>
                    <TableHead className="w-[16%]">Ընդամենը</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          placeholder="Ծառայության նկարագրությունը"
                          value={line.description}
                          onChange={(e) => updateLine(index, "description", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          placeholder="0"
                          value={line.qty}
                          onChange={(e) => updateLine(index, "qty", handleNumberInput(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="օր, մ²..."
                          value={line.unit}
                          onChange={(e) => updateLine(index, "unit", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          placeholder="0"
                          value={line.price}
                          onChange={(e) => updateLine(index, "price", handleNumberInput(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          placeholder="0"
                          value={line.total}
                          onChange={(e) => updateLine(index, "total", handleNumberInput(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                          disabled={lines.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end items-center gap-3 pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {lines.filter((l) => l.description.trim()).length} պայմանագիր • Ընդհանուր գումար
              </span>
              <span className="text-xl font-bold">{grandTotal.toLocaleString()} ֏</span>
            </div>
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
  group,
  groupContracts,
  groupPaymentRows,
  staff,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: Contract
  group: ContractGroup | null
  groupContracts: Contract[]
  groupPaymentRows: ContractTransaction[]
  staff: Person[]
  onSuccess: () => void
}) {
  const [personId, setPersonId] = useState(contract.person_id.toString())
  const [status, setStatus] = useState(contract.status)
  const [startDate, setStartDate] = useState(
    contract.start ? new Date(contract.start).toISOString().split("T")[0] : ""
  )
  const [endDate, setEndDate] = useState(
    contract.end ? new Date(contract.end).toISOString().split("T")[0] : ""
  )
  const [groupName, setGroupName] = useState("")
  const [lines, setLines] = useState<EditContractLine[]>([])
  const [removedIds, setRemovedIds] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  // The whole service list of this contract group is edited at once; shared
  // fields (person, status, dates, group name) initialize from the clicked
  // contract's group and apply to every line on save
  useEffect(() => {
    if (!open) return
    setPersonId(contract.person_id.toString())
    setStatus(contract.status)
    setStartDate(contract.start ? new Date(contract.start).toISOString().split("T")[0] : "")
    setEndDate(contract.end ? new Date(contract.end).toISOString().split("T")[0] : "")
    setGroupName(group?.name || "")
    setLines(
      groupContracts.map((c) => ({
        contractId: c.id,
        description: c.description,
        qty: c.qty ? handleNumberInput(c.qty.toString()) : "",
        unit: c.unit || "",
        price: c.price ? handleNumberInput(c.price.toString()) : "",
        total: handleNumberInput(c.total.toString()),
        txCount: (c.contract_transaction || []).length,
      }))
    )
    setRemovedIds([])
    // groupContracts comes from the same fetch as contract — re-init on open is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, open])

  const updateLine = (index: number, field: keyof ContractLine, value: string) => {
    setLines((prev) => {
      const next = [...prev]
      const line = { ...next[index], [field]: value }
      // Auto-calculate total when qty or price changes
      if (field === "qty" || field === "price") {
        const t = parseFormattedNumber(line.qty) * parseFormattedNumber(line.price)
        if (t > 0) line.total = handleNumberInput(t.toString())
      }
      next[index] = line
      return next
    })
  }

  const removeLine = (index: number) => {
    const line = lines[index]
    if (line.contractId) setRemovedIds((prev) => [...prev, line.contractId!])
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const grandTotal = lines.reduce((sum, l) => sum + parseFormattedNumber(l.total), 0)

  const handleSubmit = async () => {
    if (!personId) {
      toast({ title: "Սխալ", description: "Խնդրում ենք ընտրել աշխատակցին", variant: "destructive" })
      return
    }

    // Blank added lines are ignored; existing lines must stay valid
    const kept = lines.filter(
      (l) => l.contractId || l.description.trim() || l.qty || l.price || l.total
    )
    const invalid = kept.find((l) => !l.description.trim() || parseFormattedNumber(l.total) <= 0)
    if (invalid) {
      toast({
        title: "Սխալ",
        description: "Յուրաքանչյուր տող պետք է ունենա նկարագրություն և ընդհանուր գումար",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Group name / person live on the group row
      if (group && (groupName.trim() !== group.name || parseInt(personId) !== group.person_id)) {
        const { error } = await supabase
          .from("contract_group")
          .update({ name: groupName.trim() || group.name, person_id: parseInt(personId) })
          .eq("id", group.id)
        if (error) throw error
      }

      const shared = {
        person_id: parseInt(personId),
        status,
        start: startDate ? new Date(startDate).toISOString() : null,
        end: endDate ? new Date(endDate).toISOString() : null,
      }
      const lineFields = (l: EditContractLine) => ({
        description: l.description.trim(),
        price: l.price ? parseFormattedNumber(l.price) : null,
        unit: l.unit || null,
        qty: l.qty ? parseFormattedNumber(l.qty) : null,
        total: parseFormattedNumber(l.total),
      })

      if (removedIds.length > 0) {
        const { error } = await supabase.from("contract").delete().in("id", removedIds)
        if (error) throw error
      }

      for (const line of kept.filter((l) => l.contractId)) {
        const { error } = await supabase
          .from("contract")
          .update({ ...shared, ...lineFields(line) })
          .eq("id", line.contractId!)
        if (error) throw error
      }

      const inserts = kept
        .filter((l) => !l.contractId)
        .map((line) => ({
          ...shared,
          ...lineFields(line),
          project_id: contract.project_id,
          group_id: contract.group_id,
        }))
      if (inserts.length > 0) {
        const { error } = await supabase.from("contract").insert(inserts)
        if (error) throw error
      }

      toast({ title: "Հաջողություն", description: "Պայմանագրերը հաջողությամբ թարմացվեցին" })

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error updating contracts:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց թարմացնել պայմանագրերը",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-[70vw]">
        <SheetHeader>
          <SheetTitle>Խմբագրել պայմանագրերի խումբը</SheetTitle>
          <SheetDescription>
            Խմբի ծառայությունների ցանկը․ յուրաքանչյուր տողն առանձին պայմանագիր է
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">
                Խմբի անունը <span className="text-destructive">*</span>
              </Label>
              <Input
                id="group-name"
                placeholder="Խմբի անունը"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

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
                      {person.position && person.position.length > 0 && (
                        <span className="text-muted-foreground text-xs ml-2">
                          ({person.position.join(", ")})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {/* Service lines — the person's full list; each line is a separate contract */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label>Ծառայություններ</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, emptyEditContractLine()])}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ավելացնել տող
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Ծառայություն</TableHead>
                    <TableHead className="w-[10%]">Քնկ.</TableHead>
                    <TableHead className="w-[12%]">Միավոր</TableHead>
                    <TableHead className="w-[14%]">Գին</TableHead>
                    <TableHead className="w-[16%]">Ընդամենը</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={line.contractId ?? `new-${index}`}>
                      <TableCell>
                        <Input
                          placeholder="Ծառայության նկարագրությունը"
                          value={line.description}
                          onChange={(e) => updateLine(index, "description", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          placeholder="0"
                          value={line.qty}
                          onChange={(e) => updateLine(index, "qty", handleNumberInput(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="օր, մ²..."
                          value={line.unit}
                          onChange={(e) => updateLine(index, "unit", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          placeholder="0"
                          value={line.price}
                          onChange={(e) => updateLine(index, "price", handleNumberInput(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          placeholder="0"
                          value={line.total}
                          onChange={(e) => updateLine(index, "total", handleNumberInput(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          disabled={lines.length === 1 || line.txCount > 0}
                          title={line.txCount > 0 ? "Հնարավոր չէ ջնջել․ ունի կապված գործարքներ" : undefined}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end items-center gap-3 pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {lines.filter((l) => l.description.trim()).length} պայմանագիր
                {removedIds.length > 0 ? ` • կջնջվի ${removedIds.length}` : ""} • Ընդհանուր գումար
              </span>
              <span className="text-xl font-bold">{grandTotal.toLocaleString()} ֏</span>
            </div>
          </div>

          {/* Contract Transactions Section — all payments linked to this group */}
          {(() => {
            const allTransactions = groupPaymentRows
            if (allTransactions.length === 0) return null
            const paidTotal = allTransactions.reduce((sum, ct) => sum + (ct.transaction?.amount || 0), 0)
            const contractsTotal = groupContracts.reduce((sum, c) => sum + c.total, 0)
            return (
              <div className="space-y-2 pt-4 border-t">
                <Label>Գործարքներ ({allTransactions.length})</Label>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {allTransactions.map((ct) => (
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
                      {ct.transaction?.note && (
                        <p className="text-xs whitespace-pre-wrap">{ct.transaction.note}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Ընդամենը վճարված:</span>
                  <span className="font-bold">{formatCurrency(paidTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Մնացած:</span>
                  <span className="font-medium">{formatCurrency(contractsTotal - paidTotal)}</span>
                </div>
              </div>
            )
          })()}
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

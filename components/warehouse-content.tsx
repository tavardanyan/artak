"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { handleNumberInput, parseFormattedNumber } from "@/lib/utils/number-format"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { LabelCell } from "@/components/label-cell"
import { LabelFilter } from "@/components/label-filter"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, ArrowLeft, Package, TruckIcon, Plus, Trash2, Search, ChevronsUpDown, Check, Scissors, Download } from "lucide-react"
import * as XLSX from "xlsx"
import { cn } from "@/lib/utils"
import { SplitTransferModal } from "@/components/split-transfer-modal"
import { XimichitModal } from "@/components/ximichit-modal"
import { TransferDetailDrawer } from "@/components/transfer-detail-drawer"

interface Transfer {
  id: number
  from: number
  to: number
  created_at: string
  delivered_at: string | null
  acepted_at: string | null
  rejected_at: string | null
  ximichit?: boolean
  invoice_id: string | null
  label: number
  from_warehouse?: { name: string }
  to_warehouse?: { name: string }
  invoice?: {
    id: string
    serial_no: string
    supplier_tin: string
    total: number
    created_at: string
    issued_at: string | null
    delivered_at: string | null
    destination_address: string | null
    partner?: {
      name: string
      tin: string
      address: string | null
    }
  }
}

interface TransferItem {
  item_id: number
  transfer_id: number
  qty: number
  unit_price: number
  unit_vat: number
  unit_amount: number
  total_price: number
  total_vat: number
  total: number
  item?: { name: string; code: string; unit?: string }
}

interface WarehouseItem {
  warehouse_id: number
  item_id: number
  stock_qty: number
  item?: { name: string; code: string; unit: string; label: number; is_service?: boolean }
  last_price?: number
  avg_price?: number
  fifo_value?: number
}

interface ItemTransfer {
  id: number
  from: number
  to: number
  created_at: string
  delivered_at: string | null
  acepted_at: string | null
  rejected_at: string | null
  qty: number
  total: number
  from_warehouse?: { name: string }
  to_warehouse?: { name: string }
}

interface Item {
  id: number
  name: string
  code: string
  unit: string
}

interface Warehouse {
  id: number
  name: string
  type: string
  partner?: { account_id: number | null }
}

interface NewTransferItem {
  itemName: string
  itemId: number | null
  unit: string
  // Kept as strings so intermediate input like "2." isn't lost while typing
  qty: string
  unitPrice: string
  unitVat: string
  // For newly created items: mark as a service rather than a physical good
  isService: boolean
}

interface WarehouseContentProps {
  warehouseId: number
  warehouseName: string
  initialTransferData?: {
    fromWarehouse?: number
    toWarehouse?: number
    createTransaction?: boolean
    fromAccount?: number
    toAccount?: number
    openDrawer?: boolean
  }
}

export function WarehouseContent({ warehouseId, warehouseName, initialTransferData }: WarehouseContentProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([])
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null)
  const [transferItems, setTransferItems] = useState<TransferItem[]>([])
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null)
  const [itemTransfers, setItemTransfers] = useState<ItemTransfer[]>([])
  const [isTransferDrawerOpen, setIsTransferDrawerOpen] = useState(false)
  const [isItemDrawerOpen, setIsItemDrawerOpen] = useState(false)
  const [historyTransferId, setHistoryTransferId] = useState<number | null>(null)
  const [isHistoryTransferOpen, setIsHistoryTransferOpen] = useState(false)
  const [isCreateTransferDrawerOpen, setIsCreateTransferDrawerOpen] = useState(false)
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false)
  const [isXimichitModalOpen, setIsXimichitModalOpen] = useState(false)
  const [fromWarehouseStock, setFromWarehouseStock] = useState<Record<number, number>>({})
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set())
  const [fromWhTab, setFromWhTab] = useState<"internal" | "partners" | "suppliers">("internal")
  const [toWhTab, setToWhTab] = useState<"internal" | "partners" | "suppliers">("internal")
  const [destWhTab, setDestWhTab] = useState<"internal" | "partners" | "suppliers">("internal")
  const [loading, setLoading] = useState(true)
  const [transferLabelFilter, setTransferLabelFilter] = useState<number | null>(null)
  const [itemLabelFilter, setItemLabelFilter] = useState<number | null>(null)
  const [itemSearchQuery, setItemSearchQuery] = useState("")

  // Create transfer state
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [accounts, setAccounts] = useState<{ id: number; name: string; currency: string; internal: boolean }[]>([])
  const [fromWarehouse, setFromWarehouse] = useState<number>(warehouseId)
  const [toWarehouse, setToWarehouse] = useState<number | null>(null)
  const [newTransferItems, setNewTransferItems] = useState<NewTransferItem[]>([
    { itemName: "", itemId: null, unit: "", qty: "1", unitPrice: "", unitVat: "", isService: false }
  ])
  const [createTransaction, setCreateTransaction] = useState(false)
  const [fromAccount, setFromAccount] = useState<number | null>(null)
  const [toAccount, setToAccount] = useState<number | null>(null)

  const { toast } = useToast()
  const supabase = createClient()

  // Fetch transfers for this warehouse
  const fetchTransfers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("transfer")
        .select(`
          *,
          from_warehouse:warehouse!transfer_from_fkey(name),
          to_warehouse:warehouse!transfer_to_fkey(name),
          invoice:invoice!transfer_invoice_id_fkey(
            id,
            serial_no,
            supplier_tin,
            total,
            created_at,
            issued_at,
            delivered_at,
            destination_address,
            partner:partner!invoice_supplier_tin_fkey(name, tin, address)
          )
        `)
        .or(`from.eq.${warehouseId},to.eq.${warehouseId}`)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching transfers:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց բեռնել տեղափոխումները",
          variant: "destructive",
        })
        return
      }

      setTransfers(data || [])
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch warehouse items (stock)
  const fetchWarehouseItems = async () => {
    try {
      // First, get the stock data (including zero quantities)
      const { data: stockData, error: stockError } = await supabase
        .from("warehouse_item_stock")
        .select("*")
        .eq("warehouse_id", warehouseId)

      if (stockError) {
        console.error("Error fetching warehouse stock:", stockError)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց բեռնել ապրանքները",
          variant: "destructive",
        })
        return
      }

      if (!stockData || stockData.length === 0) {
        setWarehouseItems([])
        return
      }

      // Get item IDs from stock data
      const itemIds = stockData.map(s => s.item_id)

      // Fetch item details
      const { data: itemsData, error: itemsError } = await supabase
        .from("item")
        .select("id, name, code, unit, label, is_service")
        .in("id", itemIds)

      if (itemsError) {
        console.error("Error fetching items:", itemsError)
        return
      }

      // FIFO valuation of remaining stock (single query, computed in the DB view)
      const { data: fifoData } = await supabase
        .from("warehouse_item_fifo")
        .select("item_id, fifo_value")
        .eq("warehouse_id", warehouseId)
      const fifoByItem = new Map<number, number>(
        (fifoData || []).map((f: { item_id: number; fifo_value: number }) => [f.item_id, f.fifo_value])
      )

      // Last price per item: most recent accepted transfer touching this warehouse
      const { data: recentTransferItems } = await supabase
        .from("transfer_item")
        .select("item_id, unit_amount, transfer:transfer_id!inner(acepted_at, to, from)")
        .in("item_id", itemIds)
        .not("transfer.acepted_at", "is", null)
        .or(`to.eq.${warehouseId},from.eq.${warehouseId}`, { foreignTable: "transfer" })
        .order("transfer(acepted_at)", { ascending: false })
      const lastPriceByItem = new Map<number, number>()
      for (const ti of (recentTransferItems || []) as { item_id: number; unit_amount: number | null }[]) {
        if (!lastPriceByItem.has(ti.item_id) && ti.unit_amount != null) {
          lastPriceByItem.set(ti.item_id, ti.unit_amount)
        }
      }

      // Combine stock, item, and price data
      const combined = stockData.map(stock => {
        const itemInfo = itemsData?.find(item => item.id === stock.item_id)
        const fifoValue = fifoByItem.get(stock.item_id)

        return {
          ...stock,
          item: itemInfo,
          last_price: lastPriceByItem.get(stock.item_id),
          // Unit cost of the remaining stock under FIFO
          avg_price: fifoValue != null && stock.stock_qty > 0 ? fifoValue / stock.stock_qty : undefined,
          fifo_value: fifoValue ?? undefined,
        }
      })

      setWarehouseItems(combined)
    } catch (error) {
      console.error("Error:", error)
    }
  }

  const setTransferLabel = async (transferId: number, label: number) => {
    setTransfers((prev) => prev.map((t) => (t.id === transferId ? { ...t, label } : t)))
    if (selectedTransfer?.id === transferId) setSelectedTransfer({ ...selectedTransfer, label })
    const { error } = await supabase.from("transfer").update({ label }).eq("id", transferId)
    if (error) {
      toast({ title: "Սխալ", description: error.message, variant: "destructive" })
      fetchTransfers()
    }
  }

  const setItemLabel = async (itemId: number, label: number) => {
    setWarehouseItems((prev) => prev.map((wi) =>
      wi.item_id === itemId && wi.item ? { ...wi, item: { ...wi.item, label } } : wi
    ))
    if (selectedItem?.item_id === itemId && selectedItem.item) {
      setSelectedItem({ ...selectedItem, item: { ...selectedItem.item, label } })
    }
    const { error } = await supabase.from("item").update({ label }).eq("id", itemId)
    if (error) {
      toast({ title: "Սխալ", description: error.message, variant: "destructive" })
      fetchWarehouseItems()
    }
  }

  const visibleTransfers = transferLabelFilter == null
    ? transfers
    : transfers.filter((t) => (t.label ?? 0) === transferLabelFilter)
  const visibleWarehouseItems = (itemLabelFilter == null
    ? warehouseItems
    : warehouseItems.filter((wi) => (wi.item?.label ?? 0) === itemLabelFilter)
  ).filter((wi) =>
    !itemSearchQuery.trim() ||
    (wi.item?.name || "").toLowerCase().includes(itemSearchQuery.trim().toLowerCase())
  )
  // Services are shown in their own tab, goods in the items tab
  const visibleGoodsItems = visibleWarehouseItems.filter((wi) => !wi.item?.is_service)
  const visibleServiceItems = visibleWarehouseItems.filter((wi) => wi.item?.is_service)

  // Fetch transfer items when a transfer is selected
  const fetchTransferItems = async (transferId: number) => {
    try {
      const { data, error } = await supabase
        .from("transfer_item")
        .select(`
          *,
          item(name, code, unit)
        `)
        .eq("transfer_id", transferId)

      if (error) {
        console.error("Error fetching transfer items:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց բեռնել տեղափոխման ապրանքները",
          variant: "destructive",
        })
        return
      }

      setTransferItems(data || [])
    } catch (error) {
      console.error("Error:", error)
    }
  }

  // Fetch last 10 transfers for an item
  const fetchItemTransfers = async (itemId: number) => {
    try {
      const { data, error } = await supabase
        .from("transfer_item")
        .select(`
          qty,
          total,
          transfer:transfer_id(
            id,
            from,
            to,
            created_at,
            acepted_at,
            delivered_at,
            from_warehouse:warehouse!transfer_from_fkey(name),
            to_warehouse:warehouse!transfer_to_fkey(name)
          )
        `)
        .eq("item_id", itemId)
        .order("transfer_id", { ascending: false })
        .limit(10)

      if (error) {
        console.error("Error fetching item transfers:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց բեռնել ապրանքի տեղափոխումները",
          variant: "destructive",
        })
        return
      }

      // Transform the data to flat structure
      const transformedData = data
        ?.filter((item: any) =>
          item.transfer?.from === warehouseId || item.transfer?.to === warehouseId
        )
        .map((item: any) => ({
          id: item.transfer?.id,
          from: item.transfer?.from,
          to: item.transfer?.to,
          created_at: item.transfer?.created_at,
          acepted_at: item.transfer?.acepted_at,
          rejected_at: item.transfer?.rejected_at,
          delivered_at: item.transfer?.delivered_at,
          qty: item.qty,
          total: item.total,
          from_warehouse: item.transfer?.from_warehouse,
          to_warehouse: item.transfer?.to_warehouse,
        })) || []

      setItemTransfers(transformedData)
    } catch (error) {
      console.error("Error:", error)
    }
  }

  // Handle transfer row click
  const handleTransferClick = (transfer: Transfer) => {
    setSelectedTransfer(transfer)
    fetchTransferItems(transfer.id)
    setIsTransferDrawerOpen(true)
  }

  // Handle item row click
  const handleItemClick = (item: WarehouseItem) => {
    setSelectedItem(item)
    fetchItemTransfers(item.item_id)
    setIsItemDrawerOpen(true)
  }

  // Fetch warehouses list
  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from("warehouse")
        .select(`
          id,
          name,
          type,
          partner:partner!warehouse_id(account_id)
        `)
        .order("name")

      if (error) throw error

      // Transform data to handle partner array (will be single item or empty)
      const transformedData = (data || []).map(warehouse => ({
        ...warehouse,
        partner: Array.isArray(warehouse.partner) && warehouse.partner.length > 0
          ? warehouse.partner[0]
          : undefined
      }))

      setWarehouses(transformedData)
    } catch (error) {
      console.error("Error fetching warehouses:", error)
    }
  }

  // Fetch items list
  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from("item")
        .select("id, name, code, unit")
        .order("name")

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error("Error fetching items:", error)
    }
  }

  // Fetch accounts list
  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("account")
        .select("id, name, currency, internal")
        .order("name")

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error("Error fetching accounts:", error)
    }
  }

  // Add new item row
  const addItemRow = () => {
    setNewTransferItems([
      ...newTransferItems,
      { itemName: "", itemId: null, unit: "", qty: "1", unitPrice: "", unitVat: "", isService: false }
    ])
  }

  // Remove item row
  const removeItemRow = (index: number) => {
    if (newTransferItems.length > 1) {
      setNewTransferItems(newTransferItems.filter((_, i) => i !== index))
    }
  }

  // Update item row
  // The same item name can exist with different units (e.g. "Ամրան" in կգ and հատ) —
  // those are distinct items, so resolution considers both name and unit
  const updateItemRow = (index: number, field: keyof NewTransferItem, value: any) => {
    const updated = [...newTransferItems]
    updated[index] = { ...updated[index], [field]: value }

    if (field === "itemName" || field === "unit") {
      const row = updated[index]

      // Direct pick from the autocomplete list: "Name (unit)" resolves to that
      // exact unit variant and the input is rewritten back to the plain name
      if (field === "itemName") {
        const directPick = items.find(i => `${i.name} (${i.unit || "հատ"})` === value)
        if (directPick) {
          row.itemName = directPick.name
          row.unit = directPick.unit || ""
          row.itemId = directPick.id
          setNewTransferItems(updated)
          return
        }
      }

      const nameLower = row.itemName.toLowerCase().trim()
      const unitLower = row.unit.toLowerCase().trim()

      if (!nameLower) {
        row.itemId = null
      } else {
        const exactByName = items.filter(i => i.name.toLowerCase().trim() === nameLower)
        const candidates = exactByName.length > 0
          ? exactByName
          : items.filter(i => i.name.toLowerCase().includes(nameLower))
        const unitMatch = candidates.find(i => (i.unit || "").toLowerCase().trim() === unitLower)

        if (field === "itemName") {
          // Prefer the variant matching the row's unit, otherwise fall back to the first one
          const match = unitMatch || candidates[0]
          if (match) {
            row.itemId = match.id
            row.unit = match.unit || ""
          } else {
            row.itemId = null
          }
        } else {
          // Unit edited: link only the variant with this exact unit;
          // no such variant means a new item will be created on save
          row.itemId = unitMatch ? unitMatch.id : null
        }
      }
    }

    setNewTransferItems(updated)
  }

  // Create transfer
  const handleCreateTransfer = async () => {
    if (!toWarehouse) {
      toast({
        title: "Սխալ",
        description: "Ընտրեք նշանակման պահեստը",
        variant: "destructive",
      })
      return
    }

    if (newTransferItems.length === 0 || !newTransferItems[0].itemName) {
      toast({
        title: "Սխալ",
        description: "Ավելացրեք նվազագույնը մեկ ապրանք",
        variant: "destructive",
      })
      return
    }

    // If creating transaction, validate accounts are selected
    if (createTransaction) {
      if (!fromAccount || !toAccount) {
        toast({
          title: "Սխալ",
          description: "Ընտրեք հաշիվները գործարք ստեղծելու համար",
          variant: "destructive",
        })
        return
      }
    }

    try {
      // Create or find items
      const itemsToInsert = []
      for (const transferItem of newTransferItems) {
        if (!transferItem.itemName) continue

        let itemId = transferItem.itemId

        // If item doesn't exist, create it
        if (!itemId) {
          const { data: newItem, error: itemError } = await supabase
            .from("item")
            .insert({
              name: transferItem.itemName,
              code: `ITM${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
              unit: transferItem.unit || "հատ",
              is_service: transferItem.isService,
            })
            .select()
            .single()

          if (itemError) throw itemError
          itemId = newItem.id
        }

        itemsToInsert.push({
          item_id: itemId,
          qty: parseFormattedNumber(transferItem.qty),
          unit_price: parseFormattedNumber(transferItem.unitPrice),
          unit_vat: parseFormattedNumber(transferItem.unitVat),
        })
      }

      // Calculate total amount
      const totalAmount = newTransferItems.reduce(
        (sum, item) => sum + ((parseFormattedNumber(item.unitPrice) + parseFormattedNumber(item.unitVat)) * parseFormattedNumber(item.qty)),
        0
      )

      // Create transaction if checkbox is checked
      let transactionId = null
      if (createTransaction && fromAccount && toAccount) {
        const fromWh = warehouses.find(w => w.id === fromWarehouse)
        const toWh = warehouses.find(w => w.id === toWarehouse)

        const { data: transaction, error: transactionError } = await supabase
          .from("transaction")
          .insert({
            from: fromAccount,
            to: toAccount,
            amount: totalAmount,
            note: `Տեղափոխում ${fromWh!.name} → ${toWh!.name}`,
          })
          .select()
          .single()

        if (transactionError) throw transactionError
        transactionId = transaction.id
      }

      // Create transfer
      const { data: transfer, error: transferError } = await supabase
        .from("transfer")
        .insert({
          from: fromWarehouse,
          to: toWarehouse,
          transaction_id: transactionId,
        })
        .select()
        .single()

      if (transferError) throw transferError

      // Create transfer items
      const transferItemsToInsert = itemsToInsert.map(item => ({
        ...item,
        transfer_id: transfer.id
      }))

      const { error: itemsError } = await supabase
        .from("transfer_item")
        .insert(transferItemsToInsert)

      if (itemsError) throw itemsError

      toast({
        title: "Հաջողություն",
        description: createTransaction
          ? "Տեղափոխումը և գործարքը հաջողությամբ ստեղծվեցին"
          : "Տեղափոխումը հաջողությամբ ստեղծվեց",
      })

      // Reset form
      setFromWarehouse(warehouseId)
      setToWarehouse(null)
      setNewTransferItems([{ itemName: "", itemId: null, unit: "", qty: "1", unitPrice: "", unitVat: "", isService: false }])
      setCreateTransaction(false)
      setFromAccount(null)
      setToAccount(null)
      setSelectedItemIds(new Set())
      setIsCreateTransferDrawerOpen(false)

      // Refresh transfers list
      fetchTransfers()
      fetchWarehouseItems()
    } catch (error) {
      console.error("Error creating transfer:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց ստեղծել տեղափոխումը",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    fetchTransfers()
    fetchWarehouseItems()
    fetchWarehouses()
    fetchItems()
    fetchAccounts()
  }, [warehouseId])

  // Handle initial transfer data from props
  useEffect(() => {
    if (initialTransferData && warehouses.length > 0) {
      if (initialTransferData.fromWarehouse) setFromWarehouse(initialTransferData.fromWarehouse)
      if (initialTransferData.toWarehouse) setToWarehouse(initialTransferData.toWarehouse)
      if (initialTransferData.createTransaction !== undefined) setCreateTransaction(initialTransferData.createTransaction)
      if (initialTransferData.fromAccount) setFromAccount(initialTransferData.fromAccount)
      if (initialTransferData.toAccount) setToAccount(initialTransferData.toAccount)
      if (initialTransferData.openDrawer) {
        // Small delay to ensure all state is set before opening drawer
        setTimeout(() => setIsCreateTransferDrawerOpen(true), 100)
      }
    }
  }, [initialTransferData, warehouses])

  // Fetch stock for from warehouse when it changes (for transfer creation)
  useEffect(() => {
    if (!fromWarehouse || !isCreateTransferDrawerOpen) return
    const fetchStock = async () => {
      const { data } = await supabase
        .from("warehouse_item_stock")
        .select("item_id, stock_qty")
        .eq("warehouse_id", fromWarehouse)
      const map: Record<number, number> = {}
      ;(data || []).forEach((s: { item_id: number; stock_qty: number }) => {
        map[s.item_id] = s.stock_qty
      })
      setFromWarehouseStock(map)
    }
    fetchStock()
  }, [fromWarehouse, isCreateTransferDrawerOpen])

  // Auto-enable transaction creation if from or to warehouse is partner type
  // But don't override if we have initial transfer data
  useEffect(() => {
    if (initialTransferData) return // Don't auto-enable if we have initial data

    const fromWh = warehouses.find(w => w.id === fromWarehouse)
    const toWh = warehouses.find(w => w.id === toWarehouse)

    if (fromWh?.type === "partner" || toWh?.type === "partner") {
      setCreateTransaction(true)
    } else {
      setCreateTransaction(false)
    }
  }, [fromWarehouse, toWarehouse, warehouses, initialTransferData])

  // Auto-select "to" account based on "to" warehouse's partner account
  useEffect(() => {
    if (toWarehouse && createTransaction) {
      const toWh = warehouses.find(w => w.id === toWarehouse)
      if (toWh?.partner?.account_id) {
        setToAccount(toWh.partner.account_id)
      } else {
        setToAccount(null)
      }
    }
  }, [toWarehouse, warehouses, createTransaction])

  // Transfer action handlers
  const handleSetPending = async (transferId: number) => {
    try {
      const { error } = await supabase
        .from("transfer")
        .update({ delivered_at: new Date().toISOString() })
        .eq("id", transferId)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Տեղափոխումը նշանակվեց որպես ընթացիկ",
      })

      setIsTransferDrawerOpen(false)
      fetchTransfers()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց թարմացնել տեղափոխումը",
        variant: "destructive",
      })
    }
  }

  const handleAccept = async (transferId: number) => {
    try {
      const now = new Date().toISOString()
      const transfer = transfers.find(t => t.id === transferId)
      const updateData: Record<string, string> = { acepted_at: now }
      if (!transfer?.delivered_at) {
        updateData.delivered_at = now
      }
      const { error } = await supabase
        .from("transfer")
        .update(updateData)
        .eq("id", transferId)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Տեղափոխումը ընդունվեց",
      })

      setIsTransferDrawerOpen(false)
      fetchTransfers()
      fetchWarehouseItems() // Refresh stock
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց ընդունել տեղափոխումը",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (transferId: number) => {
    try {
      const { error } = await supabase
        .from("transfer")
        .update({ rejected_at: new Date().toISOString() })
        .eq("id", transferId)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Տեղափոխումը մերժվեց",
      })

      setIsTransferDrawerOpen(false)
      fetchTransfers()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց մերժել տեղափոխումը",
        variant: "destructive",
      })
    }
  }

  const getTransferStatus = (transfer: Transfer) => {
    if (transfer.rejected_at) {
      return <Badge variant="destructive">Մերժված</Badge>
    }
    if (transfer.acepted_at) {
      return <Badge variant="outline">Ընդունված</Badge>
    }
    if (transfer.delivered_at) {
      return <Badge variant="secondary">Ընթացիկ</Badge>
    }
    return <Badge variant="default">Սևագիր</Badge>
  }

  const canModifyTransfer = (transfer: Transfer | null) => {
    if (!transfer) return false
    return !transfer.acepted_at && !transfer.rejected_at
  }

  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("hy-AM", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Export helpers — always export the FULL dataset, not the filtered/visible rows
  const downloadRows = (rows: Record<string, unknown>[], fileName: string, format: "xlsx" | "csv") => {
    const ws = XLSX.utils.json_to_sheet(rows)
    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws)
      // BOM so Excel opens Armenian text correctly
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${fileName}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Data")
      XLSX.writeFile(wb, `${fileName}.xlsx`)
    }
  }

  const exportTransfers = (format: "xlsx" | "csv") => {
    const rows = transfers.map((t) => ({
      "ID": t.id,
      "Ուղղություն": t.from === warehouseId ? "Ելք" : "Մուտք",
      "Որտեղից": t.from_warehouse?.name || `#${t.from}`,
      "Ուր": t.to_warehouse?.name || `#${t.to}`,
      "Հասցե": t.invoice?.destination_address || "",
      "Ստեղծվել է": t.created_at ? new Date(t.created_at).toLocaleDateString("hy-AM") : "",
      "Վիճակ": t.rejected_at ? "Մերժված" : t.acepted_at ? "Ընդունված" : t.delivered_at ? "Ընթացիկ" : "Սևագիր",
      "Խիմիչիտ": t.ximichit ? "Այո" : "",
      "Հաշիվ-ապրանքագիր": t.invoice?.serial_no || "",
    }))
    downloadRows(rows, `${warehouseName}-transfers`, format)
  }

  const exportItems = (serviceOnly: boolean, format: "xlsx" | "csv") => {
    const rows = warehouseItems
      .filter((wi) => !!wi.item?.is_service === serviceOnly)
      .map((wi) => ({
        "Անվանում": wi.item?.name || "",
        "Միավոր": wi.item?.unit || "",
        "Քանակ": wi.stock_qty,
        "Վերջին գին": wi.last_price ?? "",
        "Միջին գին": wi.avg_price != null ? Math.round(wi.avg_price * 100) / 100 : "",
        "Ընդհանուր արժեք": wi.fifo_value != null ? Math.round(wi.fifo_value * 100) / 100 : "",
      }))
    downloadRows(rows, `${warehouseName}-${serviceOnly ? "services" : "items"}`, format)
  }

  const ExportButtons = ({ onExport }: { onExport: (format: "xlsx" | "csv") => void }) => (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" onClick={() => onExport("csv")}>
        <Download className="h-3.5 w-3.5 mr-1.5" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => onExport("xlsx")}>
        <Download className="h-3.5 w-3.5 mr-1.5" />
        XLSX
      </Button>
    </div>
  )

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div></div>
        <Button onClick={() => setIsCreateTransferDrawerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ստեղծել տեղափոխում
        </Button>
      </div>

      <Tabs defaultValue="transfers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="transfers">Տեղափոխումներ</TabsTrigger>
          <TabsTrigger value="items">Ապրանքներ</TabsTrigger>
          <TabsTrigger value="services">Ծառայություններ</TabsTrigger>
        </TabsList>

        {/* Transfers Tab */}
        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Տեղափոխումներ</CardTitle>
                  <CardDescription>
                    Բոլոր տեղափոխումները այս պահեստից և դեպի այս պահեստ
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <ExportButtons onExport={exportTransfers} />
                  <LabelFilter value={transferLabelFilter} onChange={setTransferLabelFilter} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <p className="text-muted-foreground">Բեռնում...</p>
                </div>
              ) : visibleTransfers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <TruckIcon className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">Տեղափոխումներ չկան</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead className="w-[28%]">Պահեստ</TableHead>
                      <TableHead className="w-[28%]">Հասցե</TableHead>
                      <TableHead>Ստեղծվել է</TableHead>
                      <TableHead>Վիճակ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleTransfers.map((transfer) => {
                      const counterpartyName = transfer.from === warehouseId
                        ? (transfer.to_warehouse?.name || `#${transfer.to}`)
                        : (transfer.from_warehouse?.name || `#${transfer.from}`)
                      const destinationAddress = transfer.invoice?.destination_address || ""
                      return (
                      <TableRow
                        key={transfer.id}
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => handleTransferClick(transfer)}
                      >
                        <TableCell>
                          <LabelCell value={transfer.label} onChange={(next) => setTransferLabel(transfer.id, next)} />
                        </TableCell>
                        <TableCell className={cn("font-medium", transfer.ximichit && "text-red-600")}>#{transfer.id}</TableCell>
                        <TableCell className="max-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {transfer.from === warehouseId ? (
                              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ArrowLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className="truncate" title={counterpartyName}>{counterpartyName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-0">
                          <span className="block truncate text-muted-foreground" title={destinationAddress || undefined}>
                            {destinationAddress || "—"}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(transfer.created_at)}</TableCell>
                        <TableCell>{getTransferStatus(transfer)}</TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ապրանքների պաշար</CardTitle>
                  <CardDescription>
                    Հասանելի ապրանքներ այս պահեստում
                  </CardDescription>
                </div>
                <div className="relative flex-1 max-w-sm mx-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Որոնել ապրանք..."
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ExportButtons onExport={(f) => exportItems(false, f)} />
                <LabelFilter value={itemLabelFilter} onChange={setItemLabelFilter} className="mx-3" />
                {selectedItemIds.size > 0 && (
                  <Button
                    onClick={() => {
                      const selectedItems = warehouseItems
                        .filter(wi => selectedItemIds.has(wi.item_id))
                        .map(wi => ({
                          itemName: wi.item?.name || "",
                          itemId: wi.item_id,
                          unit: wi.item?.unit || "",
                          qty: handleNumberInput(String(wi.stock_qty)),
                          unitPrice: wi.last_price != null ? handleNumberInput(String(wi.last_price)) : "",
                          unitVat: "",
                          isService: false,
                        }))
                      if (selectedItems.length > 0) {
                        setNewTransferItems(selectedItems)
                        setIsCreateTransferDrawerOpen(true)
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ստեղծել տեղափոխում ({selectedItemIds.size})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {visibleGoodsItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">Ապրանքներ չկան</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[40px]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer"
                          checked={visibleGoodsItems.length > 0 && selectedItemIds.size === visibleGoodsItems.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemIds(new Set(visibleGoodsItems.map(i => i.item_id)))
                            } else {
                              setSelectedItemIds(new Set())
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Անվանում</TableHead>
                      <TableHead>Միավոր</TableHead>
                      <TableHead className="text-right">Քանակ</TableHead>
                      <TableHead className="text-right">Վերջին գին</TableHead>
                      <TableHead className="text-right">Միջին գին</TableHead>
                      <TableHead className="text-right">Ընդհանուր արժեք</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleGoodsItems.map((item) => {
                      const totalValue = item.fifo_value ?? null
                      const isSelected = selectedItemIds.has(item.item_id)
                      return (
                        <TableRow
                          key={item.item_id}
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => handleItemClick(item)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <LabelCell value={item.item?.label} onChange={(next) => setItemLabel(item.item_id, next)} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedItemIds)
                                if (e.target.checked) {
                                  next.add(item.item_id)
                                } else {
                                  next.delete(item.item_id)
                                }
                                setSelectedItemIds(next)
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{item.item?.name || "Անհայտ"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.item?.unit || "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.stock_qty}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.last_price != null ? `${item.last_price.toLocaleString()} ֏` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.avg_price != null ? `${item.avg_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ֏` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {totalValue != null ? `${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ֏` : "-"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
              {visibleGoodsItems.length > 0 && (
                <div className="flex justify-between items-center pt-4 mt-4 border-t">
                  <span className="font-medium">Ընդամենը ({visibleGoodsItems.length} ապրանք)</span>
                  <span className="text-lg font-bold">
                    {visibleGoodsItems
                      .reduce((sum, item) => sum + (item.fifo_value ?? 0), 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ֏
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ծառայություններ</CardTitle>
                  <CardDescription>
                    Ծառայության տեսակի ապրանքներ այս պահեստում
                  </CardDescription>
                </div>
                <div className="relative flex-1 max-w-sm mx-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Որոնել ծառայություն..."
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ExportButtons onExport={(f) => exportItems(true, f)} />
                <LabelFilter value={itemLabelFilter} onChange={setItemLabelFilter} className="mx-3" />
              </div>
            </CardHeader>
            <CardContent>
              {visibleServiceItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">Ծառայություններ չկան</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Անվանում</TableHead>
                      <TableHead>Միավոր</TableHead>
                      <TableHead className="text-right">Քանակ</TableHead>
                      <TableHead className="text-right">Վերջին գին</TableHead>
                      <TableHead className="text-right">Միջին գին</TableHead>
                      <TableHead className="text-right">Ընդհանուր արժեք</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleServiceItems.map((item) => {
                      const totalValue = item.fifo_value ?? null
                      return (
                        <TableRow
                          key={item.item_id}
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => handleItemClick(item)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <LabelCell value={item.item?.label} onChange={(next) => setItemLabel(item.item_id, next)} />
                          </TableCell>
                          <TableCell className="font-medium">{item.item?.name || "Անհայտ"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.item?.unit || "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.stock_qty}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.last_price != null ? `${item.last_price.toLocaleString()} ֏` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.avg_price != null ? `${item.avg_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ֏` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {totalValue != null ? `${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ֏` : "-"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
              {visibleServiceItems.length > 0 && (
                <div className="flex justify-between items-center pt-4 mt-4 border-t">
                  <span className="font-medium">Ընդամենը ({visibleServiceItems.length} ծառայություն)</span>
                  <span className="text-lg font-bold">
                    {visibleServiceItems
                      .reduce((sum, item) => sum + (item.fifo_value ?? 0), 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ֏
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transfer Items Drawer */}
      <Sheet open={isTransferDrawerOpen} onOpenChange={setIsTransferDrawerOpen}>
        <SheetContent className="w-full sm:max-w-[70vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Տեղափոխման մանրամասներ #{selectedTransfer?.id}</SheetTitle>
            <SheetDescription>
              {selectedTransfer?.from_warehouse?.name || `#${selectedTransfer?.from}`} → {selectedTransfer?.to_warehouse?.name || `#${selectedTransfer?.to}`}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            {/* Status and Dates */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="grid grid-cols-4 gap-4 flex-1">
                <div>
                  <p className="text-sm text-muted-foreground">Ստեղծվել է</p>
                  <p className="font-medium">{formatDate(selectedTransfer?.created_at || null)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ուղարկված</p>
                  <p className="font-medium">{formatDate(selectedTransfer?.delivered_at || null)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ընդունված</p>
                  <p className="font-medium">{formatDate(selectedTransfer?.acepted_at || null)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Վիճակ</p>
                  <div className="mt-1">{selectedTransfer && getTransferStatus(selectedTransfer)}</div>
                </div>
              </div>
            </div>

            {/* Destination Warehouse Selector */}
            {selectedTransfer && canModifyTransfer(selectedTransfer) && (
              <div className="pb-4 border-b">
                <div className="space-y-2">
                  <Label>Նշանակման պահեստ</Label>
                  <Tabs value={destWhTab} onValueChange={(v) => setDestWhTab(v as any)} className="w-full">
                    <TabsList className="w-full h-8">
                      <TabsTrigger value="internal" className="text-xs flex-1">Ներքին</TabsTrigger>
                      <TabsTrigger value="partners" className="text-xs flex-1">Գործընկեր</TabsTrigger>
                      <TabsTrigger value="suppliers" className="text-xs flex-1">Մատակարար</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {warehouses.find(w => w.id === selectedTransfer.to)?.name || "Ընտրեք պահեստը"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
                      <Command>
                        <CommandInput placeholder="Որոնել պահեստ..." />
                        <CommandList>
                          <CommandEmpty>Պահեստ չի գտնվել</CommandEmpty>
                          <CommandGroup>
                            {warehouses
                              .filter(w => {
                                if (w.id === selectedTransfer.from) return false
                                if (destWhTab === "internal") return !["supplier", "partner"].includes(w.type)
                                if (destWhTab === "partners") return w.type === "partner"
                                if (destWhTab === "suppliers") return w.type === "supplier"
                                return true
                              })
                              .map((w) => (
                              <CommandItem
                                key={w.id}
                                value={w.name}
                                onSelect={async () => {
                                  const { error } = await supabase
                                    .from("transfer")
                                    .update({ to: w.id })
                                    .eq("id", selectedTransfer.id)
                                  if (!error) {
                                    setSelectedTransfer({ ...selectedTransfer, to: w.id, to_warehouse: { name: w.name } })
                                    fetchTransfers()
                                  }
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedTransfer.to === w.id ? "opacity-100" : "opacity-0")} />
                                {w.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Invoice Information */}
            {selectedTransfer?.invoice && (
              <div className="pb-4 border-b">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Ապրանքագիր</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Համար</span>
                      <span className="font-medium">{selectedTransfer.invoice.serial_no}</span>
                    </div>
                    {selectedTransfer.invoice.partner && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Մատակարար</span>
                          <span className="font-medium">{selectedTransfer.invoice.partner.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">ՀՎՀՀ</span>
                          <span className="font-medium font-mono">{selectedTransfer.invoice.partner.tin}</span>
                        </div>
                        {selectedTransfer.invoice.partner.address && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Մատակարարի հասցե</span>
                            <span className="font-medium">{selectedTransfer.invoice.partner.address}</span>
                          </div>
                        )}
                      </>
                    )}
                    {selectedTransfer.invoice.destination_address && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Նշանակման հասցե</span>
                        <span className="font-medium">{selectedTransfer.invoice.destination_address}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ամսաթիվ</span>
                      <span className="font-medium">{formatDate(selectedTransfer.invoice.delivered_at || selectedTransfer.invoice.issued_at || selectedTransfer.invoice.created_at)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Ընդամենը</span>
                      <span className="font-bold">{(selectedTransfer.invoice.total ?? 0).toLocaleString()} ֏</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Action Buttons */}
            {selectedTransfer && (
              <div className="flex flex-wrap gap-2 pb-4 border-b">
                {canModifyTransfer(selectedTransfer) && (
                  <>
                    {!selectedTransfer.delivered_at && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPending(selectedTransfer.id)}
                      >
                        Նշանակել որպես ընթացիկ
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleAccept(selectedTransfer.id)}
                    >
                      Ընդունել
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReject(selectedTransfer.id)}
                    >
                      Մերժել
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSplitModalOpen(true)}
                    >
                      <Scissors className="h-4 w-4 mr-2" />
                      Բաժանել
                    </Button>
                  </>
                )}
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsXimichitModalOpen(true)}
                  disabled={selectedTransfer.ximichit}
                >
                  {selectedTransfer.ximichit ? "Խիմիչիտ է" : "Խիմիչիտ անել"}
                </Button>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-3">Ապրանքներ</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Անվանում</TableHead>
                    <TableHead className="text-right">Քնկ.</TableHead>
                    <TableHead className="text-right">Գին</TableHead>
                    <TableHead className="text-right">ԱԱՀ</TableHead>
                    <TableHead className="text-right">Ընդամենը</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferItems.map((item) => (
                    <TableRow key={item.item_id}>
                      <TableCell>{item.item?.name || `#${item.item_id}`}</TableCell>
                      <TableCell className="text-right">
                        {item.qty}
                        {item.item?.unit && <span className="text-muted-foreground text-xs ml-1">{item.item.unit}</span>}
                      </TableCell>
                      <TableCell className="text-right">{item.unit_price.toLocaleString()} ֏</TableCell>
                      <TableCell className="text-right">{item.unit_vat.toLocaleString()} ֏</TableCell>
                      <TableCell className="text-right font-medium">{item.total.toLocaleString()} ֏</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {transferItems.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Ընդհանուր գումար:</span>
                    <span className="text-lg font-bold">
                      {transferItems.reduce((sum, item) => sum + item.total, 0).toLocaleString()} ֏
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Item Transfers Drawer */}
      <Sheet open={isItemDrawerOpen} onOpenChange={setIsItemDrawerOpen}>
        <SheetContent className="w-full sm:max-w-[70vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedItem?.item?.name || "Ապրանք"}</SheetTitle>
            <SheetDescription>
              Վերջին 10 տեղափոխումները այս պահեստում
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            <div className="p-4 bg-accent rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Ընթացիկ պաշար</span>
                <span className="text-2xl font-bold">
                  {selectedItem?.stock_qty}
                  {selectedItem?.item?.unit && (
                    <span className="text-base font-normal text-muted-foreground ml-1.5">{selectedItem.item.unit}</span>
                  )}
                </span>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Տեղափոխումների պատմություն</h3>
              {itemTransfers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Տեղափոխումներ չկան</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ամսաթիվ</TableHead>
                      <TableHead>Սկսած</TableHead>
                      <TableHead>Դեպի</TableHead>
                      <TableHead className="text-right">Քնկ.</TableHead>
                      <TableHead className="text-right">Գումար</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemTransfers.map((transfer, index) => (
                      <TableRow
                        key={index}
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => {
                          setHistoryTransferId(transfer.id)
                          setIsHistoryTransferOpen(true)
                        }}
                      >
                        <TableCell>{formatDate(transfer.created_at)}</TableCell>
                        <TableCell>{transfer.from_warehouse?.name || `#${transfer.from}`}</TableCell>
                        <TableCell>{transfer.to_warehouse?.name || `#${transfer.to}`}</TableCell>
                        <TableCell className="text-right">
                          {transfer.from === warehouseId ? (
                            <span className="text-red-500">-{transfer.qty}</span>
                          ) : (
                            <span className="text-green-500">+{transfer.qty}</span>
                          )}
                          {selectedItem?.item?.unit && (
                            <span className="text-muted-foreground text-xs ml-1">{selectedItem.item.unit}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{transfer.total.toLocaleString()} ֏</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Transfer Drawer */}
      <Sheet open={isCreateTransferDrawerOpen} onOpenChange={setIsCreateTransferDrawerOpen}>
        <SheetContent className="w-full sm:max-w-[75vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Ստեղծել նոր տեղափոխում</SheetTitle>
            <SheetDescription>
              Լրացրեք տեղափոխման տվյալները և ավելացրեք ապրանքներ
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Warehouse Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Սկսած պահեստից</Label>
                <Tabs value={fromWhTab} onValueChange={(v) => setFromWhTab(v as any)} className="w-full">
                  <TabsList className="w-full h-8">
                    <TabsTrigger value="internal" className="text-xs flex-1">Ներքին</TabsTrigger>
                    <TabsTrigger value="partners" className="text-xs flex-1">Գործընկեր</TabsTrigger>
                    <TabsTrigger value="suppliers" className="text-xs flex-1">Մատակարար</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {warehouses.find(w => w.id === fromWarehouse)?.name || "Ընտրեք պահեստը"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
                    <Command>
                      <CommandInput placeholder="Որոնել պահեստ..." />
                      <CommandList>
                        <CommandEmpty>Պահեստ չի գտնվել</CommandEmpty>
                        <CommandGroup>
                          {warehouses
                            .filter(w => {
                              if (fromWhTab === "internal") return !["supplier", "partner"].includes(w.type)
                              if (fromWhTab === "partners") return w.type === "partner"
                              if (fromWhTab === "suppliers") return w.type === "supplier"
                              return true
                            })
                            .map((warehouse) => (
                            <CommandItem
                              key={warehouse.id}
                              value={warehouse.name}
                              onSelect={() => setFromWarehouse(warehouse.id)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", fromWarehouse === warehouse.id ? "opacity-100" : "opacity-0")} />
                              {warehouse.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Դեպի պահեստ</Label>
                <Tabs value={toWhTab} onValueChange={(v) => setToWhTab(v as any)} className="w-full">
                  <TabsList className="w-full h-8">
                    <TabsTrigger value="internal" className="text-xs flex-1">Ներքին</TabsTrigger>
                    <TabsTrigger value="partners" className="text-xs flex-1">Գործընկեր</TabsTrigger>
                    <TabsTrigger value="suppliers" className="text-xs flex-1">Մատակարար</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {toWarehouse ? warehouses.find(w => w.id === toWarehouse)?.name : "Ընտրեք պահեստը"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
                    <Command>
                      <CommandInput placeholder="Որոնել պահեստ..." />
                      <CommandList>
                        <CommandEmpty>Պահեստ չի գտնվել</CommandEmpty>
                        <CommandGroup>
                          {warehouses
                            .filter(w => {
                              if (w.id === fromWarehouse) return false
                              if (toWhTab === "internal") return !["supplier", "partner"].includes(w.type)
                              if (toWhTab === "partners") return w.type === "partner"
                              if (toWhTab === "suppliers") return w.type === "supplier"
                              return true
                            })
                            .map((warehouse) => (
                              <CommandItem
                                key={warehouse.id}
                                value={warehouse.name}
                                onSelect={() => setToWarehouse(warehouse.id)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", toWarehouse === warehouse.id ? "opacity-100" : "opacity-0")} />
                                {warehouse.name}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Create Transaction Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="create-transaction">Ստեղծել գործարք</Label>
                  <p className="text-sm text-muted-foreground">
                    Ավտոմատ ստեղծել ֆինանսական գործարք այս տեղափոխման համար
                  </p>
                </div>
                <Switch
                  id="create-transaction"
                  checked={createTransaction}
                  onCheckedChange={setCreateTransaction}
                  disabled={
                    !toWarehouse ||
                    !(warehouses.find(w => w.id === fromWarehouse)?.type === "partner" ||
                      warehouses.find(w => w.id === toWarehouse)?.type === "partner")
                  }
                />
              </div>

              {createTransaction && (
                <div className="space-y-4 pl-4 border-l-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Սկսած հաշվից</Label>
                      <Select
                        value={fromAccount?.toString() || ""}
                        onValueChange={(value) => setFromAccount(Number(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ընտրեք հաշիվը" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts
                            .filter(account => account.internal)
                            .map((account) => (
                              <SelectItem key={account.id} value={account.id.toString()}>
                                {account.name} ({account.currency.toUpperCase()})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Դեպի հաշիվ</Label>
                      <Select
                        value={toAccount?.toString() || ""}
                        onValueChange={(value) => setToAccount(Number(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ընտրեք հաշիվը" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts
                            .filter(account => !account.internal)
                            .map((account) => (
                            <SelectItem key={account.id} value={account.id.toString()}>
                              {account.name} ({account.currency.toUpperCase()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="p-4 bg-accent rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">
                      Կստեղծվի գործարք հաշիվների միջև՝ ընդհանուր գումարի չափով
                    </p>
                    <p className="text-lg font-semibold">
                      {newTransferItems
                        .reduce((sum, item) => sum + ((parseFormattedNumber(item.unitPrice) + parseFormattedNumber(item.unitVat)) * parseFormattedNumber(item.qty)), 0)
                        .toLocaleString()} ֏
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Ապրանքներ</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ավելացնել ապրանք
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[26%]">Անվանում</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                      <TableHead className="w-[10%]">Միավոր</TableHead>
                      <TableHead className="w-[9%]">Քնկ.</TableHead>
                      <TableHead className="w-[13%]">Գին</TableHead>
                      <TableHead className="w-[13%]">ԱԱՀ</TableHead>
                      <TableHead className="w-[13%] text-right">Ընդամենը</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newTransferItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            placeholder="Ապրանքի անվանումը"
                            value={item.itemName}
                            onChange={(e) => updateItemRow(index, "itemName", e.target.value)}
                            list={`items-list-${index}`}
                          />
                          <datalist id={`items-list-${index}`}>
                            {items
                              .filter(i => i.name.toLowerCase().includes(item.itemName.toLowerCase()))
                              .slice(0, 10)
                              .map(i => (
                                // Value includes the unit so same-name items with different
                                // units appear as separate selectable lines (identical values
                                // would be collapsed by the browser)
                                <option key={i.id} value={`${i.name} (${i.unit || "հատ"})`} />
                              ))}
                          </datalist>
                        </TableCell>
                        <TableCell>
                          {item.itemId && (
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className="text-xs whitespace-nowrap">
                                Պաշար՝ {fromWarehouseStock[item.itemId] ?? 0}
                              </Badge>
                            </div>
                          )}
                          {item.itemName && !item.itemId && (
                            <div className="flex flex-col gap-1">
                              <Badge variant="secondary" className="text-xs">
                                Նոր
                              </Badge>
                              <label
                                className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 cursor-pointer"
                                  checked={item.isService}
                                  onChange={(e) => updateItemRow(index, "isService", e.target.checked)}
                                />
                                Ծառայ.
                              </label>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            placeholder="հատ"
                            value={item.unit}
                            onChange={(e) => updateItemRow(index, "unit", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={item.qty}
                            onChange={(e) => updateItemRow(index, "qty", handleNumberInput(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            placeholder="0.00"
                            value={item.unitPrice}
                            onChange={(e) => updateItemRow(index, "unitPrice", handleNumberInput(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            placeholder="0.00"
                            value={item.unitVat}
                            onChange={(e) => updateItemRow(index, "unitVat", handleNumberInput(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {((parseFormattedNumber(item.unitPrice) + parseFormattedNumber(item.unitVat)) * parseFormattedNumber(item.qty)).toLocaleString()} ֏
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItemRow(index)}
                            disabled={newTransferItems.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Total */}
              {newTransferItems.length > 0 && (
                <div className="flex justify-end pt-4 border-t">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Ընդհանուր գումար</p>
                    <p className="text-2xl font-bold">
                      {newTransferItems
                        .reduce((sum, item) => sum + ((parseFormattedNumber(item.unitPrice) + parseFormattedNumber(item.unitVat)) * parseFormattedNumber(item.qty)), 0)
                        .toLocaleString()} ֏
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateTransferDrawerOpen(false)}
            >
              Չեղարկել
            </Button>
            <Button onClick={handleCreateTransfer}>
              Ստեղծել տեղափոխում
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {/* Split Transfer Modal */}
      {selectedTransfer && (
        <SplitTransferModal
          open={isSplitModalOpen}
          onOpenChange={setIsSplitModalOpen}
          transferId={selectedTransfer.id}
          transferItems={transferItems}
          currentFrom={selectedTransfer.from}
          currentTo={selectedTransfer.to}
          invoiceId={selectedTransfer.invoice_id}
          onSplitComplete={() => {
            setIsTransferDrawerOpen(false)
            fetchTransfers()
            fetchWarehouseItems()
          }}
        />
      )}

      {/* Ximichit Modal */}
      {selectedTransfer && (
        <XimichitModal
          open={isXimichitModalOpen}
          onOpenChange={setIsXimichitModalOpen}
          transferId={selectedTransfer.id}
          transferItems={transferItems.map(ti => ({ item_id: ti.item_id, qty: ti.qty, unit_price: ti.unit_price, unit_vat: ti.unit_vat }))}
          fromWarehouseId={selectedTransfer.from}
          invoiceId={selectedTransfer.invoice_id}
          onSuccess={() => {
            setIsTransferDrawerOpen(false)
            fetchTransfers()
            fetchWarehouseItems()
          }}
        />
      )}

      {/* Transfer detail opened from item movement history */}
      <TransferDetailDrawer
        open={isHistoryTransferOpen}
        onOpenChange={setIsHistoryTransferOpen}
        transferId={historyTransferId}
      />
    </>
  )
}

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
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
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, Package, TruckIcon, Plus, Trash2, Search } from "lucide-react"

interface Transfer {
  id: number
  from: number
  to: number
  created_at: string
  delivered_at: string | null
  acepted_at: string | null
  rejected_at: string | null
  from_warehouse?: { name: string }
  to_warehouse?: { name: string }
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
  item?: { name: string; code: string }
}

interface WarehouseItem {
  warehouse_id: number
  item_id: number
  stock_qty: number
  item?: { name: string; code: string; unit: string }
  last_price?: number
  avg_price?: number
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
  qty: number
  unitPrice: number
  unitVat: number
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
  const [isCreateTransferDrawerOpen, setIsCreateTransferDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Create transfer state
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [accounts, setAccounts] = useState<{ id: number; name: string; currency: string; internal: boolean }[]>([])
  const [fromWarehouse, setFromWarehouse] = useState<number>(warehouseId)
  const [toWarehouse, setToWarehouse] = useState<number | null>(null)
  const [newTransferItems, setNewTransferItems] = useState<NewTransferItem[]>([
    { itemName: "", itemId: null, qty: 1, unitPrice: 0, unitVat: 0 }
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
          to_warehouse:warehouse!transfer_to_fkey(name)
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
        .select("id, name, code, unit")
        .in("id", itemIds)

      if (itemsError) {
        console.error("Error fetching items:", itemsError)
        return
      }

      // Fetch price data for each item (last price and average price)
      const priceDataPromises = itemIds.map(async (itemId) => {
        // Get all accepted transfers for this item in this warehouse
        const { data: transferItems } = await supabase
          .from("transfer_item")
          .select("unit_amount, transfer:transfer_id(acepted_at, to, from)")
          .eq("item_id", itemId)
          .not("transfer.acepted_at", "is", null)
          .or(`to.eq.${warehouseId},from.eq.${warehouseId}`, { foreignTable: "transfer" })
          .order("transfer(acepted_at)", { ascending: false })

        if (!transferItems || transferItems.length === 0) {
          return { itemId, last_price: null, avg_price: null }
        }

        // Last price (most recent)
        const last_price = transferItems[0]?.unit_amount || null

        // Average price
        const prices = transferItems.map(ti => ti.unit_amount).filter(p => p != null)
        const avg_price = prices.length > 0
          ? prices.reduce((sum, price) => sum + price, 0) / prices.length
          : null

        return { itemId, last_price, avg_price }
      })

      const priceData = await Promise.all(priceDataPromises)

      // Combine stock, item, and price data
      const combined = stockData.map(stock => {
        const itemInfo = itemsData?.find(item => item.id === stock.item_id)
        const prices = priceData.find(p => p.itemId === stock.item_id)

        return {
          ...stock,
          item: itemInfo,
          last_price: prices?.last_price || undefined,
          avg_price: prices?.avg_price || undefined
        }
      })

      setWarehouseItems(combined)
    } catch (error) {
      console.error("Error:", error)
    }
  }

  // Fetch transfer items when a transfer is selected
  const fetchTransferItems = async (transferId: number) => {
    try {
      const { data, error } = await supabase
        .from("transfer_item")
        .select(`
          *,
          item(name, code)
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
      { itemName: "", itemId: null, qty: 1, unitPrice: 0, unitVat: 0 }
    ])
  }

  // Remove item row
  const removeItemRow = (index: number) => {
    if (newTransferItems.length > 1) {
      setNewTransferItems(newTransferItems.filter((_, i) => i !== index))
    }
  }

  // Update item row
  const updateItemRow = (index: number, field: keyof NewTransferItem, value: any) => {
    const updated = [...newTransferItems]
    updated[index] = { ...updated[index], [field]: value }

    // If item name is entered, try to find matching item
    if (field === "itemName") {
      const matchingItem = items.find(item =>
        item.name.toLowerCase().includes(value.toLowerCase())
      )
      if (matchingItem) {
        updated[index].itemId = matchingItem.id
      } else {
        updated[index].itemId = null
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
              unit: "հատ"
            })
            .select()
            .single()

          if (itemError) throw itemError
          itemId = newItem.id
        }

        itemsToInsert.push({
          item_id: itemId,
          qty: transferItem.qty,
          unit_price: transferItem.unitPrice,
          unit_vat: transferItem.unitVat,
        })
      }

      // Calculate total amount
      const totalAmount = newTransferItems.reduce(
        (sum, item) => sum + ((item.unitPrice + item.unitVat) * item.qty),
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
      setNewTransferItems([{ itemName: "", itemId: null, qty: 1, unitPrice: 0, unitVat: 0 }])
      setCreateTransaction(false)
      setFromAccount(null)
      setToAccount(null)
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
      const { error } = await supabase
        .from("transfer")
        .update({ acepted_at: new Date().toISOString() })
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transfers">Տեղափոխումներ</TabsTrigger>
          <TabsTrigger value="items">Ապրանքներ</TabsTrigger>
        </TabsList>

        {/* Transfers Tab */}
        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Տեղափոխումներ</CardTitle>
              <CardDescription>
                Բոլոր տեղափոխումները այս պահեստից և դեպի այս պահեստ
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <p className="text-muted-foreground">Բեռնում...</p>
                </div>
              ) : transfers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <TruckIcon className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">Տեղափոխումներ չկան</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Սկսած</TableHead>
                      <TableHead>Ուղղություն</TableHead>
                      <TableHead>Դեպի</TableHead>
                      <TableHead>Ստեղծվել է</TableHead>
                      <TableHead>Վիճակ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((transfer) => (
                      <TableRow
                        key={transfer.id}
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => handleTransferClick(transfer)}
                      >
                        <TableCell className="font-medium">#{transfer.id}</TableCell>
                        <TableCell>{transfer.from_warehouse?.name || `#${transfer.from}`}</TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell>{transfer.to_warehouse?.name || `#${transfer.to}`}</TableCell>
                        <TableCell>{formatDate(transfer.created_at)}</TableCell>
                        <TableCell>{getTransferStatus(transfer)}</TableCell>
                      </TableRow>
                    ))}
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
              <CardTitle>Ապրանքների պաշար</CardTitle>
              <CardDescription>
                Հասանելի ապրանքներ այս պահեստում
              </CardDescription>
            </CardHeader>
            <CardContent>
              {warehouseItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground">Ապրանքներ չկան</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Կոդ</TableHead>
                      <TableHead>Անվանում</TableHead>
                      <TableHead>Միավոր</TableHead>
                      <TableHead className="text-right">Քանակ</TableHead>
                      <TableHead className="text-right">Վերջին գին</TableHead>
                      <TableHead className="text-right">Միջին գին</TableHead>
                      <TableHead className="text-right">Ընդհանուր արժեք</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouseItems.map((item) => {
                      const totalValue = item.avg_price != null ? item.avg_price * item.stock_qty : null
                      return (
                        <TableRow
                          key={item.item_id}
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => handleItemClick(item)}
                        >
                          <TableCell className="font-medium">
                            {item.item?.code || `#${item.item_id}`}
                          </TableCell>
                          <TableCell>{item.item?.name || "Անհայտ"}</TableCell>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transfer Items Drawer */}
      <Sheet open={isTransferDrawerOpen} onOpenChange={setIsTransferDrawerOpen}>
        <SheetContent className="sm:max-w-2xl">
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

            {/* Action Buttons */}
            {canModifyTransfer(selectedTransfer) && (
              <div className="flex gap-2 pb-4 border-b">
                {!selectedTransfer?.delivered_at && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedTransfer && handleSetPending(selectedTransfer.id)}
                  >
                    Նշանակել որպես ընթացիկ
                  </Button>
                )}
                {selectedTransfer?.delivered_at && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => selectedTransfer && handleAccept(selectedTransfer.id)}
                  >
                    Ընդունել
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => selectedTransfer && handleReject(selectedTransfer.id)}
                >
                  Մերժել
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
                      <TableCell className="text-right">{item.qty}</TableCell>
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
        <SheetContent className="sm:max-w-2xl">
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
                <span className="text-2xl font-bold">{selectedItem?.stock_qty}</span>
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
                      <TableRow key={index}>
                        <TableCell>{formatDate(transfer.created_at)}</TableCell>
                        <TableCell>{transfer.from_warehouse?.name || `#${transfer.from}`}</TableCell>
                        <TableCell>{transfer.to_warehouse?.name || `#${transfer.to}`}</TableCell>
                        <TableCell className="text-right">
                          {transfer.from === warehouseId ? (
                            <span className="text-red-500">-{transfer.qty}</span>
                          ) : (
                            <span className="text-green-500">+{transfer.qty}</span>
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
        <SheetContent className="w-full sm:max-w-[50vw] overflow-y-auto">
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
                <Select
                  value={fromWarehouse.toString()}
                  onValueChange={(value) => setFromWarehouse(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Դեպի պահեստ</Label>
                <Select
                  value={toWarehouse?.toString() || ""}
                  onValueChange={(value) => setToWarehouse(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ընտրեք պահեստը" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses
                      .filter(w => w.id !== fromWarehouse)
                      .map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
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
                          {accounts.map((account) => (
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
                        .reduce((sum, item) => sum + ((item.unitPrice + item.unitVat) * item.qty), 0)
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
                      <TableHead className="w-[40%]">Անվանում</TableHead>
                      <TableHead className="w-[15%]">Քնկ.</TableHead>
                      <TableHead className="w-[20%]">Գին</TableHead>
                      <TableHead className="w-[15%]">ԱԱՀ</TableHead>
                      <TableHead className="w-[10%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newTransferItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="relative">
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
                                  <option key={i.id} value={i.name} />
                                ))}
                            </datalist>
                            {item.itemId && (
                              <Badge variant="outline" className="absolute -bottom-6 left-0 text-xs">
                                Առկա է
                              </Badge>
                            )}
                            {item.itemName && !item.itemId && (
                              <Badge variant="secondary" className="absolute -bottom-6 left-0 text-xs">
                                Նոր
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.qty}
                            onChange={(e) => updateItemRow(index, "qty", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.unitPrice || ""}
                            onChange={(e) => updateItemRow(index, "unitPrice", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.unitVat || ""}
                            onChange={(e) => updateItemRow(index, "unitVat", Number(e.target.value))}
                          />
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
                        .reduce((sum, item) => sum + ((item.unitPrice + item.unitVat) * item.qty), 0)
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
    </>
  )
}

"use client"

import { useState, useEffect } from "react"
import { emitDataChanged } from "@/hooks/use-data-refresh"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Plus, Trash2, Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { TransactionDetailDrawer } from "@/components/transaction-detail-drawer"

interface Item {
  id: number
  name: string
  unit: string | null
}

interface Account {
  id: number
  name: string
  currency: string
  internal: boolean
}

interface Warehouse {
  id: number
  name: string
  type: string
}

interface PurchaseLine {
  itemId: number | null
  itemName: string
  unit: string
  qty: string
  unitPrice: string
  unitVat: string
}

const emptyLine = (): PurchaseLine => ({ itemId: null, itemName: "", unit: "", qty: "1", unitPrice: "", unitVat: "" })

interface CreatePurchaseDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Prefill from the selected supplier
  supplierWarehouseId: number | null
  supplierAccountId: number | null
  onSuccess?: () => void
}

// Purchase entry: creates a transfer (supplier warehouse → our warehouse) dated
// by the chosen delivery date, optionally with the payment transaction, without
// leaving the current page.
export function CreatePurchaseDrawer({
  open,
  onOpenChange,
  supplierWarehouseId,
  supplierAccountId,
  onSuccess,
}: CreatePurchaseDrawerProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [toWarehouse, setToWarehouse] = useState<number | null>(null)
  const [lines, setLines] = useState<PurchaseLine[]>([emptyLine()])
  const [createTransaction, setCreateTransaction] = useState(true)
  const [fromAccount, setFromAccount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [openItemPicker, setOpenItemPicker] = useState<number | null>(null)
  const [createdTransactionId, setCreatedTransactionId] = useState<number | null>(null)
  const [isTransactionDetailOpen, setIsTransactionDetailOpen] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (!open) return
    setPurchaseDate(new Date().toISOString().split("T")[0])
    setLines([emptyLine()])
    setCreateTransaction(true)
    setFromAccount(null)

    const load = async () => {
      const [whRes, itemRes, accRes, defWhRes] = await Promise.all([
        supabase.from("warehouse").select("id, name, type").order("name"),
        supabase.from("item").select("id, name, unit").is("parent", null).order("name"),
        supabase.from("account").select("id, name, currency, internal").order("name"),
        supabase.from("settings").select("value").eq("key", "default_transfer_warehouse").maybeSingle(),
      ])
      setWarehouses(whRes.data || [])
      setItems(itemRes.data || [])
      setAccounts(accRes.data || [])
      const defWh = defWhRes.data?.value ? Number(defWhRes.data.value) : null
      setToWarehouse(defWh)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const updateLine = (index: number, patch: Partial<PurchaseLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const totalAmount = lines.reduce(
    (sum, l) =>
      sum + (parseFormattedNumber(l.unitPrice) + parseFormattedNumber(l.unitVat)) * parseFormattedNumber(l.qty),
    0
  )

  const supplierWarehouseName =
    warehouses.find((w) => w.id === supplierWarehouseId)?.name || (supplierWarehouseId ? `#${supplierWarehouseId}` : "—")

  const handleSubmit = async () => {
    if (!supplierWarehouseId) {
      toast({ title: "Սխալ", description: "Մատակարարը պահեստ չունի", variant: "destructive" })
      return
    }
    if (!toWarehouse) {
      toast({ title: "Սխալ", description: "Ընտրեք նշանակման պահեստը", variant: "destructive" })
      return
    }
    const filled = lines.filter((l) => l.itemName.trim())
    if (filled.length === 0) {
      toast({ title: "Սխալ", description: "Ավելացրեք նվազագույնը մեկ ապրանք", variant: "destructive" })
      return
    }
    if (createTransaction && (!fromAccount || !supplierAccountId)) {
      toast({ title: "Սխալ", description: "Ընտրեք վճարման հաշիվը", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      // Create or reuse items
      const itemsToInsert: { item_id: number; qty: number; unit_price: number; unit_vat: number }[] = []
      for (const line of filled) {
        let itemId = line.itemId
        if (!itemId) {
          const { data: newItem, error: itemError } = await supabase
            .from("item")
            .insert({
              name: line.itemName.trim(),
              code: `ITM${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
              unit: line.unit || "հատ",
              is_service: false,
            })
            .select("id")
            .single()
          if (itemError) throw itemError
          itemId = newItem.id
        }
        itemsToInsert.push({
          item_id: itemId!,
          qty: parseFormattedNumber(line.qty),
          unit_price: parseFormattedNumber(line.unitPrice),
          unit_vat: parseFormattedNumber(line.unitVat),
        })
      }

      // Optional payment transaction
      let transactionId: number | null = null
      if (createTransaction && fromAccount && supplierAccountId) {
        const { data: tx, error: txError } = await supabase
          .from("transaction")
          .insert({
            from: fromAccount,
            to: supplierAccountId,
            amount: totalAmount,
            note: `Գնում ${supplierWarehouseName}`,
          })
          .select("id")
          .single()
        if (txError) throw txError
        transactionId = tx.id
      }

      // The chosen date is both the transfer date and the delivered date
      const dateIso = purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString()
      const { data: transfer, error: transferError } = await supabase
        .from("transfer")
        .insert({
          from: supplierWarehouseId,
          to: toWarehouse,
          transaction_id: transactionId,
          created_at: dateIso,
          delivered_at: dateIso,
        })
        .select("id")
        .single()
      if (transferError) throw transferError

      const { error: itemsError } = await supabase
        .from("transfer_item")
        .insert(itemsToInsert.map((it) => ({ ...it, transfer_id: transfer.id })))
      if (itemsError) throw itemsError

      toast({
        title: "Հաջողություն",
        description: transactionId
          ? "Գնումը և գործարքը հաջողությամբ ստեղծվեցին"
          : "Գնումը հաջողությամբ ստեղծվեց",
      })

      onOpenChange(false)
      emitDataChanged()
      onSuccess?.()

      // Open the new transaction right away so it can be accepted/rejected
      if (transactionId) {
        setCreatedTransactionId(transactionId)
        setIsTransactionDetailOpen(true)
      }
    } catch (error: any) {
      console.error("Error creating purchase:", error)
      toast({ title: "Սխալ", description: error?.message || "Չհաջողվեց ստեղծել գնումը", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[75vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Ստեղծել գնում</SheetTitle>
            <SheetDescription>
              {supplierWarehouseName} → ձեր պահեստ․ ապրանքները կստեղծվեն ընտրված ամսաթվով
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase-date">Ամսաթիվ (առաքման)</Label>
                <Input
                  id="purchase-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Դեպի պահեստ</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {warehouses.find((w) => w.id === toWarehouse)?.name || "Ընտրեք պահեստը"}
                      </span>
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
                            .filter((w) => !["supplier", "partner"].includes(w.type))
                            .map((w) => (
                              <CommandItem key={w.id} value={w.name} onSelect={() => setToWarehouse(w.id)}>
                                <Check className={cn("mr-2 h-4 w-4", toWarehouse === w.id ? "opacity-100" : "opacity-0")} />
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

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ապրանքներ</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ավելացնել տող
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[34%]">Ապրանք</TableHead>
                      <TableHead className="w-[10%]">Քնկ.</TableHead>
                      <TableHead className="w-[12%]">Միավոր</TableHead>
                      <TableHead className="w-[14%]">Գին</TableHead>
                      <TableHead className="w-[12%]">ԱԱՀ</TableHead>
                      <TableHead className="w-[13%] text-right">Ընդամենը</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Popover open={openItemPicker === index} onOpenChange={(o) => setOpenItemPicker(o ? index : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9">
                                <span className="truncate">{line.itemName || "Ընտրեք ապրանքը"}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[24rem] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
                              <Command>
                                <CommandInput
                                  placeholder="Որոնել կամ գրել նոր անուն..."
                                  value={line.itemName}
                                  onValueChange={(v) => updateLine(index, { itemName: v, itemId: null })}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    <span className="text-xs text-muted-foreground px-2">
                                      Նոր ապրանք՝ «{line.itemName}»
                                    </span>
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {items.map((item) => (
                                      <CommandItem
                                        key={item.id}
                                        value={`${item.name} ${item.unit || ""}`}
                                        onSelect={() => {
                                          updateLine(index, { itemId: item.id, itemName: item.name, unit: item.unit || "" })
                                          setOpenItemPicker(null)
                                        }}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", line.itemId === item.id ? "opacity-100" : "opacity-0")} />
                                        {item.name}
                                        {item.unit && <span className="text-muted-foreground text-xs ml-1">({item.unit})</span>}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell>
                          <Input value={line.qty} onChange={(e) => updateLine(index, { qty: handleNumberInput(e.target.value) })} className="h-9" />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.unit}
                            onChange={(e) => updateLine(index, { unit: e.target.value })}
                            placeholder="հատ"
                            disabled={line.itemId != null}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell>
                          <Input value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: handleNumberInput(e.target.value) })} placeholder="0" className="h-9" />
                        </TableCell>
                        <TableCell>
                          <Input value={line.unitVat} onChange={(e) => updateLine(index, { unitVat: handleNumberInput(e.target.value) })} placeholder="0" className="h-9" />
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {(
                            (parseFormattedNumber(line.unitPrice) + parseFormattedNumber(line.unitVat)) *
                            parseFormattedNumber(line.qty)
                          ).toLocaleString()} ֏
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setLines((p) => p.filter((_, i) => i !== index))}
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
              <div className="flex justify-end items-center gap-3 pt-1">
                <span className="text-sm text-muted-foreground">Ընդհանուր գումար</span>
                <span className="text-xl font-bold">{totalAmount.toLocaleString()} ֏</span>
              </div>
            </div>

            {/* Payment */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Switch id="create-purchase-tx" checked={createTransaction} onCheckedChange={setCreateTransaction} />
                <Label htmlFor="create-purchase-tx" className="cursor-pointer">Ստեղծել գործարք (վճարում)</Label>
              </div>
              {createTransaction && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Վճարող հաշիվ</Label>
                    <Select value={fromAccount?.toString() || ""} onValueChange={(v) => setFromAccount(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Ընտրեք հաշիվը" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => a.internal).map((a) => (
                          <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ստացող հաշիվ</Label>
                    <Input
                      value={accounts.find((a) => a.id === supplierAccountId)?.name || (supplierAccountId ? `#${supplierAccountId}` : "Մատակարարը հաշիվ չունի")}
                      disabled
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Չեղարկել
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ստեղծել
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <TransactionDetailDrawer
        open={isTransactionDetailOpen}
        onOpenChange={setIsTransactionDetailOpen}
        transactionId={createdTransactionId}
      />
    </>
  )
}

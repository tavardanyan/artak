"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, ChevronsUpDown, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

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

interface Warehouse {
  id: number
  name: string
  type: string
}

interface SplitItem {
  item_id: number
  name: string
  unit: string
  originalQty: number
  leftQty: number
  rightQty: number
  // Raw text of the right qty input, so partial decimals like "1." or "0,5" survive typing
  rightInput: string
  unit_price: number
  unit_vat: number
}

type TransferStatus = "draft" | "pending" | "accepted" | "rejected"

interface SplitTransferModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transferId: number
  transferItems: TransferItem[]
  currentFrom: number
  currentTo: number
  invoiceId: string | null
  onSplitComplete: () => void
}

export function SplitTransferModal({
  open,
  onOpenChange,
  transferId,
  transferItems,
  currentFrom,
  currentTo,
  invoiceId,
  onSplitComplete,
}: SplitTransferModalProps) {
  const [splitItems, setSplitItems] = useState<SplitItem[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [leftWarehouse, setLeftWarehouse] = useState<number | null>(currentTo)
  const [rightWarehouse, setRightWarehouse] = useState<number | null>(currentTo)
  const [leftStatus, setLeftStatus] = useState<TransferStatus>("pending")
  const [rightStatus, setRightStatus] = useState<TransferStatus>("pending")
  const [saving, setSaving] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      setSplitItems(
        transferItems.map((item) => ({
          item_id: item.item_id,
          name: item.item?.name || `#${item.item_id}`,
          unit: item.item?.unit || "",
          originalQty: item.qty,
          leftQty: item.qty,
          rightQty: 0,
          rightInput: "0",
          unit_price: item.unit_price,
          unit_vat: item.unit_vat,
        }))
      )
      setLeftWarehouse(currentTo)
      setRightWarehouse(currentTo)
      setLeftStatus("pending")
      setRightStatus("pending")
      fetchWarehouses()
    }
  }, [open, transferItems])

  const fetchWarehouses = async () => {
    const { data } = await supabase
      .from("warehouse")
      .select("id, name, type")
      .order("name")
    setWarehouses(data || [])
  }

  const moveToRight = (index: number) => {
    setSplitItems((prev) => {
      const updated = [...prev]
      const item = { ...updated[index] }
      if (item.leftQty > 0 && item.rightQty === 0) {
        item.rightQty = item.leftQty
        item.rightInput = String(item.rightQty)
        item.leftQty = 0
      }
      updated[index] = item
      return updated
    })
  }

  const moveToLeft = (index: number) => {
    setSplitItems((prev) => {
      const updated = [...prev]
      const item = { ...updated[index] }
      item.leftQty = item.originalQty
      item.rightQty = 0
      item.rightInput = "0"
      updated[index] = item
      return updated
    })
  }

  // Avoid float artifacts like 2.9999999999 when subtracting decimal quantities
  const roundQty = (qty: number) => Math.round(qty * 1e6) / 1e6

  const updateRightQty = (index: number, raw: string) => {
    const normalized = raw.replace(",", ".")
    if (!/^\d*\.?\d*$/.test(normalized)) return

    setSplitItems((prev) => {
      const updated = [...prev]
      const item = { ...updated[index] }
      const parsed = normalized === "" || normalized === "." ? 0 : Number(normalized)
      if (parsed > item.originalQty) {
        item.rightQty = item.originalQty
        item.rightInput = String(item.originalQty)
      } else {
        item.rightQty = parsed
        item.rightInput = normalized
      }
      item.leftQty = roundQty(item.originalQty - item.rightQty)
      updated[index] = item
      return updated
    })
  }

  const normalizeRightInput = (index: number) => {
    setSplitItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], rightInput: String(updated[index].rightQty) }
      return updated
    })
  }

  const getStatusDates = (status: TransferStatus) => {
    const now = new Date().toISOString()
    switch (status) {
      case "draft":
        return { delivered_at: null, acepted_at: null, rejected_at: null }
      case "pending":
        return { delivered_at: now, acepted_at: null, rejected_at: null }
      case "accepted":
        return { delivered_at: now, acepted_at: now, rejected_at: null }
      case "rejected":
        return { delivered_at: now, acepted_at: null, rejected_at: now }
    }
  }

  const rightItems = splitItems.filter((i) => i.rightQty > 0)
  const leftItems = splitItems.filter((i) => i.leftQty > 0)

  const handleSplit = async () => {
    if (rightItems.length === 0) {
      toast({
        title: "\u054d\u056d\u0561\u056c",
        description: "\u0531\u057b \u056f\u0578\u0572\u0574\u056b\u0581 \u0561\u057c\u0576\u057e\u0561\u0566\u0576 \u0574\u0565\u056f \u0561\u057a\u0580\u0561\u0576\u0584 \u057f\u0565\u0572\u0561\u0583\u0578\u056d\u0565\u0584",
        variant: "destructive",
      })
      return
    }
    // A transfer must keep at least one item \u2014 never leave the original empty
    if (leftItems.length === 0) {
      toast({
        title: "\u054d\u056d\u0561\u056c",
        description: "\u0531\u057c\u0561\u057b\u056b\u0576 \u057f\u0565\u0572\u0561\u0583\u0578\u056d\u0578\u0582\u0574\u0568 \u0579\u056b \u056f\u0561\u0580\u0578\u0572 \u0574\u0576\u0561\u056c \u0561\u057c\u0561\u0576\u0581 \u0561\u057a\u0580\u0561\u0576\u0584\u0576\u0565\u0580\u056b",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const leftDates = getStatusDates(leftStatus)
      const rightDates = getStatusDates(rightStatus)

      // 1. Update existing transfer (left side)
      const { error: updateError } = await supabase
        .from("transfer")
        .update({
          to: leftWarehouse,
          ...leftDates,
        })
        .eq("id", transferId)

      if (updateError) throw updateError

      // 2. Delete existing transfer items and re-insert left side items
      const { error: deleteError } = await supabase
        .from("transfer_item")
        .delete()
        .eq("transfer_id", transferId)

      if (deleteError) throw deleteError

      if (leftItems.length > 0) {
        const leftInsertItems = leftItems.map((item) => ({
          transfer_id: transferId,
          item_id: item.item_id,
          qty: item.leftQty,
          unit_price: item.unit_price,
          unit_vat: item.unit_vat,
        }))

        const { error: leftItemsError } = await supabase
          .from("transfer_item")
          .insert(leftInsertItems)

        if (leftItemsError) throw leftItemsError
      }

      // 3. Create new transfer for right side
      const { data: newTransfer, error: newTransferError } = await supabase
        .from("transfer")
        .insert({
          from: currentFrom,
          to: rightWarehouse,
          invoice_id: invoiceId,
          ...rightDates,
        })
        .select("id")
        .single()

      if (newTransferError) throw newTransferError

      // 4. Insert right side items
      const rightInsertItems = rightItems.map((item) => ({
        transfer_id: newTransfer.id,
        item_id: item.item_id,
        qty: item.rightQty,
        unit_price: item.unit_price,
        unit_vat: item.unit_vat,
      }))

      const { error: rightItemsError } = await supabase
        .from("transfer_item")
        .insert(rightInsertItems)

      if (rightItemsError) throw rightItemsError

      toast({
        title: "\u0540\u0561\u057b\u0578\u0572\u0578\u0582\u0569\u0575\u0578\u0582\u0576",
        description: "\u054f\u0565\u0572\u0561\u0583\u0578\u056d\u0578\u0582\u0574\u0568 \u0570\u0561\u057b\u0578\u0572\u0578\u0582\u0569\u0575\u0561\u0574\u0562 \u0562\u0561\u056a\u0561\u0576\u057e\u0565\u0581",
      })

      onOpenChange(false)
      onSplitComplete()
    } catch (error) {
      console.error("Error splitting transfer:", error)
      toast({
        title: "\u054d\u056d\u0561\u056c",
        description: "\u0549\u0570\u0561\u057b\u0578\u0572\u057e\u0565\u0581 \u0562\u0561\u056a\u0561\u0576\u0565\u056c \u057f\u0565\u0572\u0561\u0583\u0578\u056d\u0578\u0582\u0574\u0568",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const calcTotal = (items: SplitItem[], side: "left" | "right") => {
    return items.reduce((sum, item) => {
      const qty = side === "left" ? item.leftQty : item.rightQty
      return sum + (item.unit_price + item.unit_vat) * qty
    }, 0)
  }

  const statusOptions: { value: TransferStatus; label: string }[] = [
    { value: "draft", label: "\u054d\u0565\u0582\u0561\u0563\u056b\u0580" },
    { value: "pending", label: "\u0538\u0576\u0569\u0561\u0581\u056b\u056f" },
    { value: "accepted", label: "\u0538\u0576\u0564\u0578\u0582\u0576\u057e\u0561\u056e" },
    { value: "rejected", label: "\u0544\u0565\u0580\u056a\u057e\u0561\u056e" },
  ]

  const filteredWarehouses = warehouses.filter(w =>
    ["main", "secondary", "temporary", "storage"].includes(w.type)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{"\u0532\u0561\u056a\u0561\u0576\u0565\u056c \u057f\u0565\u0572\u0561\u0583\u0578\u056d\u0578\u0582\u0574\u0568"} #{transferId}</DialogTitle>
          <DialogDescription>
            {"\u054f\u0565\u0572\u0561\u0583\u0578\u056d\u0565\u0584 \u0561\u057a\u0580\u0561\u0576\u0584\u0576\u0565\u0580\u0568 \u0561\u057b \u056f\u0578\u0572\u0574 \u0587 \u0568\u0576\u057f\u0580\u0565\u0584 \u0576\u0577\u0561\u0576\u0561\u056f\u0574\u0561\u0576 \u057a\u0561\u0570\u0565\u057d\u057f \u0587 \u056f\u0561\u0580\u0563\u0561\u057e\u056b\u0573\u0561\u056f"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Destination + status for each side; 3rem middle column matches the arrow column below */}
          <div className="grid grid-cols-[1fr_3rem_1fr]">
            {/* Left Side */}
            <div className="space-y-4 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{"Առաջին տեղափոխում"}</h3>
                <Badge variant="outline">#{transferId}</Badge>
              </div>

              {/* Left Warehouse */}
              <div className="space-y-2">
                <Label>{"Դեպի պահեստ"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {filteredWarehouses.find(w => w.id === leftWarehouse)?.name || "Ընտրեք պահեստը"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
                    <Command>
                      <CommandInput placeholder={"Որոնել պահեստ..."} />
                      <CommandList>
                        <CommandEmpty>{"Պահեստ չի գտնվել"}</CommandEmpty>
                        <CommandGroup>
                          {filteredWarehouses.map((w) => (
                            <CommandItem key={w.id} value={w.name} onSelect={() => setLeftWarehouse(w.id)}>
                              <Check className={cn("mr-2 h-4 w-4", leftWarehouse === w.id ? "opacity-100" : "opacity-0")} />
                              {w.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Left Status */}
              <div className="space-y-2">
                <Label>{"Կարգավիճակ"}</Label>
                <Select value={leftStatus} onValueChange={(v) => setLeftStatus(v as TransferStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div />

            {/* Right Side */}
            <div className="space-y-4 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{"Նոր տեղափոխում"}</h3>
                <Badge variant="secondary">{"Նոր"}</Badge>
              </div>

              {/* Right Warehouse */}
              <div className="space-y-2">
                <Label>{"Դեպի պահեստ"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {filteredWarehouses.find(w => w.id === rightWarehouse)?.name || "Ընտրեք պահեստը"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
                    <Command>
                      <CommandInput placeholder={"Որոնել պահեստ..."} />
                      <CommandList>
                        <CommandEmpty>{"Պահեստ չի գտնվել"}</CommandEmpty>
                        <CommandGroup>
                          {filteredWarehouses.map((w) => (
                            <CommandItem key={w.id} value={w.name} onSelect={() => setRightWarehouse(w.id)}>
                              <Check className={cn("mr-2 h-4 w-4", rightWarehouse === w.id ? "opacity-100" : "opacity-0")} />
                              {w.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Right Status */}
              <div className="space-y-2">
                <Label>{"Կարգավիճակ"}</Label>
                <Select value={rightStatus} onValueChange={(v) => setRightStatus(v as TransferStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Items: one table for both sides so the move arrows always line up with their row */}
          <Table className="table-fixed">
            <colgroup>
              <col />
              <col className="w-[120px]" />
              <col className="w-[130px]" />
              <col className="w-12" />
              <col />
              <col className="w-[120px]" />
              <col className="w-[130px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{"Անվանում"}</TableHead>
                <TableHead className="text-right">{"Քնկ."}</TableHead>
                <TableHead className="text-right">{"Ընդամենը"}</TableHead>
                <TableHead />
                <TableHead>{"Անվանում"}</TableHead>
                <TableHead className="text-right">{"Քնկ."}</TableHead>
                <TableHead className="text-right">{"Ընդամենը"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {splitItems.map((item, index) => (
                <TableRow key={item.item_id}>
                  {/* Left */}
                  <TableCell className={cn("text-sm break-words", item.leftQty === 0 && "opacity-40")}>{item.name}</TableCell>
                  <TableCell className={cn("text-right text-sm font-medium", item.leftQty === 0 && "opacity-40")}>
                    {item.leftQty}
                    {item.unit && <span className="text-muted-foreground text-xs ml-1">{item.unit}</span>}
                  </TableCell>
                  <TableCell className={cn("text-right text-sm", item.leftQty === 0 && "opacity-40")}>
                    {((item.unit_price + item.unit_vat) * item.leftQty).toLocaleString()} ֏
                  </TableCell>

                  {/* Move */}
                  <TableCell className="text-center">
                    {item.rightQty === 0 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => moveToRight(index)}
                        disabled={item.leftQty === 0}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rotate-180"
                        onClick={() => moveToLeft(index)}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>

                  {/* Right */}
                  <TableCell className={cn("text-sm break-words", item.rightQty === 0 && "opacity-40")}>{item.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.unit && <span className="text-muted-foreground text-xs">{item.unit}</span>}
                      <Input
                        type="text"
                        inputMode="decimal"
                        className="w-[80px] h-7 text-sm text-right"
                        value={item.rightInput}
                        onChange={(e) => updateRightQty(index, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => normalizeRightInput(index)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className={cn("text-right text-sm", item.rightQty === 0 && "opacity-40")}>
                    {((item.unit_price + item.unit_vat) * item.rightQty).toLocaleString()} ֏
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-transparent">
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={2} className="font-medium">{"Ընդամենը"}</TableCell>
                <TableCell className="text-right font-bold">{calcTotal(splitItems, "left").toLocaleString()} ֏</TableCell>
                <TableCell />
                <TableCell colSpan={2} className="font-medium">{"Ընդամենը"}</TableCell>
                <TableCell className="text-right font-bold">{calcTotal(splitItems, "right").toLocaleString()} ֏</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {"\u0549\u0565\u0572\u0561\u0580\u056f\u0565\u056c"}
          </Button>
          <Button onClick={handleSplit} disabled={saving || rightItems.length === 0 || leftItems.length === 0}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {"\u0532\u0561\u056a\u0561\u0576\u0565\u056c"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

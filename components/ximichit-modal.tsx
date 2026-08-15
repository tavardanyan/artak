"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface TransferItem {
  item_id: number
  qty: number
  unit_price: number
  unit_vat: number
}

interface XimichitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transferId: number
  transferItems: TransferItem[]
  fromWarehouseId: number
  invoiceId: string | null
  onSuccess: () => void
}

export function XimichitModal({
  open,
  onOpenChange,
  transferId,
  transferItems,
  fromWarehouseId,
  invoiceId,
  onSuccess,
}: XimichitModalProps) {
  const [projects, setProjects] = useState<Array<{ id: number; name: string; code: string; warehouse_id: number | null }>>([])
  const [warehouses, setWarehouses] = useState<Array<{ id: number; name: string; type: string }>>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none")
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchProjects()
      fetchWarehouses()
      setSelectedProjectId("none")
      setSelectedWarehouseId(null)
    }
  }, [open])

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("project")
      .select("id, name, code, warehouse_id")
      .order("name")
    setProjects(data || [])
  }

  const fetchWarehouses = async () => {
    const { data } = await supabase
      .from("warehouse")
      .select("id, name, type")
      .neq("type", "supplier")
      .neq("type", "partner")
      .order("name")
    setWarehouses(data || [])
  }

  // When project changes, auto-select its warehouse
  useEffect(() => {
    if (selectedProjectId === "none") {
      setSelectedWarehouseId(null)
      return
    }
    const proj = projects.find(p => p.id.toString() === selectedProjectId)
    if (proj?.warehouse_id) setSelectedWarehouseId(proj.warehouse_id)
    else setSelectedWarehouseId(null)
  }, [selectedProjectId, projects])

  const handleConfirm = async () => {
    if (!selectedWarehouseId) {
      toast({ title: "Սխալ", description: "Ընտրեք պահեստ", variant: "destructive" })
      return
    }
    // A transfer must have at least one item — don't duplicate an empty one
    if (transferItems.length === 0) {
      toast({ title: "Սխալ", description: "Դատարկ տեղափոխումը հնարավոր չէ կրկնօրինակել", variant: "destructive" })
      return
    }
    if (selectedWarehouseId === fromWarehouseId) {
      toast({ title: "Սխալ", description: "Նպատակային պահեստը չի կարող լինել նույնը, ինչ աղբյուրը", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const now = new Date().toISOString()
      // 1. Mark original as ximichit
      const { error: markError } = await supabase
        .from("transfer")
        .update({ ximichit: true })
        .eq("id", transferId)
      if (markError) throw markError

      // 2. Create duplicate transfer (ximichit=false, accepted, same source, new destination)
      const { data: newTransfer, error: createError } = await supabase
        .from("transfer")
        .insert({
          from: fromWarehouseId,
          to: selectedWarehouseId,
          invoice_id: invoiceId,
          ximichit: false,
          delivered_at: now,
          acepted_at: now,
        })
        .select("id")
        .single()
      if (createError) throw createError

      // 3. Duplicate transfer items
      if (transferItems.length > 0) {
        const items = transferItems.map(it => ({
          transfer_id: newTransfer.id,
          item_id: it.item_id,
          qty: it.qty,
          unit_price: it.unit_price,
          unit_vat: it.unit_vat,
        }))
        const { error: itemsError } = await supabase.from("transfer_item").insert(items)
        if (itemsError) throw itemsError
      }

      toast({ title: "Հաջողություն", description: "Տեղափոխումը նշվեց որպես խիմիչիտ և ստեղծվեց դուբլիկատ" })
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Խիմիչիտ անել</DialogTitle>
          <DialogDescription>
            Ընտրեք նպատակային նախագիծ (ոչ պարտադիր) և պահեստ, որտեղ պետք է ստեղծվի դուբլիկատ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Նախագիծ</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Չընտրել</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Նպատակային պահեստ <span className="text-destructive">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">
                    {selectedWarehouseId ? warehouses.find(w => w.id === selectedWarehouseId)?.name : "Ընտրեք պահեստ"}
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
                      {warehouses.filter(w => w.id !== fromWarehouseId).map((w) => (
                        <CommandItem key={w.id} value={w.name} onSelect={() => setSelectedWarehouseId(w.id)}>
                          <Check className={cn("mr-2 h-4 w-4", selectedWarehouseId === w.id ? "opacity-100" : "opacity-0")} />
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Չեղարկել</Button>
          <Button onClick={handleConfirm} disabled={saving || !selectedWarehouseId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Հաստատել
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

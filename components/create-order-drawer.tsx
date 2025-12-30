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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface Partner {
  id: number
  name: string
  warehouse_id: number | null
  account_id: number | null
  warehouse?: { name: string }
  account?: { name: string; currency: string }
}

interface CreateOrderDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPartnerSelected: (partnerId: number, warehouseId: number, accountId: number) => void
}

export function CreateOrderDrawer({ open, onOpenChange, onPartnerSelected }: CreateOrderDrawerProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchPartners()
    }
  }, [open])

  const fetchPartners = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("partner")
        .select(`
          *,
          warehouse:warehouse_id(name),
          account:account_id(name, currency)
        `)
        .not("warehouse_id", "is", null)
        .not("account_id", "is", null)
        .order("name")

      if (error) throw error
      setPartners(data || [])
    } catch (error) {
      console.error("Error fetching partners:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել գործընկերների ցանկը",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    const partner = partners.find(p => p.id.toString() === selectedPartnerId)
    if (partner && partner.warehouse_id && partner.account_id) {
      onPartnerSelected(partner.id, partner.warehouse_id, partner.account_id)
      onOpenChange(false)
      setSelectedPartnerId("")
    } else {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք ընտրել գործընկերին",
        variant: "destructive",
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Ստեղծել գնում</SheetTitle>
          <SheetDescription>
            Ընտրեք գործընկերին գնում ստեղծելու համար
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label>Գործընկեր</Label>
            <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Ընտրեք գործընկերին" />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="loading" disabled>Բեռնում...</SelectItem>
                ) : partners.length === 0 ? (
                  <SelectItem value="empty" disabled>Գործընկերներ չկան</SelectItem>
                ) : (
                  partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id.toString()}>
                      {partner.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedPartnerId && partners.find(p => p.id.toString() === selectedPartnerId) && (
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <p>Պահեստ: {partners.find(p => p.id.toString() === selectedPartnerId)?.warehouse?.name}</p>
                <p>Հաշիվ: {partners.find(p => p.id.toString() === selectedPartnerId)?.account?.name}</p>
              </div>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleContinue}
            disabled={!selectedPartnerId || loading}
          >
            Շարունակել
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

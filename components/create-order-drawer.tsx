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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Search, Star, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Partner {
  id: number
  name: string
  type: string
  favorite: boolean
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

type PartnerTypeFilter = "favorites" | "all" | "suppliers" | "customers"

export function CreateOrderDrawer({ open, onOpenChange, onPartnerSelected }: CreateOrderDrawerProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("")
  const [typeFilter, setTypeFilter] = useState<PartnerTypeFilter>("favorites")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchPartners()
      setSelectedPartnerId("")
      setSearchQuery("")
    }
  }, [open])

  const fetchPartners = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("partner")
        .select(`
          id, name, type, favorite, warehouse_id, account_id,
          warehouse:warehouse_id(name),
          account:account_id(name, currency)
        `)
        .not("warehouse_id", "is", null)
        .not("account_id", "is", null)
        .order("favorite", { ascending: false })
        .order("name")

      if (error) throw error
      setPartners((data || []) as unknown as Partner[])
    } catch (error: any) {
      console.error("Error fetching partners:", error)
      toast({
        title: "Սխալ",
        description: error?.message || "Չհաջողվեց բեռնել գործընկերների ցանկը",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = async (partner: Partner, e: React.MouseEvent) => {
    e.stopPropagation()
    const newValue = !partner.favorite
    setPartners((prev) => prev.map(p => p.id === partner.id ? { ...p, favorite: newValue } : p))
    const { error } = await supabase.from("partner").update({ favorite: newValue }).eq("id", partner.id)
    if (error) {
      console.error("Error toggling favorite:", error)
      // revert
      setPartners((prev) => prev.map(p => p.id === partner.id ? { ...p, favorite: !newValue } : p))
    }
  }

  const handleContinue = () => {
    const partner = partners.find(p => p.id.toString() === selectedPartnerId)
    if (partner && partner.warehouse_id && partner.account_id) {
      onPartnerSelected(partner.id, partner.warehouse_id, partner.account_id)
      onOpenChange(false)
      setSelectedPartnerId("")
      setTypeFilter("favorites")
      setSearchQuery("")
    } else {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք ընտրել գործընկերին",
        variant: "destructive",
      })
    }
  }

  const filteredPartners = partners.filter((p) => {
    // Type filter
    if (typeFilter === "favorites" && !p.favorite) return false
    if (typeFilter === "suppliers" && p.type !== "supplier") return false
    if (typeFilter === "customers" && p.type !== "client" && p.type !== "customer") return false
    // Search
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const selectedPartner = partners.find(p => p.id.toString() === selectedPartnerId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Ստեղծել գնում</SheetTitle>
          <SheetDescription>
            Ընտրեք գործընկերին գնում ստեղծելու համար
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-3 py-4 min-h-0 px-1">
          <Tabs value={typeFilter} onValueChange={(v) => { setTypeFilter(v as PartnerTypeFilter); setSelectedPartnerId("") }}>
            <TabsList className="w-full">
              <TabsTrigger value="favorites" className="flex-1 text-xs">Ֆավորիտ</TabsTrigger>
              <TabsTrigger value="all" className="flex-1 text-xs">Բոլորը</TabsTrigger>
              <TabsTrigger value="suppliers" className="flex-1 text-xs">Մատակարարներ</TabsTrigger>
              <TabsTrigger value="customers" className="flex-1 text-xs">Հաճախորդներ</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Որոնել գործընկեր..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1 border rounded-md overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPartners.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Գործընկեր չի գտնվել
              </div>
            ) : (
              <div className="divide-y">
                {filteredPartners.map((partner) => {
                  const isSelected = selectedPartnerId === partner.id.toString()
                  return (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedPartnerId(partner.id.toString())}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50",
                        isSelected && "bg-accent"
                      )}
                    >
                      <button
                        onClick={(e) => toggleFavorite(partner, e)}
                        className="shrink-0"
                      >
                        <Star className={cn("h-4 w-4", partner.favorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{partner.name}</p>
                        {partner.warehouse?.name && (
                          <p className="text-xs text-muted-foreground truncate">{partner.warehouse.name}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {selectedPartner && (
            <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-md">
              <p>Ընտրված՝ <span className="font-medium text-foreground">{selectedPartner.name}</span></p>
              <p>Պահեստ: {selectedPartner.warehouse?.name}</p>
              <p>Հաշիվ: {selectedPartner.account?.name}</p>
            </div>
          )}

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

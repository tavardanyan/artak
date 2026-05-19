"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { handleNumberInput, parseFormattedNumber } from "@/lib/utils/number-format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface Partner {
  id: number
  name: string
  warehouse_id: number | null
}

interface PartnerWarehouse {
  id: number
  name: string
  address: string
}

interface CreateProjectDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateProjectDrawer({ open, onOpenChange, onSuccess }: CreateProjectDrawerProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [parentProjects, setParentProjects] = useState<{ id: number; name: string; code: string }[]>([])
  const [parentProjectId, setParentProjectId] = useState("none")
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [type, setType] = useState("construction")
  const [address, setAddress] = useState("")
  const [partnerId, setPartnerId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [agreementDate, setAgreementDate] = useState("")
  const [budget, setBudget] = useState("")
  const [partnerWarehouses, setPartnerWarehouses] = useState<PartnerWarehouse[]>([])
  const [warehouseChoice, setWarehouseChoice] = useState<string>("") // warehouse id as string, or "new"
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (open) {
      fetchPartners()
      fetchParentProjects()
    }
  }, [open])

  const fetchParentProjects = async () => {
    const { data } = await supabase
      .from("project")
      .select("id, name, code")
      .is("parent_project", null)
      .order("name")
    setParentProjects(data || [])
  }

  const fetchPartners = async () => {
    const { data, error } = await supabase
      .from("partner")
      .select("id, name, warehouse_id")
      .eq("type", "customer")
      .order("name")

    if (error) {
      console.error("Error fetching partners:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել գործընկերների ցանկը",
        variant: "destructive",
      })
      return
    }

    setPartners(data || [])
  }

  // Fetch warehouses available for the selected partner: partner.warehouse_id + warehouses used by other projects of this partner
  useEffect(() => {
    if (!partnerId) {
      setPartnerWarehouses([])
      setWarehouseChoice("")
      return
    }
    const fetchWh = async () => {
      const partner = partners.find(p => p.id.toString() === partnerId)
      const ids = new Set<number>()
      if (partner?.warehouse_id) ids.add(partner.warehouse_id)
      const { data: projWh } = await supabase
        .from("project")
        .select("warehouse_id")
        .eq("partner_id", parseInt(partnerId))
        .not("warehouse_id", "is", null)
      ;(projWh || []).forEach((p: any) => p.warehouse_id && ids.add(p.warehouse_id))
      if (ids.size === 0) {
        setPartnerWarehouses([])
        setWarehouseChoice("new")
        return
      }
      const { data: whs } = await supabase
        .from("warehouse")
        .select("id, name, address")
        .in("id", Array.from(ids))
        .order("name")
      setPartnerWarehouses(whs || [])
      // Default to first existing warehouse
      if (whs && whs.length > 0) setWarehouseChoice(whs[0].id.toString())
      else setWarehouseChoice("new")
    }
    fetchWh()
  }, [partnerId, partners])

  const handleSubmit = async () => {
    // Validation
    if (!name || !code || !partnerId) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել պարտադիր դաշտերը",
        variant: "destructive",
      })
      return
    }
    if (!warehouseChoice) {
      toast({
        title: "Սխալ",
        description: "Ընտրեք պահեստ կամ ստեղծեք նորը",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Resolve warehouse_id: either reuse an existing one or create a new one for this partner
      let warehouseId: number | null = null
      if (warehouseChoice === "new") {
        const partner = partners.find(p => p.id.toString() === partnerId)
        const { data: newWh, error: whErr } = await supabase
          .from("warehouse")
          .insert({
            name: `${partner?.name || ""} - ${name}`.trim(),
            address: address || "",
            type: "main",
          })
          .select("id")
          .single()
        if (whErr) throw whErr
        warehouseId = newWh.id
      } else {
        warehouseId = parseInt(warehouseChoice)
      }

      const { data, error } = await supabase
        .from("project")
        .insert({
          name,
          code,
          type,
          address: address || null,
          partner_id: parseInt(partnerId),
          warehouse_id: warehouseId,
          parent_project: parentProjectId === "none" ? null : parseInt(parentProjectId),
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate ? new Date(endDate).toISOString() : null,
          agreement_date: agreementDate ? new Date(agreementDate).toISOString() : null,
          budget: budget ? parseFormattedNumber(budget) : null,
          status: "active",
        })
        .select()

      if (error) {
        console.error("Error creating project:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց ստեղծել նախագիծը",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Հաջողություն",
        description: "Նախագիծը հաջողությամբ ստեղծվեց",
      })

      // Reset form
      setName("")
      setCode("")
      setType("construction")
      setAddress("")
      setPartnerId("")
      setStartDate("")
      setEndDate("")
      setAgreementDate("")
      setBudget("")
      setParentProjectId("none")
      setWarehouseChoice("")
      setPartnerWarehouses([])

      onOpenChange(false)

      if (onSuccess) {
        onSuccess()
      }

      // Navigate to the project page if data is available
      if (data && data[0]) {
        router.push(`/dashboard/projects/${data[0].id}`)
      }
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Անհայտ սխալ",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Ստեղծել նախագիծ</SheetTitle>
          <SheetDescription>
            Լրացրեք նախագծի տվյալները
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              Անվանում <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Նախագծի անվանումը"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">
              Կոդ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="code"
              placeholder="Նախագծի կոդը"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Տեսակ</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="construction">Շինարարություն</SelectItem>
                <SelectItem value="renovation">Վերանորոգում</SelectItem>
                <SelectItem value="design">Դիզայն</SelectItem>
                <SelectItem value="consulting">Խորհրդատվություն</SelectItem>
                <SelectItem value="other">Այլ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent-project">Ծնող նախագիծ</Label>
            <Select value={parentProjectId} onValueChange={setParentProjectId}>
              <SelectTrigger id="parent-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Չունի (հիմնական նախագիծ)</SelectItem>
                {parentProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner">
              Գործընկեր <span className="text-destructive">*</span>
            </Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger id="partner">
                <SelectValue placeholder="Ընտրել գործընկերին" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id.toString()}>
                    {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Հասցե</Label>
            <Input
              id="address"
              placeholder="Նախագծի հասցեն"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {partnerId && (
            <div className="space-y-2">
              <Label htmlFor="warehouse">
                Պահեստ <span className="text-destructive">*</span>
              </Label>
              <Select value={warehouseChoice} onValueChange={setWarehouseChoice}>
                <SelectTrigger id="warehouse">
                  <SelectValue placeholder="Ընտրեք պահեստ" />
                </SelectTrigger>
                <SelectContent>
                  {partnerWarehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.name}{w.address ? ` · ${w.address}` : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Ստեղծել նոր պահեստ</SelectItem>
                </SelectContent>
              </Select>
              {warehouseChoice === "new" && (
                <p className="text-xs text-muted-foreground">
                  Նոր պահեստի հասցեն կլինի՝ {address || <em>(լրացրեք նախագծի հասցեն)</em>}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="agreement-date">Պայմանագրի ամսաթիվ</Label>
            <Input
              id="agreement-date"
              type="date"
              value={agreementDate}
              onChange={(e) => setAgreementDate(e.target.value)}
            />
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

          <div className="space-y-2">
            <Label htmlFor="budget">Բյուջե</Label>
            <Input
              id="budget"
              type="text"
              placeholder="0"
              value={budget}
              onChange={(e) => setBudget(handleNumberInput(e.target.value))}
            />
          </div>
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
            {isSubmitting ? "Ստեղծում..." : "Ստեղծել"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

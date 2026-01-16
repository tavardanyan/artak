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

interface Partner {
  id: number
  name: string
}

interface Project {
  id: number
  name: string
  code: string
  type: string
  address: string | null
  partner_id: number
  start: string | null
  end: string | null
  agreement_date: string | null
  budget: number | null
  status: string
}

interface EditProjectDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  onSuccess?: () => void
}

export function EditProjectDrawer({ open, onOpenChange, project, onSuccess }: EditProjectDrawerProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [name, setName] = useState(project.name)
  const [code, setCode] = useState(project.code)
  const [type, setType] = useState(project.type)
  const [address, setAddress] = useState(project.address || "")
  const [partnerId, setPartnerId] = useState(project.partner_id.toString())
  const [startDate, setStartDate] = useState(
    project.start ? new Date(project.start).toISOString().split("T")[0] : ""
  )
  const [endDate, setEndDate] = useState(
    project.end ? new Date(project.end).toISOString().split("T")[0] : ""
  )
  const [agreementDate, setAgreementDate] = useState(
    project.agreement_date ? new Date(project.agreement_date).toISOString().split("T")[0] : ""
  )
  const [budget, setBudget] = useState(
    project.budget ? handleNumberInput(project.budget.toString()) : ""
  )
  const [status, setStatus] = useState(project.status)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  // Update form when project changes
  useEffect(() => {
    setName(project.name)
    setCode(project.code)
    setType(project.type)
    setAddress(project.address || "")
    setPartnerId(project.partner_id.toString())
    setStartDate(project.start ? new Date(project.start).toISOString().split("T")[0] : "")
    setEndDate(project.end ? new Date(project.end).toISOString().split("T")[0] : "")
    setAgreementDate(project.agreement_date ? new Date(project.agreement_date).toISOString().split("T")[0] : "")
    setBudget(project.budget ? handleNumberInput(project.budget.toString()) : "")
    setStatus(project.status)
  }, [project])

  useEffect(() => {
    if (open) {
      fetchPartners()
    }
  }, [open])

  const fetchPartners = async () => {
    const { data, error } = await supabase
      .from("partner")
      .select("id, name")
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

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from("project")
        .update({
          name,
          code,
          type,
          address: address || null,
          partner_id: parseInt(partnerId),
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate ? new Date(endDate).toISOString() : null,
          agreement_date: agreementDate ? new Date(agreementDate).toISOString() : null,
          budget: budget ? parseFormattedNumber(budget) : null,
          status,
        })
        .eq("id", project.id)

      if (error) {
        console.error("Error updating project:", error)
        toast({
          title: "Սխալ",
          description: "Չհաջողվեց թարմացնել նախագիծը",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Հաջողություն",
        description: "Նախագիծը հաջողությամբ թարմացվեց",
      })

      onOpenChange(false)

      if (onSuccess) {
        onSuccess()
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
          <SheetTitle>Խմբագրել նախագիծը</SheetTitle>
          <SheetDescription>
            Թարմացրեք նախագծի տվյալները
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
            <Label htmlFor="status">Կարգավիճակ</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Պլանավորում</SelectItem>
                <SelectItem value="active">Ակտիվ</SelectItem>
                <SelectItem value="completed">Ավարտված</SelectItem>
                <SelectItem value="cancelled">Չեղարկված</SelectItem>
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
            {isSubmitting ? "Պահպանում..." : "Պահպանել"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

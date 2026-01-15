"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
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
}

interface CreateProjectDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateProjectDrawer({ open, onOpenChange, onSuccess }: CreateProjectDrawerProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [type, setType] = useState("construction")
  const [address, setAddress] = useState("")
  const [partnerId, setPartnerId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [agreementDate, setAgreementDate] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()

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
      const { data, error } = await supabase
        .from("project")
        .insert({
          name,
          code,
          type,
          address: address || null,
          partner_id: parseInt(partnerId),
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate ? new Date(endDate).toISOString() : null,
          agreement_date: agreementDate ? new Date(agreementDate).toISOString() : null,
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

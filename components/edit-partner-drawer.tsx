"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Partner {
  id: number
  name: string
  tin: string | null
  address: string | null
  type: string
  account_id: number | null
  warehouse_id: number | null
}

interface Person {
  id: number
  first_name: string
  last_lame: string | null
  phone: string | null
  email: string | null
}

interface EditPartnerDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  partner: Partner
  onSuccess?: () => void
}

export function EditPartnerDrawer({ open, onOpenChange, partner, onSuccess }: EditPartnerDrawerProps) {
  const [name, setName] = useState(partner.name)
  const [tin, setTin] = useState(partner.tin || "")
  const [address, setAddress] = useState(partner.address || "")
  const [type, setType] = useState(partner.type)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [contacts, setContacts] = useState<Person[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  // Update form when partner changes
  useEffect(() => {
    setName(partner.name)
    setTin(partner.tin || "")
    setAddress(partner.address || "")
    setType(partner.type)
  }, [partner])

  // Fetch related contacts when drawer opens
  useEffect(() => {
    if (open && partner.id) {
      fetchContacts()
    }
  }, [open, partner.id])

  const fetchContacts = async () => {
    setLoadingContacts(true)

    const { data, error } = await supabase
      .from("person")
      .select("id, first_name, last_lame, phone, email")
      .eq("partner_id", partner.id)
      .eq("type", "contact")
      .order("first_name")

    if (!error && data) {
      setContacts(data)
    }

    setLoadingContacts(false)
  }

  const handleSubmit = async () => {
    if (!name) {
      toast({
        title: "Սխալ",
        description: "Խնդրում ենք լրացնել անվանումը",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from("partner")
        .update({
          name,
          tin: tin || null,
          address: address || null,
          type,
        })
        .eq("id", partner.id)

      if (error) throw error

      toast({
        title: "Հաջողություն",
        description: "Գործընկերը հաջողությամբ թարմացվեց",
      })

      onOpenChange(false)

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց թարմացնել գործընկերը",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[50vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Խմբագրել գործընկերի տվյալները</SheetTitle>
          <SheetDescription>
            Թարմացրեք գործընկերի տեղեկատվությունը
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-6 py-6">
          {/* Left Column - Partner Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Գործընկերի տվյալներ</h3>

            <div className="space-y-2">
              <Label htmlFor="name">
                Անվանում <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Գործընկերի անվանումը"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tin">ՀՎՀՀ</Label>
              <Input
                id="tin"
                placeholder="ՀՎՀՀ համարը"
                value={tin}
                onChange={(e) => setTin(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Հասցե</Label>
              <Input
                id="address"
                placeholder="Հասցեն"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Տեսակ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Հաճախորդ</SelectItem>
                  <SelectItem value="supplier">Մատակարար</SelectItem>
                  <SelectItem value="both">Երկուսն էլ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right Column - Related Contacts */}
          <div className="space-y-4">
            <h3 className="font-semibold">Կոնտակտներ ({contacts.length})</h3>

            {loadingContacts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Կոնտակտներ չկան
              </p>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Անուն</TableHead>
                      <TableHead>Հեռախոս</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {contact.first_name} {contact.last_lame || ""}
                            </p>
                            {contact.email && (
                              <p className="text-xs text-muted-foreground">
                                {contact.email}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {contact.phone || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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

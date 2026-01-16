"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Phone, Mail, MapPin, Plus, Loader2, Handshake } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CreatePersonDrawer } from "@/components/create-person-drawer"
import { EditPersonDrawer } from "@/components/edit-person-drawer"
import { EditPartnerDrawer } from "@/components/edit-partner-drawer"

interface Partner {
  id: number
  name: string
  type: string
  tin: string | null
  address: string | null
  account_id: number | null
  warehouse_id: number | null
}

interface Person {
  id: number
  type: string
  first_name: string
  last_lame: string | null
  nickname: string | null
  bday: string | null
  email: string | null
  phone: string | null
  second_phone: string | null
  address: string | null
  position: string | null
  account_id: number | null
  partner_id: number | null
  partner?: Partner
}

function ContactCard({
  contact,
  onClick,
  onPartnerClick
}: {
  contact: Person
  onClick: () => void
  onPartnerClick?: () => void
}) {
  const fullName = `${contact.first_name} ${contact.last_lame || ""}`.trim()
  const initials = `${contact.first_name[0]}${contact.last_lame?.[0] || ""}`.toUpperCase()

  return (
    <Card className="w-full hover:bg-accent/50 transition-colors cursor-pointer" onClick={onClick}>
      <CardContent className="flex items-center gap-6 p-6">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg bg-secondary/10">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{fullName}</h3>
              {contact.position && (
                <p className="text-sm text-muted-foreground">{contact.position}</p>
              )}
              {contact.partner && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPartnerClick?.()
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  <Handshake className="h-3 w-3" />
                  {contact.partner.name}
                </button>
              )}
            </div>
            <Badge variant="secondary">Կոնտակտ</Badge>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.second_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{contact.second_phone}</span>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{contact.address}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [isPartnerDrawerOpen, setIsPartnerDrawerOpen] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchContacts()
  }, [])

  const fetchContacts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("person")
        .select(`
          *,
          partner:partner_id(id, name, type, tin, address, account_id, warehouse_id)
        `)
        .eq("type", "contact")
        .order("first_name")

      if (error) throw error
      setContacts(data || [])
    } catch (error) {
      console.error("Error fetching contacts:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել կոնտակտների ցանկը",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Կոնտակտներ</h2>
          <p className="text-muted-foreground">
            Կառավարեք ձեր կոնտակտների ցանկը
          </p>
        </div>
        <Button onClick={() => setIsDrawerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ավելացնել կոնտակտ
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <p className="text-muted-foreground mb-4">Կոնտակտներ չկան</p>
          <Button onClick={() => setIsDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ավելացնել առաջին կոնտակտը
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {contacts.map((person) => (
            <ContactCard
              key={person.id}
              contact={person}
              onClick={() => {
                setSelectedPerson(person)
                setIsEditDrawerOpen(true)
              }}
              onPartnerClick={
                person.partner
                  ? () => {
                      setSelectedPartner(person.partner!)
                      setIsPartnerDrawerOpen(true)
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <CreatePersonDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        type="contact"
        onSuccess={fetchContacts}
      />

      {selectedPerson && (
        <EditPersonDrawer
          open={isEditDrawerOpen}
          onOpenChange={setIsEditDrawerOpen}
          person={selectedPerson}
          onSuccess={fetchContacts}
        />
      )}

      {selectedPartner && (
        <EditPartnerDrawer
          open={isPartnerDrawerOpen}
          onOpenChange={setIsPartnerDrawerOpen}
          partner={selectedPartner}
          onSuccess={fetchContacts}
        />
      )}
    </div>
  )
}

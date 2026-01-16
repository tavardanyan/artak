"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Phone, Mail, MapPin, Plus, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CreatePersonDrawer } from "@/components/create-person-drawer"
import { EditPersonDrawer } from "@/components/edit-person-drawer"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
}

function StaffCard({ staff, onClick }: { staff: Person; onClick: () => void }) {
  const fullName = `${staff.first_name} ${staff.last_lame || ""}`.trim()
  const initials = `${staff.first_name[0]}${staff.last_lame?.[0] || ""}`.toUpperCase()

  return (
    <Card className="w-full hover:bg-accent/50 transition-colors cursor-pointer" onClick={onClick}>
      <CardContent className="flex items-center gap-6 p-6">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg bg-primary/10">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{fullName}</h3>
              {staff.position && (
                <p className="text-sm text-muted-foreground">{staff.position}</p>
              )}
            </div>
            <Badge variant="default">Աշխատակից</Badge>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {staff.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{staff.phone}</span>
              </div>
            )}
            {staff.second_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{staff.second_phone}</span>
              </div>
            )}
            {staff.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{staff.email}</span>
              </div>
            )}
            {staff.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{staff.address}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [positionFilter, setPositionFilter] = useState<string>("all")
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("person")
        .select("*")
        .eq("type", "staff")
        .order("first_name")

      if (error) throw error
      setStaff(data || [])
    } catch (error) {
      console.error("Error fetching staff:", error)
      toast({
        title: "Սխալ",
        description: "Չհաջողվեց բեռնել աշխատակազմի ցանկը",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredStaff = staff.filter((person) => {
    if (positionFilter === "all") return true
    return person.position === positionFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Աշխատակազմ</h2>
          <p className="text-muted-foreground">
            Կառավարեք ձեր աշխատակազմի անդամներին
          </p>
        </div>
        <Button onClick={() => setIsDrawerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ավելացնել աշխատակից
        </Button>
      </div>

      {/* Position Filter Tabs */}
      <Tabs value={positionFilter} onValueChange={setPositionFilter}>
        <TabsList>
          <TabsTrigger value="all">Բոլորը</TabsTrigger>
          <TabsTrigger value="Տնօրինություն">Տնօրինություն</TabsTrigger>
          <TabsTrigger value="Վարորդ">Վարորդ</TabsTrigger>
          <TabsTrigger value="Արհեստավոր">Արհեստավոր</TabsTrigger>
          <TabsTrigger value="Հաշվապահ">Հաշվապահ</TabsTrigger>
          <TabsTrigger value="Ինժեներ">Ինժեներ</TabsTrigger>
          <TabsTrigger value="Հսկիչ">Հսկիչ</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <p className="text-muted-foreground mb-4">
            {staff.length === 0 ? "Աշխատակիցներ չկան" : "Այս պաշտոնով աշխատակիցներ չկան"}
          </p>
          <Button onClick={() => setIsDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ավելացնել առաջին աշխատակիցը
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStaff.map((person) => (
            <StaffCard
              key={person.id}
              staff={person}
              onClick={() => {
                setSelectedPerson(person)
                setIsEditDrawerOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <CreatePersonDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        type="staff"
        onSuccess={fetchStaff}
      />

      {selectedPerson && (
        <EditPersonDrawer
          open={isEditDrawerOpen}
          onOpenChange={setIsEditDrawerOpen}
          person={selectedPerson}
          onSuccess={fetchStaff}
        />
      )}
    </div>
  )
}

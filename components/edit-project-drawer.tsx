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
import { TaskDrawer } from "@/components/task-drawer"
import {
  ProjectOversightFields,
  EMPTY_OVERSIGHT,
  normalizeOversight,
  oversightToStorage,
  type Oversight,
} from "@/components/project-oversight-fields"

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
  parent_project: number | null
  start: string | null
  end: string | null
  agreement_date: string | null
  budget: number | null
  status: string
  oversight?: any
}

interface EditProjectDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  onSuccess?: () => void
}

export function EditProjectDrawer({ open, onOpenChange, project, onSuccess }: EditProjectDrawerProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [parentProjects, setParentProjects] = useState<{ id: number; name: string; code: string }[]>([])
  const [parentProjectId, setParentProjectId] = useState(project.parent_project?.toString() || "none")
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
  const [oversight, setOversight] = useState<Oversight>(normalizeOversight(project.oversight))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [originalEndDate, setOriginalEndDate] = useState(
    project.end ? new Date(project.end).toISOString().split("T")[0] : ""
  )
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false)
  const [reminderDay, setReminderDay] = useState<Date | undefined>(undefined)

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
    setParentProjectId(project.parent_project?.toString() || "none")
    setOriginalEndDate(project.end ? new Date(project.end).toISOString().split("T")[0] : "")
    setOversight(normalizeOversight(project.oversight))
  }, [project])

  useEffect(() => {
    if (open) {
      fetchPartners()
      fetchParentProjects()
    }
  }, [open, project.id])

  const fetchParentProjects = async () => {
    const { data } = await supabase
      .from("project")
      .select("id, name, code")
      .neq("id", project.id)
      .order("name")
    setParentProjects(data || [])
  }

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
          parent_project: parentProjectId === "none" ? null : parseInt(parentProjectId),
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate ? new Date(endDate).toISOString() : null,
          agreement_date: agreementDate ? new Date(agreementDate).toISOString() : null,
          budget: budget ? parseFormattedNumber(budget) : null,
          status,
          oversight: oversightToStorage(oversight),
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

      const endDateChanged = endDate && endDate !== originalEndDate

      onOpenChange(false)

      if (onSuccess) {
        onSuccess()
      }

      // If the end date was changed to a non-empty value, prompt the user with
      // a prefilled "end approaching" task 14 days before the new end date.
      if (endDateChanged) {
        const end = new Date(endDate)
        const reminder = new Date(end)
        reminder.setDate(reminder.getDate() - 14)
        setReminderDay(reminder)
        setOriginalEndDate(endDate)
        setTaskDrawerOpen(true)
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
      <SheetContent className="overflow-y-auto w-full sm:max-w-[50vw]">
        <SheetHeader>
          <SheetTitle>Խմբագրել նախագիծը</SheetTitle>
          <SheetDescription>
            Թարմացրեք նախագծի տվյալները
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
          <div className="space-y-4">
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

          <div className="space-y-4">
            <ProjectOversightFields value={oversight} onChange={setOversight} />
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
      <TaskDrawer
        open={taskDrawerOpen}
        onOpenChange={setTaskDrawerOpen}
        defaultDay={reminderDay}
        defaultProjectId={project.id}
        defaultTitle="Նախագծի ավարտը մոտենում է"
      />
    </Sheet>
  )
}

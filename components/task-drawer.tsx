"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Trash2, Check } from "lucide-react"

interface Task {
  id: number
  title: string
  text: string | null
  project_id: number | null
  day: string
  seen: boolean
}

interface TaskDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null
  defaultDay?: Date
  defaultProjectId?: number | null
  defaultTitle?: string
  onSuccess?: () => void
}

export function TaskDrawer({ open, onOpenChange, task, defaultDay, defaultProjectId, defaultTitle, onSuccess }: TaskDrawerProps) {
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [projectId, setProjectId] = useState<string>("none")
  const [day, setDay] = useState("")
  const [seen, setSeen] = useState(false)
  const [projects, setProjects] = useState<{ id: number; name: string; code: string }[]>([])
  const [saving, setSaving] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchProjects()
      if (task) {
        setTitle(task.title)
        setText(task.text || "")
        setProjectId(task.project_id ? task.project_id.toString() : "none")
        setDay(new Date(task.day).toISOString().split("T")[0])
        setSeen(task.seen)
      } else {
        setTitle(defaultTitle || "")
        setText("")
        setProjectId(defaultProjectId != null ? defaultProjectId.toString() : "none")
        setDay(defaultDay ? defaultDay.toISOString().split("T")[0] : new Date().toISOString().split("T")[0])
        setSeen(false)
      }
    }
  }, [open, task, defaultDay, defaultProjectId, defaultTitle])

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("project")
      .select("id, name, code")
      .order("name")
    setProjects(data || [])
  }

  const handleSave = async () => {
    if (!title.trim() || !day) {
      toast({ title: "Սխալ", description: "Վերնագիրը և ամսաթիվը պարտադիր են", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        text: text.trim() || null,
        project_id: projectId === "none" ? null : parseInt(projectId),
        day: new Date(day).toISOString(),
        seen,
      }
      if (task) {
        const { error } = await supabase.from("task").update(payload).eq("id", task.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("task").insert(payload)
        if (error) throw error
      }
      toast({ title: "Հաջողություն", description: task ? "Առաջադրանքը թարմացվեց" : "Առաջադրանքը ստեղծվեց" })
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSeen = async () => {
    if (!task) return
    setSaving(true)
    try {
      const newSeen = !task.seen
      const { error } = await supabase.from("task").update({ seen: newSeen }).eq("id", task.id)
      if (error) throw error
      setSeen(newSeen)
      toast({ title: "Հաջողություն", description: newSeen ? "Նշվեց որպես դիտված" : "Նշումը հանվեց" })
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    if (!confirm("Ջնջե՞լ այս առաջադրանքը")) return
    setSaving(true)
    try {
      const { error } = await supabase.from("task").delete().eq("id", task.id)
      if (error) throw error
      toast({ title: "Հաջողություն", description: "Առաջադրանքը ջնջվեց" })
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{task ? "Խմբագրել առաջադրանքը" : "Ստեղծել առաջադրանք"}</SheetTitle>
          <SheetDescription>Լրացրեք առաջադրանքի տվյալները</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label>Վերնագիր <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Առաջադրանքի վերնագիր" />
          </div>

          <div className="space-y-2">
            <Label>Տեքստ</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Նկարագրություն" rows={4} />
          </div>

          <div className="space-y-2">
            <Label>Ամսաթիվ <span className="text-destructive">*</span></Label>
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Նախագիծ</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Չունի</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {task && (
            <div className="pt-4 border-t">
              <Button
                variant={seen ? "outline" : "default"}
                className="w-full"
                onClick={handleToggleSeen}
                disabled={saving}
              >
                <Check className="h-4 w-4 mr-2" />
                {seen ? "Նշել որպես չդիտված" : "Նշել որպես դիտված"}
              </Button>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row justify-between">
          {task ? (
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-2" />
              Ջնջել
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Չեղարկել</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Պահպանել
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

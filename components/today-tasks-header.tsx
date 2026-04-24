"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Calendar, ChevronDown } from "lucide-react"
import { TaskDrawer } from "@/components/task-drawer"
import { cn } from "@/lib/utils"

interface Task {
  id: number
  title: string
  text: string | null
  project_id: number | null
  day: string
  seen: boolean
}

export function TodayTasksHeader() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchTodayTasks()
  }, [])

  const fetchTodayTasks = async () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const { data } = await supabase
      .from("task")
      .select("id, title, text, project_id, day, seen")
      .gte("day", start.toISOString())
      .lte("day", end.toISOString())
      .order("seen", { ascending: true })
    setTasks(data || [])
  }

  const openTask = (task: Task) => {
    setSelectedTask(task)
    setIsDrawerOpen(true)
  }

  if (tasks.length === 0) return null

  // Single task: show as button
  if (tasks.length === 1) {
    const t = tasks[0]
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => openTask(t)}
        >
          <Calendar className={cn("h-4 w-4", t.seen ? "text-muted-foreground" : "text-green-600")} />
          <span className={cn("max-w-[200px] truncate", t.seen && "text-muted-foreground")}>{t.title}</span>
        </Button>
        <TaskDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} task={selectedTask} onSuccess={fetchTodayTasks} />
      </>
    )
  }

  // Multiple tasks: dropdown
  const unseen = tasks.filter(t => !t.seen).length
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Calendar className="h-4 w-4 text-green-600" />
            <span>Այսօր ({tasks.length})</span>
            {unseen > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-xs">{unseen}</Badge>}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Այսօրվա իրադարձությունները</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tasks.map((t) => (
            <DropdownMenuItem key={t.id} onClick={() => openTask(t)} className="gap-2">
              <Calendar className={cn("h-4 w-4", t.seen ? "text-muted-foreground opacity-50" : "text-green-600")} />
              <span className={cn("truncate", t.seen && "text-muted-foreground")}>{t.title}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <TaskDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} task={selectedTask} onSuccess={fetchTodayTasks} />
    </>
  )
}

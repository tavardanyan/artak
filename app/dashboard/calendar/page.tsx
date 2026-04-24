"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, ChevronRight, Plus, Loader2, Clock, AlertCircle, CalendarIcon } from "lucide-react"
import { TaskDrawer } from "@/components/task-drawer"
import { cn } from "@/lib/utils"

type ViewType = "day" | "week" | "month"

interface Task {
  id: number
  title: string
  text: string | null
  project_id: number | null
  day: string
  seen: boolean
  project?: { name: string; code: string }
}

const ARMENIAN_MONTHS = [
  "Հունվար", "Փետրվար", "Մարտ", "Ապրիլ", "Մայիս", "Հունիս",
  "Հուլիս", "Օգոստոս", "Սեպտեմբեր", "Հոկտեմբեր", "Նոյեմբեր", "Դեկտեմբեր",
]

const ARMENIAN_DAYS = ["Երկ", "Երք", "Չրք", "Հնգ", "Ուր", "Շբթ", "Կրկ"]

export default function CalendarPage() {
  const [viewType, setViewType] = useState<ViewType>("month")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tasks, setTasks] = useState<Task[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([])
  const [pastTasks, setPastTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [defaultDay, setDefaultDay] = useState<Date | undefined>()
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchViewSetting()
  }, [])

  useEffect(() => {
    if (settingsLoaded) {
      fetchTasks()
      fetchUnseenTasks()
    }
  }, [currentDate, viewType, settingsLoaded])

  const fetchViewSetting = async () => {
    const { data } = await supabase.from("settings").select("value").eq("key", "calendar_view_type").single()
    if (data?.value) {
      const v = typeof data.value === "string" ? data.value.replace(/"/g, "") : data.value
      if (["day", "week", "month"].includes(v)) setViewType(v as ViewType)
    }
    setSettingsLoaded(true)
  }

  const saveViewSetting = async (v: ViewType) => {
    setViewType(v)
    await supabase.from("settings").upsert({ key: "calendar_view_type", value: v })
  }

  const { rangeStart, rangeEnd } = useMemo(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)
    if (viewType === "day") {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (viewType === "week") {
      // Monday start
      const day = start.getDay() || 7
      start.setDate(start.getDate() - day + 1)
      start.setHours(0, 0, 0, 0)
      end.setTime(start.getTime())
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59, 999)
    } else {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setMonth(end.getMonth() + 1)
      end.setDate(0)
      end.setHours(23, 59, 59, 999)
    }
    return { rangeStart: start, rangeEnd: end }
  }, [currentDate, viewType])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("task")
        .select(`id, title, text, project_id, day, seen, project:project_id(name, code)`)
        .gte("day", rangeStart.toISOString())
        .lte("day", rangeEnd.toISOString())
        .order("day", { ascending: true })
      if (error) throw error
      setTasks((data || []) as unknown as Task[])
    } catch (error: any) {
      console.error("Error:", error)
      toast({ title: "Սխալ", description: error?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchUnseenTasks = async () => {
    const now = new Date().toISOString()
    const [{ data: upcoming }, { data: past }] = await Promise.all([
      supabase
        .from("task")
        .select(`id, title, text, project_id, day, seen, project:project_id(name, code)`)
        .eq("seen", false)
        .gte("day", now)
        .order("day", { ascending: true })
        .limit(20),
      supabase
        .from("task")
        .select(`id, title, text, project_id, day, seen, project:project_id(name, code)`)
        .eq("seen", false)
        .lt("day", now)
        .order("day", { ascending: false })
        .limit(20),
    ])
    setUpcomingTasks((upcoming || []) as unknown as Task[])
    setPastTasks((past || []) as unknown as Task[])
  }

  const navigate = (delta: number) => {
    const d = new Date(currentDate)
    if (viewType === "day") d.setDate(d.getDate() + delta)
    else if (viewType === "week") d.setDate(d.getDate() + delta * 7)
    else d.setMonth(d.getMonth() + delta)
    setCurrentDate(d)
  }

  const formatRangeLabel = () => {
    if (viewType === "day") {
      return `${rangeStart.getDate()} ${ARMENIAN_MONTHS[rangeStart.getMonth()]} ${rangeStart.getFullYear()}`
    }
    if (viewType === "week") {
      const sameMonth = rangeStart.getMonth() === rangeEnd.getMonth()
      if (sameMonth) {
        return `${rangeStart.getDate()} - ${rangeEnd.getDate()} ${ARMENIAN_MONTHS[rangeStart.getMonth()]} ${rangeStart.getFullYear()}`
      }
      return `${rangeStart.getDate()} ${ARMENIAN_MONTHS[rangeStart.getMonth()]} - ${rangeEnd.getDate()} ${ARMENIAN_MONTHS[rangeEnd.getMonth()]} ${rangeEnd.getFullYear()}`
    }
    return `${ARMENIAN_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  const getTasksForDate = (date: Date) => {
    return tasks.filter((t) => {
      const td = new Date(t.day)
      return td.getFullYear() === date.getFullYear() && td.getMonth() === date.getMonth() && td.getDate() === date.getDate()
    })
  }

  // Color classes by task state
  const getTaskColorClass = (task: Task) => {
    const taskDate = new Date(task.day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    taskDate.setHours(0, 0, 0, 0)
    const isPast = taskDate.getTime() < today.getTime()

    if (!isPast && !task.seen) return "bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25"
    if (!isPast && task.seen) return "bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/25"
    if (isPast && task.seen) return "bg-muted text-muted-foreground"
    return "bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/25"
  }

  const openCreateDrawer = (date?: Date) => {
    setSelectedTask(null)
    setDefaultDay(date)
    setIsDrawerOpen(true)
  }

  const openEditDrawer = (task: Task) => {
    setSelectedTask(task)
    setIsDrawerOpen(true)
  }

  const refreshAll = () => {
    fetchTasks()
    fetchUnseenTasks()
  }

  const renderMonthView = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = (firstDay.getDay() || 7) - 1 // Monday=0
    const cells: (Date | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border">
        {ARMENIAN_DAYS.map((d) => (
          <div key={d} className="bg-muted p-2 text-center text-xs font-medium">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="bg-background min-h-[90px]" />
          const dayTasks = getTasksForDate(date)
          const isToday = date.getTime() === today.getTime()
          return (
            <div
              key={i}
              className={cn("bg-background min-h-[90px] p-2 cursor-pointer hover:bg-accent/50", isToday && "ring-2 ring-primary ring-inset")}
              onClick={() => openCreateDrawer(date)}
            >
              <div className="text-xs font-medium mb-1">{date.getDate()}</div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); openEditDrawer(t) }}
                    className={cn("text-xs px-1.5 py-0.5 rounded truncate cursor-pointer", getTaskColorClass(t))}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-muted-foreground">+{dayTasks.length - 3}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderWeekView = () => {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(rangeStart)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map((date, i) => {
          const dayTasks = getTasksForDate(date)
          const isToday = date.getTime() === today.getTime()
          return (
            <div key={i} className={cn("border rounded-md p-3 min-h-[300px]", isToday && "ring-2 ring-primary")}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-muted-foreground">{ARMENIAN_DAYS[i]}</div>
                  <div className="text-lg font-bold">{date.getDate()}</div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreateDrawer(date)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {dayTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => openEditDrawer(t)}
                    className={cn("text-xs px-2 py-1 rounded cursor-pointer", getTaskColorClass(t))}
                  >
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderDayView = () => {
    const dayTasks = getTasksForDate(rangeStart)
    return (
      <Card>
        <CardContent className="pt-6">
          {dayTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Այս օրվա համար առաջադրանքներ չկան</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dayTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => openEditDrawer(t)}
                  className={cn("flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-accent/50", t.seen && "opacity-60")}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{t.title}</p>
                      {t.project && <Badge variant="outline" className="text-xs">{t.project.name}</Badge>}
                      {t.seen && <Badge variant="secondary" className="text-xs">Դիտված</Badge>}
                    </div>
                    {t.text && <p className="text-sm text-muted-foreground mt-1">{t.text}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderView = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )
    }
    if (viewType === "day") return renderDayView()
    if (viewType === "week") return renderWeekView()
    return renderMonthView()
  }

  const formatTaskDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getDate()} ${ARMENIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Օրացույց</h2>
          <p className="text-muted-foreground">Ձեր առաջադրանքների կառավարում</p>
        </div>
        <Button onClick={() => openCreateDrawer()}>
          <Plus className="h-4 w-4 mr-2" />
          Ավելացնել առաջադրանք
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" /> {formatRangeLabel()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tasks.length}</p>
            <p className="text-xs text-muted-foreground">առաջադրանք այս ժամանակահատվածում</p>
            <p className="text-xs text-muted-foreground mt-1">
              Դիտված՝ {tasks.filter(t => t.seen).length} · Դեռ ոչ՝ {tasks.filter(t => !t.seen).length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" /> Առաջիկա (չդիտված)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{upcomingTasks.length}</p>
            {upcomingTasks.length > 0 && (
              <div className="space-y-1 mt-2 max-h-[120px] overflow-y-auto">
                {upcomingTasks.slice(0, 5).map(t => (
                  <div key={t.id} onClick={() => openEditDrawer(t)} className="text-xs cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-muted-foreground"> · {formatTaskDate(t.day)}</span>
                  </div>
                ))}
                {upcomingTasks.length > 5 && <p className="text-xs text-muted-foreground">+ {upcomingTasks.length - 5} այլ</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" /> Անցած, չդիտված
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{pastTasks.length}</p>
            {pastTasks.length > 0 && (
              <div className="space-y-1 mt-2 max-h-[120px] overflow-y-auto">
                {pastTasks.slice(0, 5).map(t => (
                  <div key={t.id} onClick={() => openEditDrawer(t)} className="text-xs cursor-pointer hover:bg-accent/50 rounded px-1 py-0.5">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-muted-foreground"> · {formatTaskDate(t.day)}</span>
                  </div>
                ))}
                {pastTasks.length > 5 && <p className="text-xs text-muted-foreground">+ {pastTasks.length - 5} այլ</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Այսօր</Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 font-medium">{formatRangeLabel()}</span>
        </div>
        <Tabs value={viewType} onValueChange={(v) => saveViewSetting(v as ViewType)}>
          <TabsList>
            <TabsTrigger value="day">Օր</TabsTrigger>
            <TabsTrigger value="week">Շաբաթ</TabsTrigger>
            <TabsTrigger value="month">Ամիս</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {renderView()}

      <TaskDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        task={selectedTask}
        defaultDay={defaultDay}
        onSuccess={refreshAll}
      />
    </div>
  )
}

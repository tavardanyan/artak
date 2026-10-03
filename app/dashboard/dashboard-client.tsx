"use client"

import { useState } from "react"
import { useRole } from "@/hooks/use-role"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TaskDrawer } from "@/components/task-drawer"
import { Plus, Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ProjectSummary {
  id: number
  name: string
  code: string
  warehouse_id: number | null
  budget: number
  tx_income: number
  tx_outcome: number
  contracts_remaining: number
  supplier_debt_real: number
  supplier_debt_ximichit: number
  warehouse_stock_value: number
  completion_docs: CompletionDocSummary[]
}

export interface CompletionDocSummary {
  id: number
  doc_no: number
  created_at: string
  checked_at: string | null
}

// Latest Կատարողական acts listed on a project card
const MAX_CARD_DOCS = 5

export interface DashboardTask {
  id: number
  title: string
  text: string | null
  project_id: number | null
  day: string
  seen: boolean
}

interface Props {
  projects: ProjectSummary[]
  initialTasks: DashboardTask[]
  rangeStartIso: string
  rangeEndIso: string
}

const ARMENIAN_MONTHS = ["Հնվ", "Փտ", "Մրտ", "Ապր", "Մյ", "Հնս", "Հլս", "Օգս", "Սպտ", "Հկտ", "Նյմ", "Դկտ"]
const ARMENIAN_DAYS = ["Կրկ", "Երկ", "Երք", "Չրք", "Հնգ", "Ուր", "Շբթ"]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + " ֏"
}

export default function DashboardClient({ projects, initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [selectedTask, setSelectedTask] = useState<DashboardTask | null>(null)
  const [defaultDay, setDefaultDay] = useState<Date | undefined>()
  const { isAdmin } = useRole()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build 7 days: -3..+3 around today
  const days: Date[] = []
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    days.push(d)
  }

  const getTasksForDate = (date: Date) => {
    return tasks.filter((t) => {
      const td = new Date(t.day)
      return td.getFullYear() === date.getFullYear() && td.getMonth() === date.getMonth() && td.getDate() === date.getDate()
    })
  }

  const getTaskColorClass = (task: DashboardTask) => {
    const taskDate = new Date(task.day)
    taskDate.setHours(0, 0, 0, 0)
    const isPast = taskDate.getTime() < today.getTime()
    if (!isPast && !task.seen) return "bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25"
    if (!isPast && task.seen) return "bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/25"
    if (isPast && task.seen) return "bg-muted text-muted-foreground"
    return "bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/25"
  }

  const openCreate = (date: Date) => {
    setSelectedTask(null)
    setDefaultDay(date)
    setIsDrawerOpen(true)
  }

  const openEdit = (t: DashboardTask) => {
    setSelectedTask(t)
    setDefaultDay(undefined)
    setIsDrawerOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ընդհանուր ակնարկ</h2>
        <p className="text-sm text-muted-foreground">Վերջին նախագծերը և գալիք օրացույցը</p>
      </div>

      {/* Projects Grid */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Վերջին նախագծերը</h3>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Նախագծեր չկան</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const expenses = p.tx_outcome + p.supplier_debt_real
              const shownDocs = p.completion_docs.slice(-MAX_CARD_DOCS).reverse()
              const hiddenDocs = p.completion_docs.length - shownDocs.length
              return (
                // The title link is stretched over the whole card; act links
                // sit above it (z-10) so they open their own Կատարողական
                <Card key={p.id} className="relative hover:bg-accent/30 transition-colors h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">
                          <Link href={`/dashboard/projects/${p.id}`} className="after:absolute after:inset-0">
                            {p.name}
                          </Link>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">{p.code}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {isAdmin && (<>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Պայմանագրային արժեք</span>
                      <span className="font-medium">{p.budget ? formatCurrency(p.budget) : "-"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Մուտքեր</span>
                      <span className="font-medium text-green-600">{formatCurrency(p.tx_income)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ծախսեր</span>
                      <span className="font-medium text-red-600">{formatCurrency(expenses)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Մնում է վճարել</span>
                      <span className={cn("font-medium", p.contracts_remaining > 0 ? "text-red-600" : "text-green-600")}>
                        {formatCurrency(p.contracts_remaining)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Պահեստի արժեք</span>
                      <span className="font-bold">{formatCurrency(p.warehouse_stock_value)}</span>
                    </div>
                    </>)}
                    {p.completion_docs.length > 0 && (
                      <div className={cn("space-y-1", isAdmin && "pt-2 border-t")}>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Կատարողականներ</span>
                          <span>
                            {p.completion_docs.filter((d) => d.checked_at).length}/{p.completion_docs.length} ստուգված
                          </span>
                        </div>
                        {shownDocs.map((d) => (
                          <Link
                            key={d.id}
                            href={`/dashboard/projects/${p.id}?tab=volume&doc=${d.id}`}
                            className="relative z-10 flex items-center justify-between gap-2 text-sm rounded px-1.5 py-0.5 -mx-1.5 hover:bg-accent"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className={cn("h-2 w-2 rounded-full shrink-0", d.checked_at ? "bg-green-500" : "bg-red-500")} />
                              <span className="truncate">Կատարողական {d.doc_no}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {new Date(d.created_at).toLocaleDateString("en-GB")}
                              </span>
                            </span>
                            <Badge variant={d.checked_at ? "success" : "error"} className="shrink-0 px-1.5 text-[10px]">
                              {d.checked_at ? "Ստուգված" : "Չստուգված"}
                            </Badge>
                          </Link>
                        ))}
                        {hiddenDocs > 0 && (
                          <Link
                            href={`/dashboard/projects/${p.id}?tab=volume`}
                            className="relative z-10 block text-xs text-muted-foreground hover:text-foreground"
                          >
                            ևս {hiddenDocs}…
                          </Link>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Mini Calendar */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Օրացույց
          </h3>
          <Link href="/dashboard/calendar">
            <Button variant="outline" size="sm">Բոլորը</Button>
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const isToday = d.getTime() === today.getTime()
            const dayTasks = getTasksForDate(d)
            return (
              <Card
                key={i}
                className={cn(
                  "min-h-[200px] cursor-pointer hover:bg-accent/30 transition-colors",
                  isToday && "ring-2 ring-primary"
                )}
                onClick={() => openCreate(d)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">{ARMENIAN_DAYS[d.getDay()]}</div>
                      <div className="text-2xl font-bold">{d.getDate()}</div>
                      <div className="text-xs text-muted-foreground">{ARMENIAN_MONTHS[d.getMonth()]}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); openCreate(d) }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-1">
                  {dayTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">—</p>
                  )}
                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); openEdit(t) }}
                      className={cn("text-xs px-2 py-1 rounded truncate cursor-pointer", getTaskColorClass(t))}
                    >
                      {t.title}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <TaskDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        task={selectedTask as any}
        defaultDay={defaultDay}
        onSuccess={() => {
          // refresh tasks
          fetch(window.location.pathname).then(() => window.location.reload())
        }}
      />
    </div>
  )
}

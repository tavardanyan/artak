import { createClient } from "@/lib/supabase/server"
import DashboardClient, { ProjectSummary, DashboardTask } from "./dashboard-client"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = await createClient()

  // Last 6 top-level projects
  const { data: latestProjects } = await supabase
    .from("project")
    .select("id, name, code")
    .is("parent_project", null)
    .order("created_at", { ascending: false })
    .limit(6)

  const projects: ProjectSummary[] = []
  if (latestProjects && latestProjects.length > 0) {
    const dashboards = await Promise.all(
      latestProjects.map(async (p) => {
        const { data } = await supabase.rpc("get_project_dashboard", { p_id: p.id })
        return { project: p, dashboard: data }
      })
    )
    for (const { project, dashboard } of dashboards) {
      if (!dashboard) continue
      projects.push({
        id: project.id,
        name: project.name,
        code: project.code,
        warehouse_id: dashboard.warehouse_id ?? null,
        budget: dashboard.budget ?? 0,
        tx_income: dashboard.tx_income ?? 0,
        tx_outcome: dashboard.tx_outcome ?? 0,
        contracts_remaining: dashboard.contracts_remaining ?? 0,
        supplier_debt_real: dashboard.supplier_debt_real ?? 0,
        supplier_debt_ximichit: dashboard.supplier_debt_ximichit ?? 0,
        warehouse_stock_value: dashboard.warehouse_stock_value ?? 0,
      })
    }
  }

  // Tasks for today ±3 days
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - 3)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  end.setDate(end.getDate() + 3)

  const { data: tasks } = await supabase
    .from("task")
    .select("id, title, text, project_id, day, seen")
    .gte("day", start.toISOString())
    .lte("day", end.toISOString())
    .order("day", { ascending: true })

  return (
    <DashboardClient
      projects={projects}
      initialTasks={(tasks || []) as DashboardTask[]}
      rangeStartIso={start.toISOString()}
      rangeEndIso={end.toISOString()}
    />
  )
}

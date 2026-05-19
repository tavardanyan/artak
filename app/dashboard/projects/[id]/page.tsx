import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import ProjectPageClient, { ProjectDashboardData } from "./project-page-client"

export const dynamic = "force-dynamic"

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_project_dashboard", { p_id: parseInt(id) })

  if (error || !data) {
    console.error("Error loading project dashboard:", error)
    notFound()
  }

  return <ProjectPageClient projectId={id} initialDashboard={data as ProjectDashboardData} />
}

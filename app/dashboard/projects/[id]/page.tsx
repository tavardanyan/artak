import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import ProjectPageClient, { ProjectDashboardData } from "./project-page-client"

export const dynamic = "force-dynamic"

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  // Deep links (e.g. from the dashboard): ?tab=volume&doc=<completion doc id>
  const { tab, doc } = await searchParams
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_project_dashboard", { p_id: parseInt(id) })

  if (error || !data) {
    console.error("Error loading project dashboard:", error)
    notFound()
  }

  return (
    <ProjectPageClient
      projectId={id}
      initialDashboard={data as ProjectDashboardData}
      initialTab={typeof tab === "string" ? tab : undefined}
      initialDocId={typeof doc === "string" && Number(doc) > 0 ? Number(doc) : undefined}
    />
  )
}

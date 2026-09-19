import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { autofixProblems } from "@/lib/problems-autofix"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// Manual trigger for the automatic problem fixer (admin only)
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const summary = await autofixProblems(supabase)
  return NextResponse.json(summary)
}

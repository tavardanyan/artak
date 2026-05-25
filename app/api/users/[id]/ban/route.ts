import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function requireUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// POST /api/users/:id/ban  { banned: true|false, durationHours?: number }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser()
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (id === me.id) return NextResponse.json({ error: "Cannot ban yourself" }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const banned: boolean = body?.banned !== false
  const durationHours: number = Number(body?.durationHours) > 0 ? Number(body.durationHours) : 24 * 365 * 100

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: banned ? `${durationHours}h` : "none",
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ user: data.user })
}

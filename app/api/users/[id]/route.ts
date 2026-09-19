import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function requireUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  // User management is admin-only
  if (user && user.app_metadata?.role !== "admin") return null
  return user
}

// Change a user's role (admin | user)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser()
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const role = body?.role
  if (role !== "admin" && role !== "user") {
    return NextResponse.json({ error: "role must be 'admin' or 'user'" }, { status: 400 })
  }
  if (id === me.id && role !== "admin") {
    return NextResponse.json({ error: "Cannot demote yourself" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(id, { app_metadata: { role } })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser()
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (id === me.id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

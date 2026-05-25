import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function requireUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const perPage = Math.min(200, Math.max(1, Number(searchParams.get("perPage") || 50)))
  const search = (searchParams.get("search") || "").trim().toLowerCase()

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let users = data.users
  if (search) {
    users = users.filter((u) =>
      (u.email || "").toLowerCase().includes(search) ||
      (u.phone || "").toLowerCase().includes(search) ||
      (u.id || "").toLowerCase().includes(search)
    )
  }
  return NextResponse.json({ users, total: data.total ?? users.length })
}

export async function POST(request: NextRequest) {
  const me = await requireUser()
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { email, sendInvite } = await request.json()
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const admin = createAdminClient()
  const origin = request.nextUrl.origin
  const redirectTo = `${origin}/auth/callback?next=/auth/set-password`

  if (sendInvite === false) {
    // Create without sending email (random password — user must use forgot-password)
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ user: data.user })
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ user: data.user })
}

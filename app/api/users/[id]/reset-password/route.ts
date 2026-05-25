import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function requireUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// POST /api/users/:id/reset-password — sends a recovery email to the user
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser()
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Look up the user's email
  const { data: target, error: fetchErr } = await admin.auth.admin.getUserById(id)
  if (fetchErr || !target?.user?.email) {
    return NextResponse.json({ error: fetchErr?.message || "User not found" }, { status: 404 })
  }

  const origin = request.nextUrl.origin
  const redirectTo = `${origin}/auth/callback?next=/auth/set-password`

  // The recovery flow goes through the standard reset-password-for-email endpoint.
  // We do this against the admin client so we don't need user context.
  const { error } = await admin.auth.resetPasswordForEmail(target.user.email, { redirectTo })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

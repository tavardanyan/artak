"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export type AppRole = "admin" | "user"

// Role comes from the auth user's app_metadata (set via the users admin API).
// Missing role = regular user. Cached per page load.
let cachedRole: AppRole | null = null
let pending: Promise<AppRole> | null = null

async function fetchRole(): Promise<AppRole> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.app_metadata?.role === "admin" ? "admin" : "user"
}

export function useRole(): { role: AppRole; isAdmin: boolean; roleLoading: boolean } {
  const [role, setRole] = useState<AppRole | null>(cachedRole)

  useEffect(() => {
    if (cachedRole) return
    if (!pending) pending = fetchRole().then((r) => (cachedRole = r))
    pending.then((r) => setRole(r))
  }, [])

  return { role: role ?? "user", isAdmin: role === "admin", roleLoading: role === null }
}

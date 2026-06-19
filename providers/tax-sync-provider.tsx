"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface TaxServiceCredentials {
  tin: string
  login: string
  password: string
}

interface SyncSettings {
  lastSyncDate?: string
  lastAnchor?: number
}

interface TaxSyncContextType {
  credentials: TaxServiceCredentials | null
  syncSettings: SyncSettings | null
  unseenCount: number
  syncing: boolean
  loading: boolean
  triggerSync: () => Promise<void>
  refresh: () => Promise<void>
  autoSyncEnabled: boolean
  setAutoSyncEnabled: (enabled: boolean) => void
}

const TaxSyncContext = createContext<TaxSyncContextType | undefined>(undefined)

const SYNC_INTERVAL = 30 * 60 * 1000 // 30 minutes
const AUTO_SYNC_COOKIE = "tax_sync_enabled"

function readAutoSyncCookie(): boolean {
  if (typeof document === "undefined") return false
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${AUTO_SYNC_COOKIE}=`))
  return match?.split("=")[1] === "1"
}

function writeAutoSyncCookie(enabled: boolean) {
  if (typeof document === "undefined") return
  // 1 year, lax, root scope. Per-device because cookies are stored per browser profile.
  const oneYear = 60 * 60 * 24 * 365
  document.cookie = `${AUTO_SYNC_COOKIE}=${enabled ? "1" : "0"}; Max-Age=${oneYear}; Path=/; SameSite=Lax`
}

export function TaxSyncProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<TaxServiceCredentials | null>(null)
  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null)
  const [unseenCount, setUnseenCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(false)

  // Read per-device toggle from cookie on mount (client only)
  useEffect(() => {
    setAutoSyncEnabledState(readAutoSyncCookie())
  }, [])

  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    writeAutoSyncCookie(enabled)
    setAutoSyncEnabledState(enabled)
  }, [])

  const supabase = createClient()

  const fetchCredentials = async () => {
    try {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "tax_service")
        .single()

      return data?.value as TaxServiceCredentials | null
    } catch (error) {
      console.error("Error fetching credentials:", error)
      return null
    }
  }

  const fetchSyncSettings = async () => {
    try {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "tax_service_sync")
        .single()

      return data?.value as SyncSettings | null
    } catch (error) {
      console.error("Error fetching sync settings:", error)
      return null
    }
  }

  const fetchUnseenCount = async (creds: TaxServiceCredentials) => {
    try {
      const { count } = await supabase
        .from("invoice")
        .select("*", { count: "exact", head: true })
        .eq("buyer_tin", creds.tin)
        .eq("seen", false)

      setUnseenCount(count || 0)
    } catch (error) {
      console.error("Error fetching unseen count:", error)
    }
  }

  const refresh = async () => {
    const creds = await fetchCredentials()
    const settings = await fetchSyncSettings()

    setCredentials(creds)
    setSyncSettings(settings)

    if (creds) {
      await fetchUnseenCount(creds)
    }
  }

  const performSync = useCallback(async () => {
    const creds = credentials
    if (!creds) return

    console.log("[GlobalAutoSync] Starting sync via /api/sync-invoices...")

    try {
      setSyncing(true)
      const res = await fetch("/api/sync-invoices", { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error("[GlobalAutoSync] Sync failed:", json?.error || res.statusText)
        return
      }
      console.log(`[GlobalAutoSync] Done. ${json?.newCount ?? 0} new of ${json?.processed ?? 0}; errors: ${json?.errorCount ?? 0}`)
      // Refresh anchor/settings + unseen count from DB
      await refresh()
    } catch (error) {
      console.error("[GlobalAutoSync] Error:", error)
    } finally {
      setSyncing(false)
    }
    // refresh is stable (no deps); credentials is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials])

  const triggerSync = useCallback(async () => {
    if (syncing) return
    await performSync()
  }, [syncing, performSync])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await refresh()
      setLoading(false)
    }
    init()
  }, [])

  // Auto-sync every 30 minutes — only if the per-device toggle is on
  useEffect(() => {
    if (!autoSyncEnabled) {
      console.log("[GlobalAutoSync] Auto-sync disabled on this device")
      return
    }
    if (!credentials) return

    const scheduleNextSync = () => {
      const lastSync = syncSettings?.lastSyncDate ? new Date(syncSettings.lastSyncDate).getTime() : 0
      const now = Date.now()
      const timeSinceLastSync = now - lastSync
      const timeUntilNextSync = Math.max(0, SYNC_INTERVAL - timeSinceLastSync)

      console.log(`[GlobalAutoSync] Next sync in ${Math.floor(timeUntilNextSync / 1000 / 60)} minutes`)

      return setTimeout(() => {
        performSync()
      }, timeUntilNextSync)
    }

    const timeoutId = scheduleNextSync()

    return () => {
      clearTimeout(timeoutId)
    }
  }, [autoSyncEnabled, credentials, syncSettings, performSync])

  // Refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <TaxSyncContext.Provider
      value={{
        credentials,
        syncSettings,
        unseenCount,
        syncing,
        loading,
        triggerSync,
        refresh,
        autoSyncEnabled,
        setAutoSyncEnabled,
      }}
    >
      {children}
    </TaxSyncContext.Provider>
  )
}

export function useTaxSyncContext() {
  const context = useContext(TaxSyncContext)
  if (context === undefined) {
    throw new Error("useTaxSyncContext must be used within TaxSyncProvider")
  }
  return context
}

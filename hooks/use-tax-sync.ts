"use client"

import { useState, useEffect } from "react"
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

export function useTaxSync() {
  const [credentials, setCredentials] = useState<TaxServiceCredentials | null>(null)
  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null)
  const [unseenCount, setUnseenCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchData()

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)

    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      // Fetch credentials
      const { data: credData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "tax_service")
        .single()

      const creds = credData?.value as TaxServiceCredentials | null
      setCredentials(creds)

      // Fetch sync settings
      const { data: syncData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "tax_service_sync")
        .single()

      setSyncSettings(syncData?.value as SyncSettings | null)

      // Fetch unseen count
      if (creds) {
        const { count } = await supabase
          .from("invoice")
          .select("*", { count: "exact", head: true })
          .eq("buyer_tin", creds.tin)
          .eq("seen", false)

        setUnseenCount(count || 0)
      }
    } catch (error) {
      console.error("Error fetching tax sync data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return null

    const now = Date.now()
    const date = new Date(dateStr).getTime()
    const diff = now - date

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}օ`
    if (hours > 0) return `${hours}ժ`
    if (minutes > 0) return `${minutes}ր`
    return "հիմա"
  }

  return {
    credentials,
    syncSettings,
    unseenCount,
    loading,
    timeAgo: getTimeAgo(syncSettings?.lastSyncDate || null),
    refresh: fetchData,
  }
}

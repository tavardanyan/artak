"use client"

import { useTaxSyncContext } from "@/providers/tax-sync-provider"

export function useTaxSync() {
  const { credentials, syncSettings, unseenCount, syncing, loading, triggerSync, refresh } = useTaxSyncContext()

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
    syncing,
    loading,
    timeAgo: getTimeAgo(syncSettings?.lastSyncDate || null),
    triggerSync,
    refresh,
  }
}

"use client"

import { useEffect, useRef } from "react"

// Global "something changed" signal: shared drawers/modals emit it after any
// successful mutation, and data pages listen to refetch whatever they show.
// This keeps tables fresh even when the mutation happened in a drawer that
// doesn't know which page is underneath (sidebar drawers, nested detail
// drawers, status buttons).
const DATA_CHANGED_EVENT = "app:data-changed"

export function emitDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
  }
}

export function useDataRefresh(callback: () => void) {
  const cbRef = useRef(callback)
  cbRef.current = callback
  useEffect(() => {
    const handler = () => cbRef.current()
    window.addEventListener(DATA_CHANGED_EVENT, handler)
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler)
  }, [])
}

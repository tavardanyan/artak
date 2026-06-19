import { createClient } from "@supabase/supabase-js"

// Server-only client for the external invoice-source Supabase project.
// Never import this file from a "use client" component — the service-role
// key would leak into the browser bundle.
export function createInvoiceSourceClient() {
  const url = process.env.INVOICE_SOURCE_URL
  const key = process.env.INVOICE_SOURCE_SERVICE_KEY
  if (!url || !key) {
    throw new Error("INVOICE_SOURCE_URL and INVOICE_SOURCE_SERVICE_KEY must be set")
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

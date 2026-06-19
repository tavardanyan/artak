// Single source of truth for "what date do we show for an invoice".
// Priority: delivered_at → issued_at → created_at.
// In practice for synced invoices delivered_at is always present; the fallback
// just keeps the UI sane if some local/draft invoice doesn't have it.
export type InvoiceLike = {
  delivered_at?: string | null
  issued_at?: string | null
  created_at?: string | null
}

export function invoiceDisplayDate(inv: InvoiceLike): string | null {
  return inv.delivered_at || inv.issued_at || inv.created_at || null
}

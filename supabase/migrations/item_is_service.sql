-- Items representing services (e.g. delivery, testing) rather than physical goods.
-- Applied to production on 2026-07-03 (migration: item_is_service).
ALTER TABLE public.item ADD COLUMN IF NOT EXISTS is_service boolean NOT NULL DEFAULT false;

-- Backfill: mark items that only ever appear on service-type invoices
UPDATE item SET is_service = true
WHERE id IN (
  SELECT ii.item_id
  FROM invoice_items ii
  JOIN invoice i ON i.id = ii.invoice_id
  WHERE ii.item_id IS NOT NULL
  GROUP BY ii.item_id
  HAVING bool_and(i.type IN ('SERVICES', 'ACC_DOC_SERVICES'))
);

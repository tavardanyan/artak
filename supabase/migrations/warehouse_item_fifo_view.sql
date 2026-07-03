-- FIFO valuation of remaining warehouse stock.
-- Incoming layers (accepted, non-ximichit transfers INTO the warehouse) are ordered
-- by acceptance time; outgoing quantity consumes the OLDEST layers first, so the
-- remaining stock is valued at the prices of the newest incoming layers.
-- Semantics match warehouse_item_stock (accepted, non-ximichit only).
-- Applied to production on 2026-07-03 (migration: warehouse_item_fifo_view).
CREATE OR REPLACE VIEW public.warehouse_item_fifo AS
WITH incoming AS (
  SELECT
    t."to" AS warehouse_id,
    ti.item_id,
    ti.qty,
    COALESCE(ti.unit_amount, 0) AS unit_cost,
    t.acepted_at,
    ti.transfer_id
  FROM transfer_item ti
  JOIN transfer t ON t.id = ti.transfer_id
  WHERE t.acepted_at IS NOT NULL AND COALESCE(t.ximichit, false) = false
),
outgoing AS (
  SELECT
    t."from" AS warehouse_id,
    ti.item_id,
    sum(ti.qty) AS out_qty
  FROM transfer_item ti
  JOIN transfer t ON t.id = ti.transfer_id
  WHERE t.acepted_at IS NOT NULL AND COALESCE(t.ximichit, false) = false
  GROUP BY 1, 2
),
layers AS (
  SELECT
    warehouse_id,
    item_id,
    qty,
    unit_cost,
    sum(qty) OVER (
      PARTITION BY warehouse_id, item_id
      ORDER BY acepted_at, transfer_id
    ) AS cum_qty
  FROM incoming
)
SELECT
  l.warehouse_id,
  l.item_id,
  sum(GREATEST(LEAST(l.qty, l.cum_qty - COALESCE(o.out_qty, 0)), 0)) AS remaining_qty,
  sum(GREATEST(LEAST(l.qty, l.cum_qty - COALESCE(o.out_qty, 0)), 0) * l.unit_cost) AS fifo_value
FROM layers l
LEFT JOIN outgoing o ON o.warehouse_id = l.warehouse_id AND o.item_id = l.item_id
GROUP BY 1, 2;

-- Transfers whose totals or item lines disagree with their invoice.
-- Invoices with multiple transfers are skipped (manual splits/duplicates),
-- as are invoices with no items at all (surfaced separately).
-- Amount tolerance: 50 drams (the amount columns are float; smaller diffs are
-- rounding noise). Lines are compared by resolved item (parent if any), so the
-- intended alias->parent consolidation does not read as a mismatch; lines with
-- no catalog match compare by name (with a name-only item fallback, since
-- historic transfers were built with name-only matching). Line-qty tolerance
-- is 0.01: invoice quantities are float4 vs the transfer's float8.
-- Written in hash-join form (precomputed item lookup maps, keys from two plain
-- joins) — per-line LATERAL probes blew past the statement timeout.

create or replace view problem_transfer_mismatch with (security_invoker = on) as
with single_transfer_invoices as (
  select i.id as invoice_id, min(t.id) as transfer_id
  from invoice i
  join transfer t on t.invoice_id = i.id
  where i.cancelled_at is null
    and exists (select 1 from invoice_items ii where ii.invoice_id = i.id)
  group by i.id
  having count(t.id) = 1
),
item_norm as (
  select lower(trim(name)) as lname,
         coalesce(nullif(lower(trim(unit)), ''), 'հատ') as lunit,
         coalesce(parent, id) as rid
  from item
),
item_by_name_unit as (
  select lname, lunit, min(rid) as rid from item_norm group by 1, 2
),
item_by_name as (
  select lname, min(rid) as rid from item_norm group by 1
),
inv_lines as (
  select ii.invoice_id,
         coalesce('item:' || coalesce(u.rid, n.rid)::text, 'name:' || lower(trim(ii.name))) as line_key,
         sum(ii.quantity) as qty
  from invoice_items ii
  left join item_by_name_unit u
         on u.lname = lower(trim(ii.name))
        and u.lunit = coalesce(nullif(lower(trim(ii.unit)), ''), 'հատ')
  left join item_by_name n on n.lname = lower(trim(ii.name))
  group by 1, 2
),
tr_lines as (
  select ti.transfer_id,
         'item:' || coalesce(it.parent, it.id)::text as line_key,
         sum(ti.qty) as qty
  from transfer_item ti join item it on it.id = ti.item_id
  group by 1, 2
),
keys as (
  select s.invoice_id, s.transfer_id, il.line_key
  from single_transfer_invoices s
  join inv_lines il on il.invoice_id = s.invoice_id
  union
  select s.invoice_id, s.transfer_id, tl.line_key
  from single_transfer_invoices s
  join tr_lines tl on tl.transfer_id = s.transfer_id
),
cmp as (
  select k.invoice_id, k.transfer_id,
         count(*) filter (where il.line_key is null or tl.line_key is null
                          or abs(coalesce(il.qty, 0) - coalesce(tl.qty, 0)) > 0.01) as mismatched_lines
  from keys k
  left join inv_lines il on il.invoice_id = k.invoice_id and il.line_key = k.line_key
  left join tr_lines tl on tl.transfer_id = k.transfer_id and tl.line_key = k.line_key
  group by 1, 2
),
tr_totals as (
  select s.transfer_id, coalesce(sum((ti.unit_price + ti.unit_vat) * ti.qty), 0) as transfer_total
  from single_transfer_invoices s
  left join transfer_item ti on ti.transfer_id = s.transfer_id
  group by 1
)
select
  s.transfer_id,
  t.created_at as transfer_created_at,
  i.id as invoice_id,
  i.serial_no,
  i.issued_at,
  i.delivered_at,
  p.name as supplier_name,
  i.total as invoice_total,
  round(tt.transfer_total::numeric, 2) as transfer_total,
  round((tt.transfer_total - coalesce(i.total, 0))::numeric, 2) as diff,
  abs(coalesce(i.total, 0) - tt.transfer_total) > 50 as total_mismatch,
  c.mismatched_lines > 0 as items_mismatch,
  c.mismatched_lines
from single_transfer_invoices s
join invoice i on i.id = s.invoice_id
join transfer t on t.id = s.transfer_id
left join partner p on p.tin = i.supplier_tin
join cmp c on c.invoice_id = s.invoice_id
join tr_totals tt on tt.transfer_id = s.transfer_id
where abs(coalesce(i.total, 0) - tt.transfer_total) > 50 or c.mismatched_lines > 0;

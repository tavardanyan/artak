-- Views for the "problematic records" page: buyer goods invoices that never
-- got a transfer, invoices with no line items, and transfers with no items.

create or replace view problem_invoice_no_transfer with (security_invoker = on) as
select
  i.id, i.serial_no, i.type, i.created_at, i.issued_at, i.delivered_at,
  i.supplier_tin, i.total_value, i.total_vat_amount, i.total,
  p.name as supplier_name, p.warehouse_id as supplier_warehouse_id
from invoice i
left join partner p on p.tin = i.supplier_tin
where i.cancelled_at is null
  and i.type in ('GOODS', 'ACC_DOC_GOODS', 'SERVICES', 'ACC_DOC_SERVICES')
  and i.buyer_tin = (select value->>'tin' from settings where key = 'tax_service')
  -- invoices with no items are surfaced in their own list, not here
  and exists (select 1 from invoice_items ii where ii.invoice_id = i.id)
  and not exists (select 1 from transfer t where t.invoice_id = i.id);

create or replace view problem_invoice_no_items with (security_invoker = on) as
select
  i.id, i.serial_no, i.type, i.created_at, i.issued_at, i.delivered_at,
  i.supplier_tin, i.total_value, i.total_vat_amount, i.total,
  p.name as supplier_name
from invoice i
left join partner p on p.tin = i.supplier_tin
where i.cancelled_at is null
  and not exists (select 1 from invoice_items ii where ii.invoice_id = i.id);

-- Supplier companies that have invoiced us but have no warehouse assigned,
-- so their invoices cannot get transfers until one is created.
create or replace view problem_partner_no_warehouse with (security_invoker = on) as
select
  p.id, p.name, p.tin, p.address, p.type, p.created_at,
  count(i.id) as invoice_count,
  max(i.issued_at) as last_invoice_at
from partner p
join invoice i on i.supplier_tin = p.tin
  and i.cancelled_at is null
  and i.buyer_tin = (select value->>'tin' from settings where key = 'tax_service')
where p.warehouse_id is null
group by p.id, p.name, p.tin, p.address, p.type, p.created_at;

create or replace view problem_transfer_no_items with (security_invoker = on) as
select
  t.id, t.created_at, t."from", t."to", t.invoice_id,
  wf.name as from_warehouse_name, wt.name as to_warehouse_name,
  i.serial_no as invoice_serial_no
from transfer t
left join warehouse wf on wf.id = t."from"
left join warehouse wt on wt.id = t."to"
left join invoice i on i.id = t.invoice_id
where not exists (select 1 from transfer_item ti where ti.transfer_id = t.id);

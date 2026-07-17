-- Views for the "problematic records" page: buyer goods invoices that never
-- got a transfer, invoices with no line items, and transfers with no items.

create or replace view problem_invoice_no_transfer with (security_invoker = on) as
select
  i.id, i.serial_no, i.type, i.created_at, i.issued_at, i.delivered_at,
  i.supplier_tin, i.total_value, i.total_vat_amount, i.total,
  p.name as supplier_name, p.warehouse_id as supplier_warehouse_id
from invoice i
join partner p on p.tin = i.supplier_tin
where i.cancelled_at is null
  and i.type in ('GOODS', 'ACC_DOC_GOODS')
  and p.warehouse_id is not null
  and i.buyer_tin = (select value->>'tin' from settings where key = 'tax_service')
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

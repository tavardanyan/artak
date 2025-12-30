create or replace view public.account_balance as
select
  a.id as account_id,
  a.name,
  a.currency,
  coalesce(sum(m.amount), 0) as balance
from public.account a
left join (
  select
    t."from" as account_id,
    -t.amount as amount
  from public.transaction t
  where t.accepted_at is not null
    and t.rejected_at is null

  union all

  select
    t."to" as account_id,
    t.amount as amount
  from public.transaction t
  where t.accepted_at is not null
    and t.rejected_at is null
) m on m.account_id = a.id
group by a.id, a.name, a.currency
order by a.name;

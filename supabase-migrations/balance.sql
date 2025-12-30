create or replace view public.account_balance as
select
  a.id as account_id,
  a.name,
  a.currency,

  coalesce(
    sum(
      case
        when t.accepted_at is not null
         and t.rejected_at is null
        then
          case
            when t."to" = a.id then t.amount
            when t."from" = a.id then -t.amount
          end
        else 0
      end
    ),
    0
  ) as balance,

  coalesce(
    sum(
      case
        when t.accepted_at is null
         and t.rejected_at is null
        then
          case
            when t."to" = a.id then t.amount
            when t."from" = a.id then -t.amount
          end
        else 0
      end
    ),
    0
  ) as pending_balance

from public.account a
left join public.transaction t
  on t."from" = a.id
  or t."to" = a.id
group by a.id, a.name, a.currency
order by a.name;

create index if not exists transaction_from_idx
  on public.transaction ("from");

create index if not exists transaction_to_idx
  on public.transaction ("to");

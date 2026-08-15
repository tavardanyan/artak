-- Read-only SQL execution for the AI assistant.
-- The function is SECURITY DEFINER and OWNED BY the ai_readonly role (SELECT-only
-- grants), so any statement it executes runs with read-only permissions.
-- The query is additionally wrapped in a row-capped jsonb aggregation (max 500
-- rows) with a 15s statement timeout.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_readonly') then
    create role ai_readonly nologin;
  end if;
end $$;

grant usage on schema public to ai_readonly;
grant create on schema public to ai_readonly; -- needed to own the function
grant select on all tables in schema public to ai_readonly;
alter default privileges in schema public grant select on tables to ai_readonly;

create or replace function ai_execute_sql(query text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if query !~* '^\s*(select|with)\y' then
    raise exception 'Only SELECT queries are allowed';
  end if;
  execute 'set local statement_timeout = ''15s''';
  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) q limit 500) t',
    query
  ) into result;
  return result;
end;
$$;

grant ai_readonly to postgres;
alter function ai_execute_sql(text) owner to ai_readonly;

revoke all on function ai_execute_sql(text) from public;
grant execute on function ai_execute_sql(text) to authenticated, service_role;

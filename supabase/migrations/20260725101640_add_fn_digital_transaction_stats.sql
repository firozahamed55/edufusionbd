-- Digital-collection KPI tiles were computed by selecting EVERY row of
-- digital_transaction into the browser and reducing in JS. That is both an
-- unbounded transfer on a growth table (audit M-2) and silently wrong the moment
-- the row count passes PostgREST's max-rows ceiling: the tiles would show a
-- confident total for a truncated page. Aggregate in Postgres instead.
--
-- Same shape as fn_unpaid_by_institute: SECURITY DEFINER + SET search_path TO ''
-- + an explicit private.current_institution_id() guard, so tenant isolation does
-- not depend on RLS being reachable from inside a definer function.
create or replace function public.fn_digital_transaction_stats()
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_result jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select jsonb_build_object(
    'total',        count(*),
    'successCount', count(*) filter (where status = 'success'),
    'successTotal', coalesce(sum(amount) filter (where status = 'success'), 0),
    'pendingCount', count(*) filter (where status = 'pending')
  )
  into v_result
  from public.digital_transaction
  where institution_id = v_inst;

  return v_result;
end; $fn$;

revoke execute on function public.fn_digital_transaction_stats() from public, anon;
grant execute on function public.fn_digital_transaction_stats() to authenticated, service_role;
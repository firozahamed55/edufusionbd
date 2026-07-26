-- ============================================================================
-- Phase 1.1 — institution-wide SMS campaign totals.
--
-- The history screen's three tiles summed the rows it had fetched. That was
-- already wrong past the old `limit(100)`, and paging the list would have made
-- it wrong on page one. Same failure mode `fee/logic/api.ts` documents and same
-- remedy as `fn_digital_transaction_stats`: compute it in the database over
-- rows that never leave it.
--
-- Follows the migration-41 RPC convention: body in `private`, permission-checked
-- wrapper in `public`.
-- ============================================================================
create or replace function private.fn_sms_campaign_totals() returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'campaigns',  count(*),
    'recipients', coalesce(sum(recipient_count), 0),
    'cost',       coalesce(sum(est_cost), 0)
  )
  from public.sms_campaign
  where institution_id = private.current_institution_id()
$$;
revoke all on function private.fn_sms_campaign_totals() from authenticated, anon, public;

create or replace function public.fn_sms_campaign_totals() returns jsonb
  language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_permission('sms.view');
  return private.fn_sms_campaign_totals();
end;
$$;
revoke all on function public.fn_sms_campaign_totals() from anon, public;
grant execute on function public.fn_sms_campaign_totals() to authenticated;

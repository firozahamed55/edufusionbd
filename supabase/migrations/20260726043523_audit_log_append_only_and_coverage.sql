-- ============================================================================
-- Phase 0.5 — the audit log becomes append-only and covers what matters.
-- Closes A-H6.
--
-- Two defects, both from `create policy audit_policy ... for all to authenticated`
-- plus a 6-table trigger list:
--   1. `for all` includes DELETE, so the audited party could erase their own
--      trail. An audit log the subject can delete provides no assurance at all,
--      and `features/admin/core/screens/audit-log/` presents it as a control.
--   2. `fee_invoice` was audited but `fee_payment` was not — the claim was
--      logged and the cash movement was not. Privilege changes (`user_role`,
--      `role_permission`) were not logged either.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Append-only.
--
--    There is deliberately NO insert/update/delete policy. The audit trigger
--    is SECURITY DEFINER and therefore writes past RLS; with no policy
--    granting them, no client session can insert, amend or remove a row —
--    including a tenant admin, including the platform admin.
-- ---------------------------------------------------------------------------
drop policy if exists audit_policy on public.audit_log;

create policy audit_read on public.audit_log for select to authenticated
  using ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('audit.read')))
         or (select private.is_platform_admin()));

-- `force row level security` (migration 06) means even the table owner obeys
-- policies, so this closes the loophole for real rather than only for
-- `authenticated`. Revoking the grants makes the intent legible in \dp too.
revoke insert, update, delete on public.audit_log from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Extend coverage: money, people, and privilege.
--
--    Already covered by 05_functions_triggers:
--      mark, exam_result, fee_invoice, student_enrollment, migration_batch, setting
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    -- money
    'fee_payment','digital_transaction','ledger_entry','fee_mapping',
    -- people
    'student','teacher','guardian','profile',
    -- privilege
    'user_role','role','role_permission','institution',
    -- documents that assert something about a person
    'certificate_template','testimonial','transfer_certificate',
    -- spend
    'sms_campaign']
  loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s;', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function private.audit_trigger();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. `private.audit_trigger()` assumes an institution_id column.
--
--    Four of the newly-covered tables break that assumption:
--      institution      — the tenant IS the row (id)
--      role_permission  — reaches it through role
--      profile / user_role — have institution_id, but it is nullable before
--                         the tenant bootstrap completes
--    Without this, `v_inst := (...)::uuid` throws on those tables and the
--    INSERT that fired the trigger fails. An audit trigger that can break a
--    write is worse than no audit trigger.
-- ---------------------------------------------------------------------------
create or replace function private.audit_trigger() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_inst uuid; v_id uuid; v_row jsonb;
begin
  if tg_op = 'DELETE' then v_before := to_jsonb(old); v_after := null;
  elsif tg_op = 'UPDATE' then v_before := to_jsonb(old); v_after := to_jsonb(new);
  else v_before := null; v_after := to_jsonb(new); end if;

  v_row := coalesce(v_after, v_before);
  v_id  := nullif(v_row->>'id', '')::uuid;

  if tg_table_name = 'institution' then
    v_inst := v_id;
  elsif v_row ? 'institution_id' then
    v_inst := nullif(v_row->>'institution_id', '')::uuid;
  elsif v_row ? 'role_id' then
    select r.institution_id into v_inst from public.role r where r.id = (v_row->>'role_id')::uuid;
  end if;

  -- Fall back to the actor's tenant so a row with no resolvable institution
  -- still lands somewhere readable rather than in a null bucket nobody sees.
  v_inst := coalesce(v_inst, private.current_institution_id());

  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, before, after)
  values (v_inst, tg_table_name, v_id, lower(tg_op), auth.uid(), v_before, v_after);
  return coalesce(new, old);
end;
$$;

-- role_permission's PK is (role_id, permission_id) — no `id` column, so
-- entity_id is null for those rows. Documented rather than papered over:
-- the before/after payload carries both ids.

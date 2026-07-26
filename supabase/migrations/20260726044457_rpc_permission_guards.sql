-- ============================================================================
-- Phase 0.2c — permission-guard the RPC surface. The other half of A-C1.
--
-- 090100 fixed the tables. It did not fix the 48 `public.fn_*` functions, and
-- those are SECURITY DEFINER: they run as the owner and therefore bypass RLS
-- entirely. Every one was `grant execute ... to authenticated`, and 0 of 48
-- checked a permission. A parent could POST to /rest/v1/rpc/fn_save_marks,
-- /rest/v1/rpc/fn_collect_fee, /rest/v1/rpc/fn_run_migration or
-- /rest/v1/rpc/fn_purchase_sms_package and the row-level work would land.
--
-- Leaving this open would have made the pgTAP suite actively misleading: it
-- proves a parent cannot UPDATE mark, while an RPC that writes marks stayed
-- one HTTP call away.
--
-- SHAPE OF THE FIX — each function moves to the `private` schema (which
-- PostgREST does not expose) and a same-named wrapper takes its place in
-- `public`. The wrapper checks the permission and forwards. Generated from a
-- map rather than hand-written 48 times, in the same style as the RLS policy
-- generation in migration 06.
--
-- The wrapper is SECURITY DEFINER on purpose: EXECUTE on the inner function is
-- revoked from `authenticated`, so an invoker-rights wrapper could not call it.
-- The permission check reads `auth.uid()` from the request GUC, which survives
-- the role switch.
-- ============================================================================

create or replace function private.require_permission(p_code text) returns void
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_permission(p_code) then
    raise exception 'permission denied: %', p_code using errcode = '42501';
  end if;
end;
$$;
grant execute on function private.require_permission(text) to authenticated;

do $$
declare
  rec text; parts text[]; fname text; perm text; f record; call_args text; body text;
begin
  foreach rec in array array[
    -- reports / reads
    'fn_attendance_summary|attendance.view',
    'fn_digital_transaction_stats|fee.view',
    'fn_fee_income_statement|fee.view',
    'fn_unpaid_by_institute|fee.view',
    'fn_student_report_summary|student.view',
    -- money
    'fn_collect_fee|fee.collect',
    'fn_delete_fee_invoice|fee.void',
    'fn_upsert_fee_mapping|fee.mapping',
    'fn_delete_fee_mapping|fee.mapping',
    -- people
    'fn_register_student|student.create',
    'fn_update_student_basic|student.update',
    'fn_register_teacher|teacher.create',
    'fn_update_teacher|teacher.update',
    'fn_run_migration|student.migrate',
    'fn_pushback_migration|student.migrate',
    -- attendance / examination
    'fn_mark_attendance|attendance.mark',
    'fn_save_marks|exam.mark_entry',
    'fn_process_exam_result|exam.result_process',
    'fn_upsert_exam|exam.manage',
    'fn_save_exam_config|exam.manage',
    -- documents
    'fn_create_admit_batch|certificate.generate',
    'fn_create_id_card_batch|certificate.generate',
    'fn_create_testimonial|certificate.generate',
    'fn_create_transfer|certificate.generate',
    'fn_upsert_certificate_template|certificate.generate',
    'fn_delete_certificate_template|certificate.generate',
    -- communication (SMS spends the school's balance — gate it like a write)
    'fn_send_sms_campaign|sms.send',
    'fn_upsert_sms_template|sms.send',
    'fn_delete_sms_template|sms.send',
    'fn_purchase_sms_package|core.settings',
    'fn_upsert_notice|notice.manage',
    'fn_delete_notice|notice.manage',
    -- institution configuration
    'fn_update_institution|core.settings',
    'fn_save_setting|core.settings',
    'fn_upsert_class|core.settings',
    'fn_delete_class|core.settings',
    'fn_upsert_class_section|core.settings',
    'fn_delete_class_section|core.settings',
    'fn_upsert_subject|core.settings',
    'fn_delete_subject|core.settings',
    'fn_upsert_subject_group|core.settings',
    'fn_delete_subject_group|core.settings',
    'fn_upsert_grade_scheme|core.settings',
    'fn_delete_grade_scheme|core.settings',
    'fn_upsert_signature|core.settings',
    'fn_delete_signature|core.settings',
    -- available to any signed-in member: uploading a file and minting the next
    -- STU-/EMP- code are prerequisites of the guarded actions above, not
    -- privileges of their own. `dashboard.view` is held by every system role.
    'fn_record_file_upload|dashboard.view',
    'fn_generate_code|dashboard.view']
  loop
    parts := string_to_array(rec, '|'); fname := parts[1]; perm := parts[2];

    select p.oid,
           pg_get_function_identity_arguments(p.oid) as idargs,
           pg_get_function_arguments(p.oid)          as args,
           pg_get_function_result(p.oid)             as ret,
           coalesce(array_to_string(p.proargnames, ', '), '') as argnames
      into f
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = fname;

    if f.oid is null then
      raise exception 'rpc guard: public.% does not exist', fname;
    end if;

    execute format('alter function public.%I(%s) set schema private;', fname, f.idargs);
    execute format('revoke all on function private.%I(%s) from authenticated, anon, public;',
                   fname, f.idargs);

    call_args := format('private.%I(%s)', fname, f.argnames);
    -- `returns void` has nothing to hand back; everything else here is scalar
    -- (uuid / integer / text / jsonb), so there is no set-returning branch.
    body := case when f.ret = 'void'
                 then format('perform %s;', call_args)
                 else format('return %s;', call_args) end;

    execute format($f$create function public.%1$I(%2$s) returns %3$s
      language plpgsql security definer set search_path = '' as $b$
      begin
        perform private.require_permission(%4$L);
        %5$s
      end $b$;$f$, fname, f.args, f.ret, perm, body);

    execute format('grant execute on function public.%I(%s) to authenticated;', fname, f.idargs);
  end loop;
end $$;

-- ===== Enable + FORCE RLS on every public table =====
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security;', r.tablename);
    execute format('alter table public.%I force row level security;', r.tablename);
  end loop;
end $$;

-- ===== Generic tenant isolation (tables with institution_id) =====
do $$
declare t text;
begin
  foreach t in array array[
    'subscription','file_object','institution_head','signature','setting','designation','department',
    'student_category','academic_year','academic_term','grade_scheme','class','section','shift','subject',
    'subject_group','class_subject','fee_head','financial_account','teacher','class_section','teacher_assignment',
    'timetable_period','student','student_enrollment','guardian','migration_batch','exam','mark','exam_result',
    'marksheet_config','mark_config','comment_config','exam_date_config','result_sheet_export','academic_calendar',
    'attendance','fee_mapping','fee_invoice','fee_payment','digital_transaction','ledger_entry',
    'sms_provider_account','sms_account','sms_transaction','sms_template','sms_campaign','notice',
    'certificate_template','id_card_batch','admit_card_batch','testimonial','transfer_certificate','seat_plan',
    'export_log','code_sequence']
  loop
    execute format($f$create policy tenant_isolation on public.%1$s for all to authenticated
      using (institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()))
      with check (institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()));$f$, t);
  end loop;
end $$;

-- ===== Child tables (no institution_id) — isolate via parent =====
do $$
declare rec text; parts text[]; c text; p text; fk text;
begin
  foreach rec in array array[
    'grade_scale|grade_scheme|grade_scheme_id',
    'subject_group_member|subject_group|subject_group_id',
    'teacher_address|teacher|teacher_id',
    'teacher_document|teacher|teacher_id',
    'student_address|student|student_id',
    'student_document|student|student_id',
    'student_guardian|student|student_id',
    'migration_student|migration_batch|migration_batch_id',
    'exam_subject|exam|exam_id',
    'result_approval|exam|exam_id',
    'fee_invoice_line|fee_invoice|fee_invoice_id',
    'sms_recipient|sms_campaign|sms_campaign_id',
    'notice_attachment|notice|notice_id',
    'admit_card|admit_card_batch|admit_card_batch_id']
  loop
    parts := string_to_array(rec,'|'); c := parts[1]; p := parts[2]; fk := parts[3];
    execute format($f$create policy tenant_isolation on public.%1$s for all to authenticated
      using (exists (select 1 from public.%2$s par where par.id = %3$s
             and (par.institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()))))
      with check (exists (select 1 from public.%2$s par where par.id = %3$s
             and (par.institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()))));$f$,
      c, p, fk);
  end loop;
end $$;

-- ===== Special-case policies =====
create policy tenant_isolation on public.institution for all to authenticated
  using (id = (select private.current_institution_id()) or (select private.is_platform_admin()))
  with check (id = (select private.current_institution_id()) or (select private.is_platform_admin()));

-- profile: self-access WITHOUT calling tenant helpers on itself (R3 recursion trap)
create policy self_or_tenant on public.profile for all to authenticated
  using (id = (select auth.uid()) or institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()))
  with check (id = (select auth.uid()) or institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()));

create policy role_policy on public.role for all to authenticated
  using (institution_id is null or institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()))
  with check (institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()));

create policy user_role_policy on public.user_role for all to authenticated
  using (profile_id = (select auth.uid()) or institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()))
  with check (institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()));

create policy role_permission_policy on public.role_permission for all to authenticated
  using (exists (select 1 from public.role r where r.id = role_id
         and (r.institution_id is null or r.institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()))))
  with check ((select private.is_platform_admin())
         or exists (select 1 from public.role r where r.id = role_id and r.institution_id = (select private.current_institution_id())));

create policy audit_policy on public.audit_log for all to authenticated
  using (institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()))
  with check (institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()));

create policy notification_policy on public.notification for all to authenticated
  using (profile_id = (select auth.uid()) or (select private.is_platform_admin()))
  with check (profile_id = (select auth.uid()) or (select private.is_platform_admin()));

create policy access_log_policy on public.access_log for all to authenticated
  using (institution_id = (select private.current_institution_id()) or profile_id = (select auth.uid()) or (select private.is_platform_admin()))
  with check (institution_id = (select private.current_institution_id()) or profile_id = (select auth.uid()) or (select private.is_platform_admin()));

-- ===== Global reference tables: read to all authenticated, write to platform admin =====
do $$
declare t text;
begin
  foreach t in array array['education_board','division','district','upazila','plan','permission','sms_package','enum_label']
  loop
    execute format('create policy global_read on public.%1$s for select to authenticated using (true);', t);
    execute format('create policy global_write on public.%1$s for all to authenticated using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));', t);
  end loop;
end $$;

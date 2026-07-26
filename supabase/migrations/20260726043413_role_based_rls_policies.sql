-- ============================================================================
-- Phase 0.2b — role-based RLS. Closes A-C1.
--
-- BEFORE: every table carried one policy — `for all to authenticated` gated on
--         institution_id alone. Any logged-in user could read and write every
--         row in their school: student PII, marks, invoices, staff records,
--         the audit log, and user_role itself.
--
-- AFTER:  every table carries a verb-split pair —
--           <t>_read   FOR SELECT   tenant [+ read permission]
--           <t>_write  FOR ALL      tenant +  write permission
--         Reads that are genuinely shared infrastructure (class lists, the
--         academic calendar, subject catalogue) stay tenant-gated with no
--         permission: they carry no personal data and every screen needs them.
--         Everything that carries PII, money, results or privilege needs the
--         matching permission from the existing 29-code catalogue.
--
-- WHY `for all` FOR THE WRITE HALF: permissive policies OR together per
-- command, so a FOR ALL write policy alongside a FOR SELECT read policy means
-- SELECT = read OR write (write-capable users can obviously read), and
-- INSERT/UPDATE/DELETE = write only. That is the intended lattice and it costs
-- one policy per table instead of four.
--
-- `(select private.has_permission(...))` — the subselect is load-bearing. It
-- makes the call an InitPlan evaluated ONCE per statement instead of once per
-- row. The existing tenant policies get this right; do not unwrap it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tenant tables with a direct institution_id.
--    map: table | read permission ('' = tenant-only read) | write permission
-- ---------------------------------------------------------------------------
do $$
declare rec text; parts text[]; t text; p_read text; p_write text; read_expr text;
begin
  foreach rec in array array[
    -- institution configuration / academic structure: readable by any member,
    -- writable only by someone who can manage settings
    'subscription|core.settings|core.settings',
    'file_object||',
    'institution_head||core.settings',
    'signature||core.settings',
    'setting|core.settings|core.settings',
    'designation||core.settings',
    'department||core.settings',
    'student_category||core.settings',
    'academic_year||core.settings',
    'academic_term||core.settings',
    'grade_scheme||core.settings',
    'class||core.settings',
    'section||core.settings',
    'shift||core.settings',
    'subject||core.settings',
    'subject_group||core.settings',
    'class_subject||core.settings',
    'class_section||core.settings',
    'timetable_period||core.settings',
    'academic_calendar||core.settings',
    'export_log||',
    'code_sequence||',
    -- people: PII
    'teacher|teacher.view|teacher.update',
    'teacher_assignment|teacher.view|teacher.update',
    'student|student.view|student.update',
    'student_enrollment|student.view|student.update',
    'guardian|student.view|student.update',
    'migration_batch|student.view|student.migrate',
    -- attendance
    'attendance|attendance.view|attendance.mark',
    -- examination
    'exam|exam.view|exam.manage',
    'mark|exam.view|exam.mark_entry',
    'exam_result|exam.view|exam.result_process',
    'marksheet_config|exam.view|exam.manage',
    'mark_config|exam.view|exam.manage',
    'comment_config|exam.view|exam.manage',
    'exam_date_config|exam.view|exam.manage',
    'result_sheet_export|exam.view|exam.manage',
    'seat_plan|exam.view|exam.manage',
    -- money
    'fee_head|fee.view|fee.mapping',
    'financial_account|fee.view|fee.mapping',
    'fee_mapping|fee.view|fee.mapping',
    'fee_invoice|fee.view|fee.mapping',
    'fee_payment|fee.view|fee.collect',
    'digital_transaction|fee.view|fee.collect',
    'ledger_entry|fee.view|fee.collect',
    -- communication (notices are read by everyone; SMS is spend, so it is not)
    'sms_provider_account|sms.view|core.settings',
    'sms_account|sms.view|core.settings',
    'sms_transaction|sms.view|sms.send',
    'sms_template|sms.view|sms.send',
    'sms_campaign|sms.view|sms.send',
    'notice||notice.manage',
    -- documents
    'certificate_template|certificate.view|certificate.generate',
    'id_card_batch|certificate.view|certificate.generate',
    'admit_card_batch|certificate.view|certificate.generate',
    'testimonial|certificate.view|certificate.generate',
    'transfer_certificate|certificate.view|certificate.generate']
  loop
    parts := string_to_array(rec, '|');
    t := parts[1]; p_read := nullif(parts[2], ''); p_write := nullif(parts[3], '');

    execute format('drop policy if exists tenant_isolation on public.%I;', t);

    read_expr := 'institution_id = (select private.current_institution_id())';
    if p_read is not null then
      read_expr := read_expr || format(' and (select private.has_permission(%L))', p_read);
    end if;

    execute format($f$create policy %1$I on public.%2$I for select to authenticated
      using (%3$s or (select private.is_platform_admin()));$f$,
      t || '_read', t, read_expr);

    if p_write is null then
      -- No permission code fits (upload metadata, export log, code sequence):
      -- tenancy remains the only gate, exactly as before this migration.
      execute format($f$create policy %1$I on public.%2$I for all to authenticated
        using (institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()))
        with check (institution_id = (select private.current_institution_id()) or (select private.is_platform_admin()));$f$,
        t || '_write', t);
    else
      execute format($f$create policy %1$I on public.%2$I for all to authenticated
        using ((institution_id = (select private.current_institution_id())
                and (select private.has_permission(%3$L)))
               or (select private.is_platform_admin()))
        with check ((institution_id = (select private.current_institution_id())
                and (select private.has_permission(%3$L)))
               or (select private.is_platform_admin()));$f$,
        t || '_write', t, p_write);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Child tables (no institution_id) — tenancy still via the parent lookup,
--    permission inherited from the parent's domain.
--    map: child | parent | fk | read permission | write permission
-- ---------------------------------------------------------------------------
do $$
declare rec text; parts text[]; c text; p text; fk text; p_read text; p_write text;
        tenant_expr text; read_expr text; write_expr text;
begin
  foreach rec in array array[
    'grade_scale|grade_scheme|grade_scheme_id||core.settings',
    'subject_group_member|subject_group|subject_group_id||core.settings',
    'teacher_address|teacher|teacher_id|teacher.view|teacher.update',
    'teacher_document|teacher|teacher_id|teacher.view|teacher.update',
    'student_address|student|student_id|student.view|student.update',
    'student_document|student|student_id|student.view|student.update',
    'student_guardian|student|student_id|student.view|student.update',
    'migration_student|migration_batch|migration_batch_id|student.view|student.migrate',
    'exam_subject|exam|exam_id|exam.view|exam.manage',
    'result_approval|exam|exam_id|exam.view|exam.result_publish',
    'fee_invoice_line|fee_invoice|fee_invoice_id|fee.view|fee.mapping',
    'sms_recipient|sms_campaign|sms_campaign_id|sms.view|sms.send',
    'notice_attachment|notice|notice_id||notice.manage',
    'admit_card|admit_card_batch|admit_card_batch_id|certificate.view|certificate.generate']
  loop
    parts := string_to_array(rec, '|');
    c := parts[1]; p := parts[2]; fk := parts[3];
    p_read := nullif(parts[4], ''); p_write := nullif(parts[5], '');

    execute format('drop policy if exists tenant_isolation on public.%I;', c);

    tenant_expr := format(
      'exists (select 1 from public.%1$I par where par.id = %2$I
               and par.institution_id = (select private.current_institution_id()))',
      p, fk);

    read_expr := tenant_expr;
    if p_read is not null then
      read_expr := read_expr || format(' and (select private.has_permission(%L))', p_read);
    end if;
    write_expr := tenant_expr || format(' and (select private.has_permission(%L))', p_write);

    execute format($f$create policy %1$I on public.%2$I for select to authenticated
      using (%3$s or (select private.is_platform_admin()));$f$, c || '_read', c, read_expr);

    execute format($f$create policy %1$I on public.%2$I for all to authenticated
      using (%3$s or (select private.is_platform_admin()))
      with check (%3$s or (select private.is_platform_admin()));$f$, c || '_write', c, write_expr);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Special-case tables.
-- ---------------------------------------------------------------------------

-- institution: readable by its members, writable only with core.settings.
drop policy if exists tenant_isolation on public.institution;
create policy institution_read on public.institution for select to authenticated
  using (id = (select private.current_institution_id()) or (select private.is_platform_admin()));
create policy institution_write on public.institution for all to authenticated
  using ((id = (select private.current_institution_id()) and (select private.has_permission('core.settings')))
         or (select private.is_platform_admin()))
  with check ((id = (select private.current_institution_id()) and (select private.has_permission('core.settings')))
         or (select private.is_platform_admin()));

-- profile: self-access must NOT call the tenant helpers on profile itself
-- (R3 recursion trap — current_institution_id() reads profile). Everyone in a
-- tenant can see colleagues' names; only core.user_manage can edit someone else.
drop policy if exists self_or_tenant on public.profile;
create policy profile_read on public.profile for select to authenticated
  using (id = (select auth.uid())
         or institution_id = (select private.current_institution_id())
         or (select private.is_platform_admin()));
create policy profile_write on public.profile for all to authenticated
  using (id = (select auth.uid())
         or (institution_id = (select private.current_institution_id())
             and (select private.has_permission('core.user_manage')))
         or (select private.is_platform_admin()))
  with check (id = (select auth.uid())
         or (institution_id = (select private.current_institution_id())
             and (select private.has_permission('core.user_manage')))
         or (select private.is_platform_admin()));

-- role / user_role / role_permission: THE privilege-escalation surface.
-- Before this migration any authenticated user could `insert into user_role`
-- and grant themselves institution_admin. Writes now need core.user_manage.
drop policy if exists role_policy on public.role;
create policy role_read on public.role for select to authenticated
  using (institution_id is null
         or institution_id = (select private.current_institution_id())
         or (select private.is_platform_admin()));
create policy role_write on public.role for all to authenticated
  using ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('core.user_manage')))
         or (select private.is_platform_admin()))
  with check ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('core.user_manage')))
         or (select private.is_platform_admin()));

drop policy if exists user_role_policy on public.user_role;
create policy user_role_read on public.user_role for select to authenticated
  using (profile_id = (select auth.uid())
         or (institution_id = (select private.current_institution_id())
             and (select private.has_permission('core.user_manage')))
         or (select private.is_platform_admin()));
create policy user_role_write on public.user_role for all to authenticated
  using ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('core.user_manage')))
         or (select private.is_platform_admin()))
  with check ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('core.user_manage')))
         or (select private.is_platform_admin()));

drop policy if exists role_permission_policy on public.role_permission;
create policy role_permission_read on public.role_permission for select to authenticated
  using (exists (select 1 from public.role r where r.id = role_id
                 and (r.institution_id is null
                      or r.institution_id = (select private.current_institution_id())))
         or (select private.is_platform_admin()));
create policy role_permission_write on public.role_permission for all to authenticated
  using ((select private.is_platform_admin())
         or (exists (select 1 from public.role r where r.id = role_id
                     and r.institution_id = (select private.current_institution_id()))
             and (select private.has_permission('core.user_manage'))))
  with check ((select private.is_platform_admin())
         or (exists (select 1 from public.role r where r.id = role_id
                     and r.institution_id = (select private.current_institution_id()))
             and (select private.has_permission('core.user_manage'))));

-- access_log: readable by the subject and by settings managers; written by the
-- app on sign-in, so INSERT stays open to the row's own owner. No UPDATE or
-- DELETE policy exists, which makes it append-only for clients.
drop policy if exists access_log_policy on public.access_log;
create policy access_log_read on public.access_log for select to authenticated
  using (profile_id = (select auth.uid())
         or (institution_id = (select private.current_institution_id())
             and (select private.has_permission('audit.read')))
         or (select private.is_platform_admin()));
create policy access_log_insert on public.access_log for insert to authenticated
  with check (profile_id = (select auth.uid()) or (select private.is_platform_admin()));

-- notification stays self-scoped — it was already correct.

-- ============================================================================
-- Phase 0.4 — parent read-only access, scoped to their own children.
--
-- A parent holds a real GoTrue account and a real profile, so after 090100
-- they are an authenticated tenant member with zero permissions: every read
-- policy denies them and the parent portal would see nothing. These policies
-- restore exactly what a parent is entitled to and nothing else.
--
-- Additive by construction: permissive policies for the same command are OR'd,
-- so each `parent_read_*` widens SELECT for guardians without touching the
-- permission-gated policies that govern everyone else. There is deliberately
-- no parent write policy anywhere — a parent cannot change a mark, an
-- attendance record, or an invoice.
--
-- Membership comes from `private.is_guardian_of()` (profile linkage), NOT from
-- a role code. A parent needs no role row, and adding one would not grant
-- anything, because these policies never consult permissions.
-- ============================================================================

-- "Is this account a parent/guardian at all?" — used to widen the few pieces
-- of shared academic context (exam titles, subject rows) that a results screen
-- needs and that are otherwise behind `exam.view`. Cheap, and wrapped in a
-- subselect at every call site so it is an InitPlan, not a per-row call.
create or replace function private.is_parent() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profile pr
                 where pr.id = (select auth.uid())
                   and (pr.linked_guardian_id is not null or pr.linked_student_id is not null))
$$;
grant execute on function private.is_parent() to authenticated;

-- The child themselves, and their enrolment / attendance / results / invoices.
create policy parent_read_student on public.student for select to authenticated
  using ((select private.is_guardian_of(id)));

create policy parent_read_enrollment on public.student_enrollment for select to authenticated
  using ((select private.is_guardian_of(student_id)));

create policy parent_read_attendance on public.attendance for select to authenticated
  using ((select private.is_guardian_of(student_id)));

create policy parent_read_mark on public.mark for select to authenticated
  using ((select private.is_guardian_of(student_id)));

create policy parent_read_exam_result on public.exam_result for select to authenticated
  using ((select private.is_guardian_of(student_id)));

create policy parent_read_fee_invoice on public.fee_invoice for select to authenticated
  using ((select private.is_guardian_of(student_id)));

create policy parent_read_fee_payment on public.fee_payment for select to authenticated
  using ((select private.is_guardian_of(student_id)));

-- Invoice lines have no student_id — reach them through the invoice.
create policy parent_read_fee_invoice_line on public.fee_invoice_line for select to authenticated
  using (exists (select 1 from public.fee_invoice fi
                 where fi.id = fee_invoice_id
                   and (select private.is_guardian_of(fi.student_id))));

-- Context a results/attendance screen cannot render without: which exam, which
-- subject, which section, which year. No personal data in any of them, and the
-- parent must already be a member of the tenant to get this far.
create policy parent_read_exam on public.exam for select to authenticated
  using (institution_id = (select private.current_institution_id())
         and (select private.is_parent()));
create policy parent_read_exam_subject on public.exam_subject for select to authenticated
  using (exists (select 1 from public.exam e where e.id = exam_id
                 and e.institution_id = (select private.current_institution_id()))
         and (select private.is_parent()));
create policy parent_read_fee_head on public.fee_head for select to authenticated
  using (institution_id = (select private.current_institution_id())
         and (select private.is_parent()));
-- (notice, class, section, subject and the rest of the academic structure are
--  already tenant-only reads after 090100 — no parent policy needed.)

-- Their own guardian record and the link rows that prove the relationship.
create policy parent_read_guardian on public.guardian for select to authenticated
  using (exists (select 1 from public.profile pr
                 where pr.id = (select auth.uid()) and pr.linked_guardian_id = guardian.id));

create policy parent_read_student_guardian on public.student_guardian for select to authenticated
  using ((select private.is_guardian_of(student_id)));

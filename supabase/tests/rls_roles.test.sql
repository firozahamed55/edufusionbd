-- ============================================================================
-- Phase 0.6 — the proof artefact for A-C1 / A-C2 / A-H6.
--
-- Run with `supabase test db` (pgTAP via pg_prove). Every assertion below is a
-- security claim, not a behaviour preference: if one fails, the authorization
-- model has regressed. Do not "fix" a failure by relaxing the assertion.
--
-- The fixtures ride on the demo tenant seeded by 11_seed_demo_tenant, which is
-- deterministic: EMP-0001 teaches AND is class teacher of Class 6 / section ক;
-- STU-0005 sits in that section and has an invoice, a mark and an attendance
-- row; STU-0001 sits in Class 7 and is a stranger to both.
-- ============================================================================
begin;
-- Created inside the test transaction and rolled back with it, so pgTAP never
-- lands in a real database. Nothing in production needs this extension.
create extension if not exists pgtap with schema extensions;
select plan(60);

-- ---------------------------------------------------------------------------
-- Fixtures — four accounts on one tenant, differing only in role/linkage.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.mk_user(p_id uuid, p_email text) returns void
  language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated',
          'authenticated', p_email, 'x', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
$$;

-- `handle_new_auth_user` creates the profile row; we only fill in the tenant.
select pg_temp.mk_user('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'rls-admin@test.local');
select pg_temp.mk_user('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'rls-teacher@test.local');
select pg_temp.mk_user('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'rls-parent@test.local');
select pg_temp.mk_user('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'rls-nobody@test.local');

update public.profile p set institution_id = i.id, status = 'active'
from public.institution i where i.eiin = '108234'
  and p.id::text like 'aaaaaaaa-0000-0000-0000-%';

update public.profile set linked_teacher_id = (select id from public.teacher where employee_code = 'EMP-0001')
  where id = 'aaaaaaaa-0000-0000-0000-000000000002'::uuid;

update public.profile set linked_guardian_id = (
    select sg.guardian_id from public.student_guardian sg
    join public.student s on s.id = sg.student_id where s.student_code = 'STU-0005')
  where id = 'aaaaaaaa-0000-0000-0000-000000000003'::uuid;

insert into public.user_role (institution_id, profile_id, role_id)
select r.institution_id, u.pid, r.id
from (values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'institution_admin'),
             ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'teacher')) u(pid, code)
join public.role r on r.code = u.code
join public.institution i on i.id = r.institution_id and i.eiin = '108234';

-- ---------------------------------------------------------------------------
-- A-C1 §1 — a tenant member with NO role sees no personal data.
--   Before Phase 0 every one of these returned the whole school.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);

select is((select count(*) from public.student)::int,     0, 'no-role user reads 0 students');
select is((select count(*) from public.teacher)::int,     0, 'no-role user reads 0 teachers');
select is((select count(*) from public.mark)::int,        0, 'no-role user reads 0 marks');
select is((select count(*) from public.fee_invoice)::int, 0, 'no-role user reads 0 invoices');
select is((select count(*) from public.guardian)::int,    0, 'no-role user reads 0 guardians');
select is((select count(*) from public.audit_log)::int,   0, 'no-role user reads 0 audit rows');

-- Shared academic structure stays readable — it carries no personal data and
-- every screen needs it. This asserts the fix did not over-lock.
select cmp_ok((select count(*) from public.class)::int, '>', 0,
  'no-role user CAN still read the class list (shared structure)');

-- Privilege escalation: granting yourself a role must be rejected outright.
select throws_ok(
  $$insert into public.user_role (institution_id, profile_id, role_id)
    select r.institution_id, 'aaaaaaaa-0000-0000-0000-000000000004'::uuid, r.id
    from public.role r where r.code = 'institution_admin'$$,
  '42501', null, 'no-role user cannot grant themselves a role');

-- Grade tampering and fee erasure: the rows are invisible, so the UPDATE
-- matches nothing. Asserted as "0 rows changed", which is the real guarantee.
with u as (update public.mark set marks_obtained = 100 returning 1)
  select is(count(*)::int, 0, 'no-role user changes 0 marks') from u;
with u as (update public.fee_invoice set due_date = current_date returning 1)
  select is(count(*)::int, 0, 'no-role user changes 0 invoices') from u;

-- ---------------------------------------------------------------------------
-- A-H6 — the audit log is append-only, even for the tenant admin.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok('delete from public.audit_log', '42501', null,
  'admin cannot delete audit rows');
select throws_ok($$update public.audit_log set action = 'x'$$, '42501', null,
  'admin cannot amend audit rows');
select throws_ok(
  $$insert into public.audit_log (entity, action) values ('forged','insert')$$,
  '42501', null, 'admin cannot forge audit rows');

-- The admin path itself must be unbroken — the whole point is to lock down
-- everyone else without locking out the people who run the school.
select is((select count(*) from public.student)::int, 12, 'admin still reads every student');
select cmp_ok((select count(*) from public.audit_log)::int, '>', 0, 'admin can READ the audit log');

-- ---------------------------------------------------------------------------
-- A-C1 §2 — a teacher is scoped to the sections they teach.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is((select count(distinct class_section_id) from public.student_enrollment)::int, 1,
  'teacher sees exactly their own section, not all 5');
select ok((select bool_and(cs.class_id = (select id from public.class where numeric_level = 6))
           from public.attendance a join public.class_section cs on cs.id = a.class_section_id),
  'every attendance row a teacher sees belongs to the class they teach');
select is((select count(*) from public.fee_invoice)::int, 0,
  'teacher has no fee.view, so reads 0 invoices');
select is((select count(*) from public.audit_log)::int, 0,
  'teacher has no audit.read, so reads 0 audit rows');

-- ---------------------------------------------------------------------------
-- A-C1 §3 — a parent sees their own child and nothing else.
--   This is the exit criterion named in the audit roadmap.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);

select is((select count(*) from public.student)::int, 1, 'parent reads exactly one student');
select is((select student_code from public.student), 'STU-0005', 'and it is their own child');
select is((select count(*) from public.teacher)::int, 0, 'parent reads 0 staff records');
with u as (update public.mark set marks_obtained = 100 returning 1)
  select is(count(*)::int, 0, 'parent changes 0 marks') from u;

-- ---------------------------------------------------------------------------
-- A-C1 §4 — the RPC surface. SECURITY DEFINER functions bypass RLS, so table
-- policies alone would leave every one of these one HTTP call away from a
-- parent's session. Still the parent's JWT here.
-- ---------------------------------------------------------------------------
select throws_ok($$select public.fn_save_marks('{}'::jsonb)$$, '42501', null,
  'parent cannot call fn_save_marks');
select throws_ok($$select public.fn_collect_fee('{}'::jsonb)$$, '42501', null,
  'parent cannot call fn_collect_fee');
select throws_ok($$select public.fn_run_migration('{}'::jsonb)$$, '42501', null,
  'parent cannot call fn_run_migration');
select throws_ok($$select public.fn_purchase_sms_package(null::uuid)$$, '42501', null,
  'parent cannot spend the school SMS balance');
select throws_ok($$select public.fn_update_institution('{}'::jsonb)$$, '42501', null,
  'parent cannot rewrite the institution record');

-- The inner implementations must not be reachable directly either — `private`
-- is off PostgREST's exposed schemas, but EXECUTE is revoked as well so the
-- guarantee does not depend on that configuration staying put.
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname like 'fn\_%'
             and has_function_privilege('authenticated', p.oid, 'execute'))::int,
          0, 'no private.fn_* implementation is executable by authenticated');

-- Nothing may re-enter public unguarded: every exposed fn_* checks a permission.
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'fn\_%'
             and has_function_privilege('authenticated', p.oid, 'execute')
             and pg_get_functiondef(p.oid) not like '%require_permission%')::int,
          0, 'every authenticated-callable public.fn_* has a permission guard');

-- ---------------------------------------------------------------------------
-- A-H5 — attendance and mark are partitioned by academic_year_id, and every
-- row lands in a real partition (never DEFAULT). Table-shape assertions, not
-- role-shape, but they belong with the other "does the schema still hold its
-- invariants" checks and touch the same two tables A-C1 §2 covers above.
-- ---------------------------------------------------------------------------
select is(
  (select relkind from pg_class where relname = 'attendance' and relnamespace = 'public'::regnamespace),
  'p', 'attendance is a partitioned table');
select is(
  (select relkind from pg_class where relname = 'mark' and relnamespace = 'public'::regnamespace),
  'p', 'mark is a partitioned table');
select is((select count(*) from public.attendance_default)::int, 0,
  'no attendance row fell through to the DEFAULT partition');
select is((select count(*) from public.mark_default)::int, 0,
  'no mark row fell through to the DEFAULT partition');

-- ---------------------------------------------------------------------------
-- A-H7 — the set-based migration rewrite round-trips. Not a role-boundary
-- check like the rest of this file, but it belongs here: it is the other
-- correctness property of `fn_run_migration`/`fn_pushback_migration`, and a
-- regression here is exactly the kind of thing that should fail loudly in CI
-- rather than be discovered at the next real year-end rollover.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- `row_number()` cannot sit inside `jsonb_agg(...)` directly — "aggregate
-- function calls cannot contain window function calls" — so the rank is
-- computed in a CTE first, same as the client does before submitting.
select lives_ok(
  $q$with ranked as (
    select se.student_id, se.id as enr_id, row_number() over (order by se.roll_no) as rnk
    from public.student_enrollment se
    join public.class_section cs on cs.id = se.class_section_id
    join public.class c on c.id = cs.class_id
    where c.numeric_level = 9 and se.deleted_at is null
  )
  select public.fn_run_migration(jsonb_build_object(
    'academic_year_id', (select id from public.academic_year where is_current),
    'source_class_section_id', (select cs.id from public.class_section cs
      join public.class c on c.id = cs.class_id where c.numeric_level = 9 limit 1),
    'target_class_section_id', (select cs.id from public.class_section cs
      join public.class c on c.id = cs.class_id where c.numeric_level = 10 limit 1),
    'type', 'merit',
    'students', (select jsonb_agg(jsonb_build_object(
        'student_id', student_id, 'source_enrollment_id', enr_id, 'merit_rank', rnk) order by rnk)
      from ranked)
  ))$q$,
  'the set-based fn_run_migration runs without error on a real section');

select is((select count(*) from public.migration_batch)::int, 1, 'exactly one batch was created');

with u as (
  select public.fn_pushback_migration((select id from public.migration_batch limit 1)) as reverted
)
select cmp_ok((select reverted from u)::int, '>', 0, 'fn_pushback_migration reverts the rows it just created');

select is((select status from public.migration_batch limit 1), 'reverted', 'the batch is marked reverted');

-- ---------------------------------------------------------------------------
-- 2.6 — monthly invoice generation is idempotent: a second run for the same
-- period creates zero new lines, enforced by `uq_fee_invoice_student_period`
-- rather than a check-then-insert race. This is the property a `pg_cron` job
-- that might fire twice (a redeploy mid-run) actually depends on.
-- ---------------------------------------------------------------------------
insert into public.fee_mapping (institution_id, class_id, fee_head_id, amount, frequency, is_active)
select i.id, c.id, fh.id, 1200, 'monthly', true
from public.institution i, public.class c, public.fee_head fh
where c.numeric_level = 6 and fh.category = 'tuition' limit 1;

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select cmp_ok((select public.fn_generate_monthly_invoices())::int, '>', 0,
  'first invoice-generation run creates lines');
select is((select public.fn_generate_monthly_invoices())::int, 0,
  'second run for the same month creates zero — idempotent by constraint');

-- ---------------------------------------------------------------------------
-- 3 — the anon surface. Everything below was open on 2026-07-31 and is closed
-- by 20260731093000. These assertions exist because the advisors and the prose
-- both said the RPC surface was already locked, and neither was checked
-- against the live grants.
-- ---------------------------------------------------------------------------

-- 3.1 — the three attendance views ran as their OWNER, so RLS never applied and
-- an unauthenticated caller got every institution's per-student attendance rate
-- from `GET /rest/v1/v_attendance_student_summary`. Verified live before the
-- fix; this keeps it fixed.
select is(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('v_attendance_daily_summary','v_attendance_student_summary','v_attendance_trend')
      and not coalesce((select option_value::boolean
                          from pg_options_to_table(c.reloptions)
                         where option_name = 'security_invoker'), false))::int,
  0, 'attendance summary views are security_invoker');

-- 3.2 — partitions of `attendance`/`mark` carry their own RLS. A parent's
-- policies apply only when the data is read THROUGH the parent, so a partition
-- with RLS off is ungoverned on a direct read. PostgREST hides partitions today;
-- that is a PostgREST behaviour, not an authorization control.
select is(
  (select count(*) from pg_class c
     join pg_inherits i on i.inhrelid = c.oid
     join pg_class parent on parent.oid = i.inhparent
     join pg_namespace n on n.oid = parent.relnamespace
    where n.nspname = 'public' and parent.relname in ('attendance','mark')
      and not (c.relrowsecurity and c.relforcerowsecurity))::int,
  0, 'every attendance/mark partition has RLS enabled and forced');

select is(
  (select count(*) from pg_class c
     join pg_inherits i on i.inhrelid = c.oid
     join pg_class parent on parent.oid = i.inhparent
     join pg_namespace n on n.oid = parent.relnamespace
    where n.nspname = 'public' and parent.relname in ('attendance','mark')
      and (has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('authenticated', c.oid, 'SELECT')))::int,
  0, 'no client role can address a partition directly');

-- 3.3 — new partitions are secured at birth. The trigger on `academic_year`
-- created two public tables per year; without this the gap returns annually and
-- nobody is looking.
select lives_ok(
  $q$insert into public.academic_year (id, institution_id, year_label, start_date, end_date, is_current)
     select '0f0f0f0f-0000-0000-0000-00000000f00d', i.id, '2099', '2099-01-01', '2099-12-31', false
       from public.institution i limit 1$q$,
  'creating an academic year provisions its partitions');

select is(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('attendance_y0f0f0f0f0000000000000000000f00d','mark_y0f0f0f0f0000000000000000000f00d')
      and c.relrowsecurity and c.relforcerowsecurity)::int,
  2, 'partitions created by the trigger have RLS enabled and forced');

select is(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('attendance_y0f0f0f0f0000000000000000000f00d','mark_y0f0f0f0f0000000000000000000f00d')
      and (has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('authenticated', c.oid, 'SELECT')))::int,
  0, 'partitions created by the trigger are not client-addressable');

-- 3.4 — nothing in this product is callable before sign-in. The permission
-- wrapper would refuse anyway; this removes the reliance on one function's
-- logic being the only thing in the way.
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'fn\_%'
      and has_function_privilege('anon', p.oid, 'EXECUTE'))::int,
  0, 'no public fn_* is executable by anon');

-- 3.5 — and the authenticated surface is still intact, i.e. 3.4 did not fix
-- the hole by breaking the product.
select cmp_ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'fn\_%'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE'))::int,
  '>', 40, 'the RPC surface is still executable by authenticated');

-- ---------------------------------------------------------------------------
-- 3.6 — Settings audit M-2. Every SECURITY DEFINER function in `public` either
-- checks a permission or is on `private.unguarded_function_allowlist` with a
-- written reason.
--
-- These functions are owned by `postgres`, which carries `rolbypassrls`, so RLS
-- does NOT apply inside them regardless of `force row level security` on the
-- table. The permission call in the body is therefore the ONLY control on a
-- SECURITY DEFINER RPC. `fn_permission_matrix` shipped without one and handed
-- the institution's whole authorization model to any signed-in account;
-- `fn_resolve_sms_recipients` shipped without one and handed out the guardian
-- directory ten mobile numbers at a time.
--
-- Adding a function to the allow-list is a migration, so the reason is written
-- down and reviewed. That is the point: this assertion is not here to be
-- silenced, it is here to make silencing it visible.
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'fn\_%' and p.prosecdef
      and p.prosrc not ilike '%require_permission%'
      and p.prosrc not ilike '%has_permission%'
      and p.proname not in (select proname from private.unguarded_function_allowlist))::int,
  0, 'every SECURITY DEFINER fn_* checks a permission or is allow-listed with a reason');

-- 3.7 — and the allow-list has not been used as a dumping ground. Twelve
-- entries today, all of them either self-scoped to auth.uid() or deliberately
-- public. A jump here is the review signal.
select cmp_ok(
  (select count(*) from private.unguarded_function_allowlist)::int,
  '<=', 15, 'the unguarded allow-list has not grown unnoticed');

-- 3.8 — the specific regression. A caller with no role must not be able to read
-- the role x capability matrix.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $q$select public.fn_permission_matrix()$q$,
  '42501', null,
  'a no-role user cannot read the permission matrix');

-- ---------------------------------------------------------------------------
-- §4 — user administration (settings audit M-15).
--
-- The invite flow is the keystone: until it existed, an institution ran on one
-- shared credential and none of the RBAC model above could be exercised. These
-- assertions cover the three ways it could be got wrong.
-- ---------------------------------------------------------------------------

-- 4.1 — the guard. A teacher may not invite, reset a password, or end someone
-- else's session, however the request is shaped.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $q$select public.fn_invite_user_precheck('someone@school.test')$q$,
  '42501', null, 'a teacher cannot start an invitation');
select throws_ok(
  $q$select public.fn_admin_revoke_sessions('aaaaaaaa-0000-0000-0000-000000000001'::uuid)$q$,
  '42501', null, 'a teacher cannot revoke an administrator''s sessions');
select throws_ok(
  $q$select public.fn_authorize_account_action('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'password_reset')$q$,
  '42501', null, 'a teacher cannot trigger a password reset for someone else');

-- 4.2 — the administrator can, and a malformed address is refused before any
-- account is created.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $q$select public.fn_invite_user_precheck('not-an-email')$q$,
  'INV01', null, 'a malformed email is rejected by the precheck');
select throws_ok(
  $q$select public.fn_invite_user_precheck('rls-teacher@test.local')$q$,
  'INV02', null, 'an address that already has an account is refused');
select lives_ok(
  $q$select public.fn_invite_user_precheck('brand-new@school.test')$q$,
  'an administrator can start an invitation for a new address');

-- 4.3 — a profile that already belongs to an institution cannot be re-claimed.
-- This is what stops an invite completion from pulling another school's user
-- across tenants.
select throws_ok(
  $q$select public.fn_complete_user_invite(
        jsonb_build_object('profile_id', 'aaaaaaaa-0000-0000-0000-000000000002', 'role_ids', '[]'::jsonb))$q$,
  'INV03', null, 'an already-claimed profile cannot be claimed again');

-- ---------------------------------------------------------------------------
-- 4.4 — suspension was decorative. `has_permission` never looked at
-- `profile.status`, and no policy joins to it, so a suspended account kept
-- every permission it had. The screen said the account was stopped; the
-- database had not been told.
-- ---------------------------------------------------------------------------
update public.profile set status = 'suspended'
 where id = 'aaaaaaaa-0000-0000-0000-000000000002'::uuid;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(private.has_permission('attendance.view'), false,
  'a suspended account holds no permission, whatever its roles say');

update public.profile set status = 'active'
 where id = 'aaaaaaaa-0000-0000-0000-000000000002'::uuid;
select is(private.has_permission('attendance.view'), true,
  'and reactivating restores it — the gate is the status, not a revocation');

select * from finish();
rollback;

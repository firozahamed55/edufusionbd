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
select plan(34);

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

select * from finish();
rollback;

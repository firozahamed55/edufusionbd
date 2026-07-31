-- ============================================================================
-- Unauthenticated cross-tenant reads of attendance, and the partition RLS gap
-- behind them.
--
-- NOT in the SRA. Found by re-running the Supabase security advisors during
-- Phase 1 and then verifying each finding against the live API with the anon
-- key, rather than trusting the advisor or the report.
--
-- ── WHAT IS ACTUALLY EXPLOITABLE (verified, HTTP 200 with real rows) ────────
-- `v_attendance_daily_summary`, `v_attendance_student_summary` and
-- `v_attendance_trend` were created WITHOUT `security_invoker`, so they run
-- with the view owner's rights and RLS never applies. With nothing but the
-- publishable anon key that ships inside the client bundle:
--
--     GET /rest/v1/v_attendance_student_summary?select=*
--
-- returned every institution's per-student attendance rate, keyed by
-- student_id, unauthenticated. Every other read view in this schema is
-- `security_invoker`; these three were the exception, not the convention.
--
-- ── WHAT IS A LATENT GAP, NOT A LIVE LEAK ──────────────────────────────────
-- Migration 20260726053505 partitioned `attendance` and `mark`, and every
-- partition landed in `public` with RLS OFF and SELECT granted to `anon`. The
-- SRA's "RLS on 86/86 tables" counts PARENT tables; Postgres applies a parent's
-- policies only when the data is read THROUGH the parent, so a direct read of a
-- partition was ungoverned.
--
-- That is not reachable today: PostgREST omits partitions from its schema cache,
-- and `GET /rest/v1/mark_default` returns PGRST205 (verified). It is one
-- PostgREST version, one `db-schemas` change, or one direct connection away
-- from being reachable, on a table of children's marks. Fixing it costs three
-- statements.
--
-- `private.ensure_year_partitions` also runs from a trigger on `academic_year`
-- insert and created new partitions with the same defaults, so the gap
-- reproduced itself every academic year.
--
-- ── THE FIX ────────────────────────────────────────────────────────────────
--   1. The three views become `security_invoker` — this is the actual breach.
--   2. RLS enabled + FORCED on every partition, and privileges revoked from
--      `anon`/`authenticated`. Two independent layers, because a future grant
--      would otherwise silently undo the only one. Access through the parent is
--      unaffected: Postgres checks privileges on the parent for partitioned
--      access, which is how the application already reads this data.
--   3. `ensure_year_partitions` secures what it creates.
-- ============================================================================

-- One place that knows what "secured" means, so both call sites below and
-- any future partitioned table cannot drift apart.
create or replace function private.secure_partition(p_qualified text)
  returns void language plpgsql security definer set search_path to '' as $$
begin
  execute format('alter table %s enable row level security', p_qualified);
  execute format('alter table %s force row level security', p_qualified);
  execute format('revoke all on %s from anon, authenticated', p_qualified);
end;
$$;

do $$
declare part record;
begin
  for part in
    select c.oid::regclass as rel
      from pg_class c
      join pg_inherits i on i.inhrelid = c.oid
      join pg_class parent on parent.oid = i.inhparent
      join pg_namespace n on n.oid = parent.relnamespace
     where n.nspname = 'public' and parent.relname in ('attendance', 'mark')
  loop
    execute format('alter table %s enable row level security', part.rel);
    execute format('alter table %s force row level security', part.rel);
    execute format('revoke all on %s from anon, authenticated', part.rel);
  end loop;
end $$;

-- Every future partition, secured at birth. Without this the trigger on
-- `academic_year` re-opens the hole each year, and nobody would be looking.
create or replace function private.ensure_year_partitions(p_year_id uuid)
  returns void language plpgsql security definer set search_path to '' as $function$
declare
  suffix text;
  att    text;
  mrk    text;
begin
  suffix := replace(p_year_id::text, '-', '');
  att := 'attendance_y' || suffix;
  mrk := 'mark_y' || suffix;

  if to_regclass('public.' || att) is null then
    execute format('create table public.%I partition of public.attendance for values in (%L);', att, p_year_id);
    perform private.secure_partition('public.' || att);
  end if;

  if to_regclass('public.' || mrk) is null then
    execute format('create table public.%I partition of public.mark for values in (%L);', mrk, p_year_id);
    perform private.secure_partition('public.' || mrk);
  end if;
end;
$function$;

-- ── The actual breach: SECURITY DEFINER views over `attendance` ─────────────
-- Verified returning real rows to an unauthenticated caller before this line.
alter view public.v_attendance_daily_summary   set (security_invoker = true);
alter view public.v_attendance_student_summary set (security_invoker = true);
alter view public.v_attendance_trend           set (security_invoker = true);

-- ── Defence in depth on the RPC surface ─────────────────────────────────────
-- 48 of 51 `public.fn_*` functions were executable by `anon`. In practice the
-- permission wrapper refuses them (`has_permission()` is false with no
-- `auth.uid()`), so this is not the severity of the view leak above — but it
-- means the only thing between an unauthenticated caller and a SECURITY
-- DEFINER write is one function's logic. Nothing here is meant to be callable
-- before sign-in.
--
-- REVOKE FROM **PUBLIC**, NOT FROM `anon`. The grant was `=X/postgres` in
-- `proacl` — i.e. to PUBLIC, which every role inherits — so a role-specific
-- revoke removes nothing and the advisor keeps reporting the finding after you
-- have "fixed" it. Verified by reading the ACL, not by trusting the statement.
-- Safe because `authenticated` and `service_role` hold their own explicit
-- grants; they are re-asserted anyway so a function that only ever had the
-- PUBLIC grant does not become unreachable.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'fn\_%'
  loop
    execute format('revoke execute on function %s from public', f.sig);
    execute format('revoke execute on function %s from anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

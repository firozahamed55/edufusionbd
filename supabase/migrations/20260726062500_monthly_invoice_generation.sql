-- ============================================================================
-- Phase 2.6 — monthly invoice generation.
--
-- "Does not exist. Must be a scheduled job; there is nowhere to put one."
-- (audit §4.6, A-H7 table). It exists now: a set-based generator, an
-- all-institutions wrapper scheduled via `pg_cron` for the 1st of every
-- month, and a permission-guarded manual-trigger RPC for an admin who needs
-- to run it early or re-run a missed month.
--
-- IDEMPOTENT BY CONSTRAINT, NOT BY CHECKING FIRST. `uq_fee_invoice_student_
-- period` makes "already invoiced this student for this period" a database
-- fact, and `on conflict ... do nothing` is the whole safety mechanism — a
-- cron job that fires twice (a redeploy mid-run, a retried invocation) cannot
-- double-bill. This is the same shape as `uq_enrollment_year` and the other
-- partial-unique invariants migration 04 already established; nothing new is
-- being introduced, just applied to a table that was missing it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The invariant this job depends on: one invoice per student per period.
--    (Retroactively true today — the demo seed creates exactly one.)
-- ---------------------------------------------------------------------------
create unique index uq_fee_invoice_student_period
  on public.fee_invoice (student_id, academic_year_id, period) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Per-institution generator.
--
--    Targets every ACTIVE enrolment in the institution's CURRENT year against
--    every ACTIVE `monthly` fee_mapping for that student's class, optionally
--    narrowed by `student_category_id` (null = applies to every category —
--    the same convention `fee_mapping`'s own rows already use). One invoice
--    per student, one line per matching fee_mapping row — a student billed
--    for tuition and transport in the same month gets one invoice with two
--    lines, not two invoices, matching how the fee screens already group by
--    invoice. `fee_invoice.total_amount` is populated by the existing
--    `trg_fee_invoice_line` trigger (migration 05) — this function never
--    computes a total itself, it only inserts the lines that trigger reads.
-- ---------------------------------------------------------------------------
create or replace function private.fn_generate_monthly_invoices(
  p_institution_id uuid, p_period text
) returns int
  language plpgsql security definer set search_path = '' as $$
declare v_year uuid; v_term uuid; v_count int := 0;
begin
  select id into v_year from public.academic_year
    where institution_id = p_institution_id and is_current and deleted_at is null;
  if v_year is null then return 0; end if;
  select id into v_term from public.academic_term
    where academic_year_id = v_year and is_current limit 1;

  with targets as (
    select se.student_id, fm.fee_head_id, fm.amount
    from public.student_enrollment se
    join public.class_section cs on cs.id = se.class_section_id
    join public.fee_mapping fm
      on fm.class_id = cs.class_id and fm.institution_id = p_institution_id
     and fm.frequency = 'monthly' and fm.is_active
     and (fm.student_category_id is null
          or fm.student_category_id = (select student_category_id from public.student where id = se.student_id))
    where se.institution_id = p_institution_id and se.academic_year_id = v_year
      and se.deleted_at is null and se.status = 'active'
  ),
  new_invoices as (
    insert into public.fee_invoice (institution_id, student_id, academic_year_id, academic_term_id, period, due_date)
    select p_institution_id, t.student_id, v_year, v_term, p_period,
           (date_trunc('month', current_date) + interval '10 days')::date
    from (select distinct student_id from targets) t
    on conflict (student_id, academic_year_id, period) where deleted_at is null do nothing
    returning id, student_id
  )
  insert into public.fee_invoice_line (fee_invoice_id, fee_head_id, amount)
  select ni.id, tg.fee_head_id, tg.amount
  from new_invoices ni join targets tg on tg.student_id = ni.student_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function private.fn_generate_monthly_invoices(uuid, text) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- 3. All-institutions wrapper — the `pg_cron` target. No caller session
--    exists when `pg_cron` fires, so this cannot use `current_institution_id()`
--    and instead loops every institution explicitly, one at a time so a
--    failure on one school (a missing current year, say) is logged and does
--    not abort the run for the rest.
-- ---------------------------------------------------------------------------
create or replace function private.fn_generate_monthly_invoices_all(
  p_period text default to_char(current_date, 'YYYY-MM')
) returns void
  language plpgsql security definer set search_path = '' as $$
declare v_inst uuid; v_lines int;
begin
  for v_inst in select id from public.institution where status = 'active' loop
    begin
      v_lines := private.fn_generate_monthly_invoices(v_inst, p_period);
      raise log 'fn_generate_monthly_invoices_all: institution % period % -> % lines', v_inst, p_period, v_lines;
    exception when others then
      raise warning 'fn_generate_monthly_invoices_all: institution % failed: %', v_inst, sqlerrm;
    end;
  end loop;
end;
$$;
revoke all on function private.fn_generate_monthly_invoices_all(text) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- 4. Manual trigger, permission-guarded, for the caller's own institution and
--    the current month — an admin re-running a month the schedule missed.
--    Follows the migration-41 convention (private impl, public wrapper).
-- ---------------------------------------------------------------------------
create or replace function public.fn_generate_monthly_invoices() returns integer
  language plpgsql security definer set search_path = '' as $function$
declare v_inst uuid;
begin
  perform private.require_permission('fee.mapping');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  return private.fn_generate_monthly_invoices(v_inst, to_char(current_date, 'YYYY-MM'));
end;
$function$;
revoke all on function public.fn_generate_monthly_invoices() from anon, public;
grant execute on function public.fn_generate_monthly_invoices() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Schedule: 1st of every month, 01:00 UTC (well outside any school's
--    class hours across Bangladesh's single timezone, and a low-traffic
--    window on `dkumhtrrgsuwxucgncix`'s ap-south-1 region generally).
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'monthly-invoice-generation',
  '0 1 1 * *',
  $$select private.fn_generate_monthly_invoices_all();$$
);

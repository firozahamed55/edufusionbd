-- ============================================================================
-- SRA A-4 item 3 / portfolio addition #7 — the Academic Calendar.
--
-- "Weekends, government holidays and institution holidays are not modelled.
-- Attendance can be taken on Eid; the 30-day average on the dashboard is
-- diluted by non-teaching days; and there is no academic-calendar screen
-- anywhere in the product."
--
-- The `academic_calendar` table already existed — one row per date, with
-- `is_working_day` and a `holiday_label` — and nothing wrote to it or read it.
-- This gives it both, plus the term rows `academic_term` was shaped for.
-- ============================================================================

alter table public.academic_calendar
  add column if not exists academic_year_id uuid references public.academic_year(id) on delete cascade;

create unique index if not exists ux_academic_calendar_date
  on public.academic_calendar (institution_id, cal_date);

/**
 * Mark a date range as working or non-working.
 *
 * Range rather than single date because that is the actual unit: a school
 * declares "Eid holidays, 8–14 April", not seven separate days. Idempotent, so
 * correcting a range is re-applying it rather than deleting first.
 */
create or replace function public.fn_set_calendar_range(payload jsonb)
returns integer language plpgsql security definer set search_path = '' as $fn$
declare
  v_inst uuid; v_from date; v_to date; v_working boolean; v_label text; v_year uuid; v_count int;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_from    := nullif(payload->>'from','')::date;
  v_to      := coalesce(nullif(payload->>'to','')::date, v_from);
  v_working := coalesce((payload->>'is_working_day')::boolean, false);
  v_label   := nullif(payload->>'label','');
  v_year    := nullif(payload->>'academic_year_id','')::uuid;

  if v_from is null then raise exception 'a start date is required'; end if;
  if v_to < v_from then raise exception 'the end date is before the start date'; end if;
  -- A year of dates is 365 rows; anything larger is a typo in the year field,
  -- not an intention.
  if v_to - v_from > 400 then raise exception 'that range is longer than a year'; end if;
  if not v_working and coalesce(trim(v_label),'') = '' then
    raise exception 'a non-working day needs a label — an unexplained gap in the register is what an inspector asks about';
  end if;

  insert into public.academic_calendar(institution_id, academic_year_id, cal_date, is_working_day, holiday_label)
  select v_inst, v_year, d::date, v_working, v_label
    from generate_series(v_from, v_to, interval '1 day') d
  on conflict (institution_id, cal_date) do update
    set is_working_day = excluded.is_working_day,
        holiday_label  = excluded.holiday_label,
        academic_year_id = coalesce(excluded.academic_year_id, public.academic_calendar.academic_year_id);

  get diagnostics v_count = row_count;
  return v_count;
end; $fn$;
revoke all on function public.fn_set_calendar_range(jsonb) from public, anon;
grant execute on function public.fn_set_calendar_range(jsonb) to authenticated;

create or replace function public.fn_clear_calendar_range(p_from date, p_to date)
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_inst uuid; v_count int;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();
  delete from public.academic_calendar
   where institution_id = v_inst and cal_date between p_from and coalesce(p_to, p_from);
  get diagnostics v_count = row_count;
  return v_count;
end; $fn$;
revoke all on function public.fn_clear_calendar_range(date, date) from public, anon;
grant execute on function public.fn_clear_calendar_range(date, date) to authenticated;

/* --------------------------------------------------------------- terms */

create or replace function public.fn_upsert_academic_term(payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_id := nullif(payload->>'id','')::uuid;

  if v_id is null then
    insert into public.academic_term(institution_id, academic_year_id, name_en, name_bn, start_date, end_date, is_current)
    values (v_inst, nullif(payload->>'academic_year_id','')::uuid,
            coalesce(nullif(payload->>'name_en',''), 'Term'), nullif(payload->>'name_bn',''),
            nullif(payload->>'start_date','')::date, nullif(payload->>'end_date','')::date,
            coalesce((payload->>'is_current')::boolean, false))
    returning id into v_id;
  else
    update public.academic_term
       set name_en = coalesce(nullif(payload->>'name_en',''), name_en),
           name_bn = nullif(payload->>'name_bn',''),
           start_date = nullif(payload->>'start_date','')::date,
           end_date = nullif(payload->>'end_date','')::date,
           is_current = coalesce((payload->>'is_current')::boolean, is_current)
     where id = v_id and institution_id = v_inst;
  end if;

  -- Exactly one current term. Two would make every "this term" query ambiguous
  -- and pick whichever the planner returned first.
  if coalesce((payload->>'is_current')::boolean, false) then
    update public.academic_term set is_current = false
     where institution_id = v_inst and id <> v_id;
  end if;

  return v_id;
end; $fn$;
revoke all on function public.fn_upsert_academic_term(jsonb) from public, anon;
grant execute on function public.fn_upsert_academic_term(jsonb) to authenticated;

create or replace function public.fn_delete_academic_term(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_inst uuid;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();
  delete from public.academic_term where id = p_id and institution_id = v_inst;
end; $fn$;
revoke all on function public.fn_delete_academic_term(uuid) from public, anon;
grant execute on function public.fn_delete_academic_term(uuid) to authenticated;

/* ------------------------------------------------- the question attendance asks */

/**
 * Is this date a teaching day, and if not, why?
 *
 * Read by the attendance screen before it lets anyone mark a register. The
 * weekend comes from `basic_config.weekend` — the Basic Config select that has
 * existed since launch with nothing consuming it — and an explicit calendar row
 * overrides it in either direction, because a school that runs a make-up class
 * on a Friday needs to record attendance for it.
 */
create or replace function public.fn_calendar_day(p_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_inst uuid; v_row public.academic_calendar; v_token text; v_dow int; v_weekend boolean := false;
begin
  perform private.require_permission('dashboard.view');
  v_inst := private.current_institution_id();

  select * into v_row from public.academic_calendar
   where institution_id = v_inst and cal_date = p_date;

  if v_row.cal_date is not null then
    return jsonb_build_object(
      'date', p_date, 'working', v_row.is_working_day,
      'label', v_row.holiday_label, 'source', 'calendar');
  end if;

  select (value->>'weekend') into v_token
    from public.setting
   where institution_id = v_inst and key = 'basic_config' and scope = 'core';

  -- Postgres: 0 = Sunday. The tokens are Basic Config's own — `fri_sat`,
  -- `sat_sun`, `fri_only` — and an unset one defaults to Friday, which is the
  -- Bangladeshi school week, not the Saturday-Sunday a generic default assumes.
  v_dow := extract(dow from p_date)::int;
  v_weekend := case coalesce(v_token, 'fri_only')
                 when 'fri_sat' then v_dow in (5, 6)
                 when 'sat_sun' then v_dow in (6, 0)
                 else v_dow = 5
               end;

  return jsonb_build_object(
    'date', p_date, 'working', not v_weekend,
    'label', case when v_weekend then 'Weekly holiday' else null end,
    'source', case when v_weekend then 'weekend' else 'default' end);
end; $fn$;
revoke all on function public.fn_calendar_day(date) from public, anon;
grant execute on function public.fn_calendar_day(date) to authenticated;

/** Every marked date in a window — the calendar grid reads this once per month
 *  rather than 30 times. */
create or replace function public.fn_calendar_range(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_inst uuid; v_out jsonb;
begin
  perform private.require_permission('dashboard.view');
  v_inst := private.current_institution_id();

  select coalesce(jsonb_agg(jsonb_build_object(
           'date', cal_date, 'working', is_working_day, 'label', holiday_label) order by cal_date), '[]'::jsonb)
    into v_out
    from public.academic_calendar
   where institution_id = v_inst and cal_date between p_from and p_to;

  return v_out;
end; $fn$;
revoke all on function public.fn_calendar_range(date, date) from public, anon;
grant execute on function public.fn_calendar_range(date, date) to authenticated;

/* ------------------------------------ non-teaching days leave the statistics */

/**
 * `fn_attendance_summary`, corrected for the calendar (A-4 item 3: "it corrupts
 * every attendance statistic the product reports").
 *
 * `working_days` counted distinct dates on which SOMEBODY was marked. Take
 * attendance once by mistake on Eid and that day becomes a working day for the
 * whole institution, dragging every rate down. Now an explicitly non-working
 * date is excluded from both the denominator and the per-student totals.
 */
create or replace function private.fn_attendance_summary(p_class_section_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_wd int; v_result jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select count(distinct a.att_date) into v_wd from public.attendance a
    where a.institution_id = v_inst and a.context = 'daily' and a.att_date between p_from and p_to
      and (p_class_section_id is null or a.class_section_id = p_class_section_id)
      and not exists (select 1 from public.academic_calendar c
                       where c.institution_id = v_inst and c.cal_date = a.att_date and not c.is_working_day);

  with roster as (
    select distinct se.student_id, s.name_bn, s.name_en, s.student_code, se.roll_no
    from public.student_enrollment se
    join public.student s on s.id = se.student_id and s.deleted_at is null
    where se.status = 'active' and se.deleted_at is null and se.institution_id = v_inst
      and (p_class_section_id is null or se.class_section_id = p_class_section_id)
  ),
  att as (
    select a.student_id,
      count(*) filter (where a.status = 'present') p,
      count(*) filter (where a.status = 'late') l,
      count(*) filter (where a.status = 'absent') ab,
      count(*) filter (where a.status = 'leave') lv,
      count(*) filter (where a.status = 'exam_absent') ea
    from public.attendance a
    where a.institution_id = v_inst and a.context = 'daily' and a.att_date between p_from and p_to
      and (p_class_section_id is null or a.class_section_id = p_class_section_id)
      and not exists (select 1 from public.academic_calendar c
                       where c.institution_id = v_inst and c.cal_date = a.att_date and not c.is_working_day)
    group by a.student_id
  ),
  per as (
    select r.student_id, r.student_code, r.roll_no, r.name_bn, r.name_en,
      coalesce(a.p,0) + coalesce(a.l,0) attended, coalesce(a.ab,0) absent_ct,
      case when v_wd > 0 then round((coalesce(a.p,0) + coalesce(a.l,0))::numeric / v_wd * 100, 0) else 0 end rate
    from roster r left join att a on a.student_id = r.student_id
  )
  select jsonb_build_object(
    'working_days', v_wd,
    'total_students', (select count(*) from roster),
    'avg_rate', (select coalesce(round(avg(rate),0),0) from per),
    'regular_count', (select count(*) from per where rate >= 90),
    'at_risk_count', (select count(*) from per where rate < 75),
    'status_split', (select jsonb_build_object(
        'present', coalesce(sum(p),0), 'late', coalesce(sum(l),0),
        'absent', coalesce(sum(ab),0), 'leave', coalesce(sum(lv),0), 'exam_absent', coalesce(sum(ea),0)) from att),
    'students', (select coalesce(jsonb_agg(jsonb_build_object('student_id',student_id,'code',student_code,'roll',roll_no,'name_bn',name_bn,'name_en',name_en,'present',attended,'total',v_wd,'rate',rate) order by roll_no), '[]'::jsonb) from per),
    'at_risk', (select coalesce(jsonb_agg(jsonb_build_object('student_id',student_id,'code',student_code,'roll',roll_no,'name_bn',name_bn,'name_en',name_en,'rate',rate,'absent',absent_ct) order by rate asc), '[]'::jsonb) from per where rate < 75)
  ) into v_result;
  return v_result;
end; $fn$;

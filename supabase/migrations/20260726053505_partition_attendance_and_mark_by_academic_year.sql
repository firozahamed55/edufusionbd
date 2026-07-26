-- ============================================================================
-- Phase 1.2 (A-H5) — partition `attendance` and `mark` by academic year.
--
-- These are the two tables that dwarf everything else. At the stated target
-- (100k students) `attendance` grows ~22M rows/year and `mark` ~4M/year, and at
-- three years that is a 66M-row table with no archival story: vacuum pressure,
-- index bloat, slow ANALYZE, and a `v_attendance_trend` that aggregates across
-- all of history with no time bound. Done NOW, while the tables hold twelve
-- rows and two rows respectively, because partitioning a live 20M-row table is
-- a maintenance window nobody wants.
--
-- LIST, NOT RANGE. The audit says "RANGE partition by academic_year_id".
-- `academic_year_id` is a uuid — range bounds over uuids are meaningless. LIST
-- on the same column delivers the intent (one partition per school year,
-- archival by DETACH PARTITION, partition pruning on every year-scoped query)
-- with a key that actually orders. Partitioning by `att_date` was rejected: the
-- domain's boundary is the school year, not the calendar year, and a date range
-- cannot be DETACHed as "the 2024 school year".
--
-- THE COLUMN DID NOT EXIST. Neither table carried `academic_year_id`; it is
-- derived (attendance -> class_section, mark -> exam_subject -> exam). See
-- §4 below for how it is kept correct without a BEFORE trigger.
--
-- A DEFAULT partition exists so an INSERT can never fail on a missing year, and
-- `private.ensure_year_partitions()` fires from `academic_year` so it stays
-- empty in practice — attaching a LIST partition while DEFAULT holds rows makes
-- Postgres scan DEFAULT to prove none belong to the new bound.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Derivation helpers — also used by the backfill below.
-- ---------------------------------------------------------------------------
create or replace function private.attendance_year_id(p_class_section_id uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select academic_year_id from public.class_section where id = p_class_section_id
$$;

create or replace function private.mark_year_id(p_exam_subject_id uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select e.academic_year_id from public.exam_subject es
  join public.exam e on e.id = es.exam_id
  where es.id = p_exam_subject_id
$$;

-- ---------------------------------------------------------------------------
-- 1. attendance
-- ---------------------------------------------------------------------------
drop view if exists public.v_attendance_daily_summary;
drop view if exists public.v_attendance_student_summary;
drop view if exists public.v_attendance_trend;

alter table public.attendance rename to attendance_old;
alter table public.mark rename to mark_old;

-- Index names are schema-global, so the renamed originals would collide with
-- the new tables' identically-named indexes. Park them out of the way; both
-- tables are dropped at the end of this migration anyway.
do $$ declare r record; begin
  for r in select indexname from pg_indexes
           where schemaname = 'public' and tablename in ('attendance_old','mark_old')
  loop
    execute format('alter index public.%I rename to %I;', r.indexname, r.indexname || '_old');
  end loop;
end $$;

create table public.attendance (
  id                uuid not null default gen_random_uuid(),
  institution_id    uuid not null references public.institution(id) on delete cascade,
  student_id        uuid not null references public.student(id) on delete cascade,
  class_section_id  uuid not null references public.class_section(id) on delete restrict,
  academic_year_id  uuid not null references public.academic_year(id) on delete restrict,
  att_date          date not null,
  context           public.attendance_context not null default 'daily',
  exam_id           uuid references public.exam(id) on delete cascade,
  exam_key          uuid,
  status            public.attendance_status not null,
  marked_by         uuid references public.profile(id) on delete set null,
  guardian_sms_sent boolean not null default false,
  created_at        timestamptz not null default now(),
  -- The partition key must appear in every unique constraint. Adding the year
  -- weakens neither: a student has exactly one enrolment per year.
  primary key (id, academic_year_id),
  unique (student_id, att_date, context, exam_key, academic_year_id)
) partition by list (academic_year_id);

create table public.attendance_default partition of public.attendance default;

create index ix_attendance_institution      on public.attendance (institution_id);
create index ix_attendance_cs_date          on public.attendance (institution_id, class_section_id, att_date);
create index ix_attendance_student_date     on public.attendance (institution_id, student_id, att_date);
create index ix_attendance_class_section_id on public.attendance (class_section_id);
create index ix_attendance_exam_id          on public.attendance (exam_id);
create index ix_attendance_marked_by        on public.attendance (marked_by);

-- ---------------------------------------------------------------------------
-- 2. mark
-- ---------------------------------------------------------------------------
create table public.mark (
  id               uuid not null default gen_random_uuid(),
  institution_id   uuid not null references public.institution(id) on delete cascade,
  exam_subject_id  uuid not null references public.exam_subject(id) on delete cascade,
  student_id       uuid not null references public.student(id) on delete cascade,
  academic_year_id uuid not null references public.academic_year(id) on delete restrict,
  marks_obtained   numeric(6,2) check (marks_obtained is null or marks_obtained >= 0),
  is_absent        boolean not null default false,
  entered_by       uuid references public.profile(id) on delete set null,
  status           text not null default 'draft' check (status in ('draft','submitted')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (id, academic_year_id),
  -- An exam_subject belongs to exactly one exam, which belongs to exactly one
  -- year, so the year column adds nothing a caller could exploit.
  unique (exam_subject_id, student_id, academic_year_id)
) partition by list (academic_year_id);

create table public.mark_default partition of public.mark default;

create index ix_mark_institution on public.mark (institution_id);
create index ix_mark_student     on public.mark (student_id);
create index ix_mark_entered_by  on public.mark (entered_by);

-- ---------------------------------------------------------------------------
-- 3. One partition per existing academic year, then move the data.
-- ---------------------------------------------------------------------------
create or replace function private.ensure_year_partitions(p_year_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare suffix text;
begin
  -- A uuid is not a legal identifier fragment; the hex without dashes is.
  suffix := replace(p_year_id::text, '-', '');
  if to_regclass('public.attendance_y' || suffix) is null then
    execute format('create table public.%I partition of public.attendance for values in (%L);',
                   'attendance_y' || suffix, p_year_id);
  end if;
  if to_regclass('public.mark_y' || suffix) is null then
    execute format('create table public.%I partition of public.mark for values in (%L);',
                   'mark_y' || suffix, p_year_id);
  end if;
end;
$$;

do $$ declare y uuid; begin
  for y in select id from public.academic_year loop
    perform private.ensure_year_partitions(y);
  end loop;
end $$;

-- Rows whose year cannot be derived would violate NOT NULL. There are none
-- today (every attendance row has a class_section, every mark an exam_subject),
-- and the insert failing loudly is the correct outcome if that ever changes.
insert into public.attendance (id, institution_id, student_id, class_section_id, academic_year_id,
                               att_date, context, exam_id, exam_key, status, marked_by,
                               guardian_sms_sent, created_at)
select a.id, a.institution_id, a.student_id, a.class_section_id,
       private.attendance_year_id(a.class_section_id),
       a.att_date, a.context, a.exam_id, a.exam_key, a.status, a.marked_by,
       a.guardian_sms_sent, a.created_at
from public.attendance_old a;

insert into public.mark (id, institution_id, exam_subject_id, student_id, academic_year_id,
                         marks_obtained, is_absent, entered_by, status, created_at, updated_at)
select m.id, m.institution_id, m.exam_subject_id, m.student_id,
       private.mark_year_id(m.exam_subject_id),
       m.marks_obtained, m.is_absent, m.entered_by, m.status, m.created_at, m.updated_at
from public.mark_old m;

-- ---------------------------------------------------------------------------
-- 4. Keep `academic_year_id` correct, without a BEFORE trigger that sets it.
--
--    A BEFORE ROW trigger cannot assign the partition key: Postgres routes an
--    INSERT to its target partition before the parent's BEFORE trigger runs
--    ("moving row to another partition during a BEFORE FOR EACH ROW trigger is
--    not supported"). So the two write paths — `fn_mark_attendance` and
--    `fn_save_marks`, the only functions that insert into these tables — set
--    `academic_year_id` themselves, derived from the same helpers. An AFTER
--    trigger then verifies it: a caller that gets the derivation wrong is
--    rejected, not silently misfiled into the wrong partition.
-- ---------------------------------------------------------------------------
create or replace function private.attendance_check_year_trg() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.academic_year_id is distinct from private.attendance_year_id(new.class_section_id) then
    raise exception 'attendance.academic_year_id (%) does not match class_section % (year %)',
      new.academic_year_id, new.class_section_id, private.attendance_year_id(new.class_section_id);
  end if;
  return null;
end;
$$;
create trigger trg_attendance_year_check after insert or update on public.attendance
  for each row execute function private.attendance_check_year_trg();

create or replace function private.mark_check_year_trg() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.academic_year_id is distinct from private.mark_year_id(new.exam_subject_id) then
    raise exception 'mark.academic_year_id (%) does not match exam_subject % (year %)',
      new.academic_year_id, new.exam_subject_id, private.mark_year_id(new.exam_subject_id);
  end if;
  return null;
end;
$$;
create trigger trg_mark_year_check after insert or update on public.mark
  for each row execute function private.mark_check_year_trg();

-- The only two functions that INSERT into attendance/mark, reissued to set
-- academic_year_id explicitly. Every other line is unchanged from migration
-- 05 (fn_mark_attendance) / 16 (fn_save_marks) respectively.
create or replace function private.fn_mark_attendance(payload jsonb) returns integer
 language plpgsql security definer set search_path = '' as $function$
declare v_inst uuid; v_cs uuid; v_year uuid; v_date date; v_ctx public.attendance_context;
        v_exam uuid; v_item jsonb; v_cnt int := 0; v_sms bool;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_cs := nullif(payload->>'class_section_id','')::uuid;
  v_date := nullif(payload->>'att_date','')::date;
  v_ctx := coalesce(nullif(payload->>'context','')::public.attendance_context, 'daily');
  v_exam := nullif(payload->>'exam_id','')::uuid;
  v_sms := coalesce((payload->>'sms')::boolean, false);
  if v_cs is null or v_date is null then raise exception 'section and date required'; end if;

  v_year := private.attendance_year_id(v_cs);
  if v_year is null then raise exception 'class_section % has no academic year', v_cs; end if;

  for v_item in select value from jsonb_array_elements(payload->'entries') loop
    delete from public.attendance
      where student_id = (v_item->>'student_id')::uuid and att_date = v_date and context = v_ctx
        and exam_id is not distinct from v_exam and institution_id = v_inst;
    insert into public.attendance(institution_id, student_id, class_section_id, academic_year_id,
                                  att_date, context, exam_id, status, marked_by, guardian_sms_sent)
    values (v_inst, (v_item->>'student_id')::uuid, v_cs, v_year, v_date, v_ctx, v_exam,
      (v_item->>'status')::public.attendance_status, (select auth.uid()), v_sms);
    v_cnt := v_cnt + 1;
  end loop;
  return v_cnt;
end; $function$;
revoke all on function private.fn_mark_attendance(jsonb) from authenticated, anon, public;

create or replace function private.fn_save_marks(payload jsonb) returns integer
 language plpgsql security definer set search_path = '' as $function$
declare v_inst uuid; v_exam uuid; v_cs uuid; v_class uuid; v_subject uuid; v_year uuid;
        v_full numeric; v_pass numeric; v_es uuid; v_item jsonb; v_cnt int := 0; v_status text;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_exam := nullif(payload->>'exam_id','')::uuid;
  v_cs := nullif(payload->>'class_section_id','')::uuid;
  v_subject := nullif(payload->>'subject_id','')::uuid;
  if v_exam is null or v_cs is null or v_subject is null then raise exception 'exam, section and subject required'; end if;
  v_status := coalesce(nullif(payload->>'status',''), 'submitted');

  select class_id into v_class from public.class_section where id = v_cs;
  if v_class is null then raise exception 'invalid section'; end if;
  select academic_year_id into v_year from public.exam where id = v_exam;
  if v_year is null then raise exception 'exam % has no academic year', v_exam; end if;

  v_full := coalesce(nullif(payload->>'full_marks','')::numeric,
    (select full_marks from public.subject where id = v_subject), 100);
  v_pass := coalesce(nullif(payload->>'pass_marks','')::numeric,
    (select pass_marks from public.subject where id = v_subject), 33);

  select id into v_es from public.exam_subject where exam_id = v_exam and class_id = v_class and subject_id = v_subject;
  if v_es is null then
    insert into public.exam_subject(exam_id, class_id, subject_id, full_marks, pass_marks)
    values (v_exam, v_class, v_subject, v_full, v_pass) returning id into v_es;
  else
    update public.exam_subject set full_marks = v_full, pass_marks = v_pass where id = v_es;
  end if;

  for v_item in select value from jsonb_array_elements(payload->'entries') loop
    insert into public.mark(institution_id, exam_subject_id, student_id, academic_year_id,
                            marks_obtained, is_absent, entered_by, status)
    values (v_inst, v_es, (v_item->>'student_id')::uuid, v_year,
      nullif(v_item->>'marks_obtained','')::numeric, coalesce((v_item->>'is_absent')::boolean, false),
      (select auth.uid()), v_status)
    on conflict (exam_subject_id, student_id, academic_year_id) do update
      set marks_obtained = excluded.marks_obtained, is_absent = excluded.is_absent,
          entered_by = excluded.entered_by, status = excluded.status, updated_at = now();
    v_cnt := v_cnt + 1;
  end loop;
  return v_cnt;
end; $function$;
revoke all on function private.fn_save_marks(jsonb) from authenticated, anon, public;

-- A new academic year gets its partitions the moment it is created, so the
-- DEFAULT partition stays empty and attaching never has to scan it.
create or replace function private.academic_year_partitions_trg() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  perform private.ensure_year_partitions(new.id);
  return new;
end;
$$;
create trigger trg_academic_year_partitions after insert on public.academic_year
  for each row execute function private.academic_year_partitions_trg();

-- ---------------------------------------------------------------------------
-- 5. Restore the triggers, RLS and grants the originals carried.
-- ---------------------------------------------------------------------------
create trigger trg_mark_bounds before insert or update on public.mark
  for each row execute function private.mark_bounds_trg();
create trigger trg_touch_mark before update on public.mark
  for each row execute function private.set_updated_at();
create trigger trg_audit_mark after insert or update or delete on public.mark
  for each row execute function private.audit_trigger();

grant select, insert, update, delete on public.attendance to authenticated, service_role;
grant select, insert, update, delete on public.mark       to authenticated, service_role;

alter table public.attendance enable row level security;
alter table public.attendance force row level security;
alter table public.mark       enable row level security;
alter table public.mark       force row level security;

create policy attendance_read on public.attendance for select to authenticated
  using ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('attendance.view'))
          and ((select private.has_full_class_scope()) or private.teaches_class_section(class_section_id)))
         or (select private.is_platform_admin()));
create policy attendance_write on public.attendance for all to authenticated
  using ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('attendance.mark'))
          and ((select private.has_full_class_scope()) or private.teaches_class_section(class_section_id)))
         or (select private.is_platform_admin()))
  with check ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('attendance.mark'))
          and ((select private.has_full_class_scope()) or private.teaches_class_section(class_section_id)))
         or (select private.is_platform_admin()));
create policy parent_read_attendance on public.attendance for select to authenticated
  using ((select private.is_guardian_of(student_id)));

create policy mark_read on public.mark for select to authenticated
  using ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('exam.view'))
          and ((select private.has_full_class_scope())
               or exists (select 1 from public.student_enrollment se
                          where se.student_id = mark.student_id
                            and se.deleted_at is null
                            and private.teaches_class_section(se.class_section_id))))
         or (select private.is_platform_admin()));
create policy mark_write on public.mark for all to authenticated
  using ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('exam.mark_entry'))
          and ((select private.has_full_class_scope())
               or exists (select 1 from public.student_enrollment se
                          where se.student_id = mark.student_id
                            and se.deleted_at is null
                            and private.teaches_class_section(se.class_section_id))))
         or (select private.is_platform_admin()))
  with check ((institution_id = (select private.current_institution_id())
          and (select private.has_permission('exam.mark_entry'))
          and ((select private.has_full_class_scope())
               or exists (select 1 from public.student_enrollment se
                          where se.student_id = mark.student_id
                            and se.deleted_at is null
                            and private.teaches_class_section(se.class_section_id))))
         or (select private.is_platform_admin()));
create policy parent_read_mark on public.mark for select to authenticated
  using ((select private.is_guardian_of(student_id)));

-- ---------------------------------------------------------------------------
-- 6. Views, recreated verbatim apart from carrying the year through so callers
--    can prune. `v_attendance_trend` aggregated over all of history; grouping
--    by year means a three-year tenant reads one partition, not three.
-- ---------------------------------------------------------------------------
create view public.v_attendance_daily_summary as
  select institution_id, academic_year_id, class_section_id, att_date,
    count(*) filter (where status = 'present') as present,
    count(*) filter (where status = 'absent')  as absent,
    count(*) filter (where status = 'late')    as late,
    count(*) filter (where status = 'leave')   as on_leave
  from public.attendance where context = 'daily'
  group by institution_id, academic_year_id, class_section_id, att_date;

create view public.v_attendance_student_summary as
  select institution_id, academic_year_id, student_id, class_section_id,
    count(*) filter (where status in ('present','late')) as present_days,
    count(*) as total_days,
    round(100.0 * count(*) filter (where status in ('present','late'))::numeric
          / nullif(count(*), 0)::numeric, 1) as rate_pct
  from public.attendance where context = 'daily'
  group by institution_id, academic_year_id, student_id, class_section_id;

create view public.v_attendance_trend as
  select institution_id, academic_year_id, class_section_id,
    date_trunc('week', att_date::timestamptz)::date as week_start,
    count(*) filter (where status in ('present','late')) as present,
    count(*) filter (where status = 'absent') as absent,
    count(*) as total
  from public.attendance where context = 'daily'
  group by institution_id, academic_year_id, class_section_id,
           date_trunc('week', att_date::timestamptz);

grant select on public.v_attendance_daily_summary,
                public.v_attendance_student_summary,
                public.v_attendance_trend to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Drop the originals only once everything above has succeeded.
-- ---------------------------------------------------------------------------
drop table public.attendance_old;
drop table public.mark_old;

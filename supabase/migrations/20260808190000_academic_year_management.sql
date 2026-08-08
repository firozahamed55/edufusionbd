-- ============================================================================
-- Academic year management (audit §3.2 — "Academic year management", High).
--
-- `AcademicYearProvider` shipped, archived years are read-only, seven tables
-- are year-scoped, and there was no way to CREATE a year. A school reaching the
-- end of its first session had no path into its second one except a direct SQL
-- statement — which is a support ticket that ends in someone hand-editing
-- production.
--
-- WHY THE PARTITION CALL IS PART OF THIS. `ensure_year_partitions` exists and
-- `academic_year_partitions_trg` calls it on insert; creating a year through
-- this RPC keeps that path, which is why the insert is here and not in the
-- client. Attendance and mark writes for the new year fail without those
-- partitions, and they would fail at the first register of the new session —
-- the worst possible moment to discover it.
--
-- CLOSING IS NOT DELETING. A closed year keeps every row it owns; it stops
-- being writable. `deleted_at` stays reserved for a year created by mistake,
-- and `fn_close_academic_year` refuses to close the last remaining year,
-- because an institution with no current year has no default for any
-- year-scoped query.
-- ============================================================================

create or replace function public.fn_upsert_academic_year(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_inst uuid; v_id uuid; v_label text; v_start date; v_end date; v_current boolean;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_id      := nullif(payload->>'id','')::uuid;
  v_label   := nullif(trim(payload->>'year_label'),'');
  v_start   := nullif(payload->>'start_date','')::date;
  v_end     := nullif(payload->>'end_date','')::date;
  v_current := coalesce((payload->>'is_current')::boolean, false);

  if v_label is null then
    raise exception 'a year needs a label' using errcode = 'CHK01';
  end if;
  if v_start is not null and v_end is not null and v_end <= v_start then
    raise exception 'the year ends before it starts' using errcode = 'CHK01';
  end if;
  if exists (select 1 from public.academic_year y
              where y.institution_id = v_inst and lower(trim(y.year_label)) = lower(v_label)
                and y.deleted_at is null and (v_id is null or y.id <> v_id)) then
    raise exception 'a year called % already exists', v_label using errcode = 'CHK01';
  end if;

  -- Overlapping years make "which year is this enrolment in" a question the
  -- data cannot answer.
  if v_start is not null and v_end is not null
     and exists (select 1 from public.academic_year y
                  where y.institution_id = v_inst and y.deleted_at is null
                    and (v_id is null or y.id <> v_id)
                    and y.start_date is not null and y.end_date is not null
                    and v_start <= y.end_date and v_end >= y.start_date) then
    raise exception 'those dates overlap another academic year' using errcode = 'CHK01';
  end if;

  if v_id is null then
    insert into public.academic_year(institution_id, year_label, start_date, end_date, is_current)
    values (v_inst, v_label, v_start, v_end, false)
    returning id into v_id;
  else
    update public.academic_year
       set year_label = v_label, start_date = v_start, end_date = v_end
     where id = v_id and institution_id = v_inst and deleted_at is null;
  end if;

  if v_current then
    perform public.fn_set_current_academic_year(v_id);
  end if;

  return v_id;
end;
$$;

/**
 * Exactly one current year per institution — `uq_year_current` enforces it, so
 * the demotion must happen in the same statement-order as the promotion or the
 * unique index rejects the write.
 */
create or replace function public.fn_set_current_academic_year(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare v_inst uuid;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();

  if not exists (select 1 from public.academic_year
                  where id = p_id and institution_id = v_inst and deleted_at is null) then
    raise exception 'no such academic year' using errcode = 'CHK01';
  end if;

  update public.academic_year set is_current = false
   where institution_id = v_inst and is_current and id <> p_id;
  update public.academic_year set is_current = true
   where id = p_id and institution_id = v_inst;
end;
$$;

/**
 * Close a year. Refuses the last one standing: an institution with no current
 * year has no default for any of the seven year-scoped tables, and every
 * dropdown in the product would come back empty with no explanation.
 */
create or replace function public.fn_close_academic_year(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare v_inst uuid; v_others int;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();

  select count(*) into v_others from public.academic_year
   where institution_id = v_inst and deleted_at is null and id <> p_id;
  if v_others = 0 then
    raise exception 'this is the only academic year — create the next one before closing it'
      using errcode = 'CHK01';
  end if;

  update public.academic_year set is_current = false
   where id = p_id and institution_id = v_inst;
end;
$$;

/** Counts for the management screen: what a year actually holds. */
create or replace function public.fn_academic_year_stats()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_inst uuid; v_rows jsonb;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', y.id,
           'sections', (select count(*) from public.class_section s
                         where s.academic_year_id = y.id and s.deleted_at is null),
           'enrollments', (select count(*) from public.student_enrollment e
                            join public.class_section s on s.id = e.class_section_id
                           where s.academic_year_id = y.id),
           'exams', (select count(*) from public.exam x where x.academic_year_id = y.id),
           'terms', (select count(*) from public.academic_term tm where tm.academic_year_id = y.id)
         ) order by y.year_label desc), '[]'::jsonb)
    into v_rows
    from public.academic_year y
   where y.institution_id = v_inst and y.deleted_at is null;

  return v_rows;
end;
$$;

grant execute on function public.fn_upsert_academic_year(jsonb) to authenticated;
grant execute on function public.fn_set_current_academic_year(uuid) to authenticated;
grant execute on function public.fn_close_academic_year(uuid) to authenticated;
grant execute on function public.fn_academic_year_stats() to authenticated;

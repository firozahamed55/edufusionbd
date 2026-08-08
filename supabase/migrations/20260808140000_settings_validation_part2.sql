-- ============================================================================
-- Settings audit M-7 (part 2) and S-8.5 — the server half for the four screens
-- the first validation migration did not reach: Subject Group, Grading and
-- Academic Term.
--
-- The client is UX; the database is the control. Every rule the zod schemas in
-- `logic/schemas.ts` enforce is mirrored here, because a zod parse is
-- bypassable with the anon key and curl.
--
-- S-8.5 is the one that is not merely a validation rule. Editing a grading
-- scheme that has ALREADY been used to process results makes the marksheets
-- printed under the old bands unreproducible — the marks are stored, the bands
-- that turned them into letters are not versioned, so re-rendering an old
-- marksheet silently produces different grades. This is the highest-consequence
-- unguarded action in the module and the fix is a refusal, not a warning:
-- copy-on-write into a new scheme instead.
-- ============================================================================

/* --------------------------------------------- subject_group.name_bn (S-7.9) */

-- Every sibling entity carries name_bn/name_en; the group carried one
-- untranslated `name`, so a Bangla-locale operator read an English group label
-- next to Bangla subject chips.
alter table public.subject_group add column if not exists name_bn text;

create or replace function private.fn_upsert_subject_group(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_inst uuid; v_id uuid; v_sub jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.subject_group(institution_id, name, name_bn)
    values (v_inst, coalesce(nullif(payload->>'name',''),'Group'), nullif(payload->>'name_bn',''))
    returning id into v_id;
  else
    update public.subject_group
       set name    = coalesce(nullif(payload->>'name',''), name),
           -- Deliberately assignable to null: a Bangla name that was entered by
           -- mistake has to be removable, unlike `institution.metadata` (S-2.8).
           name_bn = nullif(payload->>'name_bn','')
     where id = v_id and institution_id = v_inst;
  end if;
  if payload ? 'subject_ids' then
    delete from public.subject_group_member where subject_group_id = v_id;
    for v_sub in select value from jsonb_array_elements(payload->'subject_ids') loop
      insert into public.subject_group_member(subject_group_id, subject_id)
      values (v_id, (v_sub #>> '{}')::uuid) on conflict do nothing;
    end loop;
  end if;
  return v_id;
end;
$$;

/* ------------------------------------------------------ grading (S-8.5, S-8.7) */

create or replace function private.fn_check_grade_scheme(payload jsonb)
returns void language plpgsql set search_path to '' as $$
declare
  v_inst uuid; v_id uuid; v_row jsonb; v_processed bigint;
  v_prev_min int := null; v_letters text[] := '{}';
begin
  v_inst := private.current_institution_id();
  v_id   := nullif(payload->>'id','')::uuid;

  if coalesce(trim(payload->>'name'),'') = '' then
    raise exception 'a scheme needs a name' using errcode = 'CHK01';
  end if;

  if payload ? 'scales' then
    if jsonb_array_length(payload->'scales') = 0 then
      raise exception 'a scheme needs at least one band' using errcode = 'CHK01';
    end if;

    -- Bands, highest first. Walked in descending min_marks so a gap or an
    -- overlap between adjacent bands is a single comparison.
    for v_row in
      select value from jsonb_array_elements(payload->'scales')
       order by coalesce(nullif(value->>'min_marks','')::numeric, 0) desc
    loop
      if coalesce(trim(v_row->>'grade_letter'),'') = '' then
        raise exception 'every band needs a grade letter' using errcode = 'CHK01';
      end if;
      if (v_row->>'grade_letter') = any(v_letters) then
        raise exception 'the grade letter % appears twice', v_row->>'grade_letter' using errcode = 'CHK01';
      end if;
      v_letters := v_letters || (v_row->>'grade_letter');

      if coalesce(nullif(v_row->>'gpa_point','')::numeric, 0) < 0
         or coalesce(nullif(v_row->>'gpa_point','')::numeric, 0) > 10 then
        raise exception 'GPA must be between 0 and 10' using errcode = 'CHK01';
      end if;
      if coalesce(nullif(v_row->>'min_marks','')::numeric, 0)
         > coalesce(nullif(v_row->>'max_marks','')::numeric, 100) then
        raise exception 'a band cannot start above where it ends' using errcode = 'CHK01';
      end if;
      if coalesce(nullif(v_row->>'max_marks','')::numeric, 100) > 100
         or coalesce(nullif(v_row->>'min_marks','')::numeric, 0) < 0 then
        raise exception 'bands run from 0 to 100' using errcode = 'CHK01';
      end if;

      -- A gap silently mis-grades every mark that falls in it; an overlap makes
      -- the grade depend on row order.
      if v_prev_min is not null
         and coalesce(nullif(v_row->>'max_marks','')::numeric, 100) <> v_prev_min - 1 then
        raise exception 'the bands leave a gap or overlap around %', v_prev_min using errcode = 'CHK01';
      end if;
      v_prev_min := coalesce(nullif(v_row->>'min_marks','')::numeric, 0)::int;
    end loop;

    -- S-8.5. Only band edits are refused: renaming a scheme, or flipping
    -- is_default, leaves every processed result reproducible.
    if v_id is not null then
      select count(*) into v_processed
        from public.exam_result r
        join public.exam e on e.id = r.exam_id
       where e.grade_scheme_id = v_id and r.institution_id = v_inst;
      if v_processed > 0 then
        raise exception
          'this scheme has already graded % results — copy it to a new scheme instead of editing the bands', v_processed
          using errcode = 'CHK02';
      end if;
    end if;
  end if;
end;
$$;

create or replace function public.fn_upsert_grade_scheme(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
begin
  perform private.require_permission('core.settings');
  perform private.fn_check_grade_scheme(payload);
  return private.fn_upsert_grade_scheme(payload);
end;
$$;

-- The hard reference the impact preview reports as blocking has to be refused
-- by the database too, or the refusal is only a UI convention.
create or replace function public.fn_delete_grade_scheme(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare v_inst uuid; v_processed bigint;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();
  select count(*) into v_processed
    from public.exam_result r
    join public.exam e on e.id = r.exam_id
   where e.grade_scheme_id = p_id and r.institution_id = v_inst;
  if v_processed > 0 then
    raise exception 'this scheme has graded % results and cannot be deleted', v_processed
      using errcode = 'CHK02';
  end if;
  perform private.fn_delete_grade_scheme(p_id);
end;
$$;

/* --------------------------------------------------- academic term (S-4.9) */

create or replace function private.fn_check_academic_term(payload jsonb)
returns void language plpgsql set search_path to '' as $$
declare
  v_inst uuid; v_id uuid; v_year uuid; v_start date; v_end date;
  v_ys date; v_ye date; v_clash text;
begin
  v_inst  := private.current_institution_id();
  v_id    := nullif(payload->>'id','')::uuid;
  v_year  := nullif(payload->>'academic_year_id','')::uuid;
  v_start := nullif(payload->>'start_date','')::date;
  v_end   := nullif(payload->>'end_date','')::date;

  if coalesce(trim(payload->>'name_en'),'') = '' then
    raise exception 'a term needs a name' using errcode = 'CHK01';
  end if;
  if v_start is null or v_end is null then return; end if;
  if v_end < v_start then
    raise exception 'the end date is before the start date' using errcode = 'CHK01';
  end if;

  if v_year is not null then
    select y.start_date, y.end_date into v_ys, v_ye
      from public.academic_year y where y.id = v_year and y.institution_id = v_inst;
    if v_ys is not null and (v_start < v_ys or v_end > v_ye) then
      raise exception 'the term falls outside the academic year (% to %)', v_ys, v_ye
        using errcode = 'CHK01';
    end if;
  end if;

  -- Two terms covering the same day make "which term is this mark in"
  -- unanswerable, and the marksheet picks one arbitrarily.
  select coalesce(t.name_en, '') into v_clash
    from public.academic_term t
   where t.institution_id = v_inst
     and (v_id is null or t.id <> v_id)
     and (v_year is null or t.academic_year_id = v_year)
     and t.start_date is not null and t.end_date is not null
     and v_start <= t.end_date and v_end >= t.start_date
   limit 1;
  if v_clash is not null then
    raise exception 'these dates overlap the term "%"', v_clash using errcode = 'CHK01';
  end if;
end;
$$;

create or replace function public.fn_upsert_academic_term(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_inst uuid; v_id uuid;
begin
  perform private.require_permission('core.settings');
  perform private.fn_check_academic_term(payload);

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
       set name_en    = coalesce(nullif(payload->>'name_en',''), name_en),
           name_bn    = nullif(payload->>'name_bn',''),
           start_date = nullif(payload->>'start_date','')::date,
           end_date   = nullif(payload->>'end_date','')::date,
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
end;
$$;

/* ------------------------------------------------------- signature (S-5.x) */

create or replace function private.fn_check_signature(payload jsonb)
returns void language plpgsql set search_path to '' as $$
begin
  if coalesce(trim(payload->>'role_label'),'') = '' then
    raise exception 'a signature needs a role' using errcode = 'CHK01';
  end if;
  -- A blank holder name prints a blank signature block on a legal document.
  if length(coalesce(trim(payload->>'holder_name'),'')) < 2 then
    raise exception 'a signature needs the signatory''s name' using errcode = 'CHK01';
  end if;
end;
$$;

create or replace function public.fn_upsert_signature(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
begin
  perform private.require_permission('core.settings');
  perform private.fn_check_signature(payload);
  return private.fn_upsert_signature(payload);
end;
$$;

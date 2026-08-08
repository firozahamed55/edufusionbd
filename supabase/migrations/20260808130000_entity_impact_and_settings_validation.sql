-- ============================================================================
-- Settings audit M-16 and M-7 — what a delete actually costs, and the server
-- half of the validation.
--
-- M-16: every destructive action in this module confirms with a sentence that
-- names the record and nothing else. "Delete subject?" for a subject with two
-- thousand marks recorded against it. "All sections will be affected" for a
-- class, without saying that the sections hold 128 enrolled students. The one
-- place it is done right is the term delete, which warns about report mismatch
-- — and that is the model for the rest.
--
-- `fn_entity_impact` answers "what points at this" in one round trip, so the
-- confirm dialog can say *3 sections · 128 enrolled students · 4 subject
-- mappings* instead of a shrug. `blocking` marks the references that make a
-- delete destructive rather than merely consequential; the UI refuses those and
-- requires type-to-confirm for the rest.
--
-- M-7: the client is UX, the database is the control. Every cross-field rule
-- the zod schemas enforce is mirrored here, because a zod parse is bypassable
-- with the anon key and curl, and `pass_marks > full_marks` is upstream of
-- exam processing for a whole cohort.
-- ============================================================================

create or replace function public.fn_entity_impact(p_entity text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_inst  uuid;
  -- Each branch builds a {key, count, blocking} array, skipping zero counts —
  -- a dialog listing "0 sections · 0 marks" is noise, not information.
  v_items jsonb := '[]'::jsonb;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();

  if p_entity = 'class' then
    v_items := (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('key','sections','count',c,'blocking',false) x
          from (select count(*) c from public.class_section s
                 where s.class_id = p_id and s.institution_id = v_inst and s.deleted_at is null) q where c > 0
        union all
        select jsonb_build_object('key','enrolled_students','count',c,'blocking',true)
          from (select count(*) c from public.student_enrollment e
                  join public.class_section s on s.id = e.class_section_id
                 where s.class_id = p_id and e.institution_id = v_inst) q where c > 0
        union all
        select jsonb_build_object('key','subject_mappings','count',c,'blocking',false)
          from (select count(*) c from public.class_subject cs
                 where cs.class_id = p_id and cs.institution_id = v_inst) q where c > 0
        union all
        select jsonb_build_object('key','fee_mappings','count',c,'blocking',false)
          from (select count(*) c from public.fee_mapping fm
                 where fm.class_id = p_id and fm.institution_id = v_inst) q where c > 0
      ) t);

  elsif p_entity = 'class_section' then
    v_items := (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('key','enrolled_students','count',c,'blocking',true) x
          from (select count(*) c from public.student_enrollment e
                 where e.class_section_id = p_id and e.institution_id = v_inst) q where c > 0
        union all
        select jsonb_build_object('key','attendance_records','count',c,'blocking',false)
          from (select count(*) c from public.attendance a
                 where a.class_section_id = p_id and a.institution_id = v_inst) q where c > 0
      ) t);

  elsif p_entity = 'subject' then
    v_items := (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        -- A subject with marks recorded against it cannot be removed without
        -- orphaning a result that has already been printed.
        select jsonb_build_object('key','recorded_marks','count',c,'blocking',true) x
          from (select count(*) c from public.mark m
                  join public.exam_subject es on es.id = m.exam_subject_id
                 where es.subject_id = p_id and m.institution_id = v_inst) q where c > 0
        union all
        select jsonb_build_object('key','class_mappings','count',c,'blocking',false)
          from (select count(*) c from public.class_subject cs
                 where cs.subject_id = p_id and cs.institution_id = v_inst) q where c > 0
        union all
        select jsonb_build_object('key','subject_groups','count',c,'blocking',false)
          from (select count(*) c from public.subject_group_member gm
                 where gm.subject_id = p_id) q where c > 0
        union all
        select jsonb_build_object('key','exam_papers','count',c,'blocking',false)
          from (select count(*) c from public.exam_subject es
                 where es.subject_id = p_id and es.institution_id = v_inst) q where c > 0
      ) t);

  elsif p_entity = 'subject_group' then
    v_items := (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('key','subjects','count',c,'blocking',false) x
          from (select count(*) c from public.subject_group_member gm
                 where gm.subject_group_id = p_id) q where c > 0
      ) t);

  elsif p_entity = 'grade_scheme' then
    v_items := (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        -- An exam whose results were processed under this scheme is the hard
        -- reference: deleting it makes an already-printed marksheet
        -- unreproducible (audit S-8.5).
        select jsonb_build_object('key','processed_results','count',c,'blocking',true) x
          from (select count(*) c from public.exam_result r
                  join public.exam e on e.id = r.exam_id
                 where e.grade_scheme_id = p_id and r.institution_id = v_inst) q where c > 0
        union all
        select jsonb_build_object('key','classes','count',c,'blocking',false)
          from (select count(*) c from public.class cl
                 where cl.grade_scheme_id = p_id and cl.institution_id = v_inst) q where c > 0
        union all
        select jsonb_build_object('key','exams','count',c,'blocking',false)
          from (select count(*) c from public.exam e
                 where e.grade_scheme_id = p_id and e.institution_id = v_inst) q where c > 0
        union all
        -- The dangling reference the audit names: `basic_config` points at a
        -- scheme the Grading screen can delete out from under it.
        select jsonb_build_object('key','institution_default','count',1,'blocking',false)
         where exists (select 1 from public.setting s
                        where s.institution_id = v_inst and s.key = 'basic_config'
                          and s.value->>'grading_system_id' = p_id::text)
      ) t);

  elsif p_entity = 'academic_term' then
    v_items := (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('key','exams','count',c,'blocking',false) x
          from (select count(*) c from public.exam e
                 where e.academic_term_id = p_id and e.institution_id = v_inst) q where c > 0
        union all
        select jsonb_build_object('key','fee_invoices','count',c,'blocking',true)
          from (select count(*) c from public.fee_invoice fi
                 where fi.academic_term_id = p_id and fi.institution_id = v_inst) q where c > 0
      ) t);

  else
    raise exception 'unknown entity for impact preview: %', p_entity;
  end if;

  return jsonb_build_object(
    'items', v_items,
    'blocking', coalesce((select bool_or((i->>'blocking')::boolean) from jsonb_array_elements(v_items) i), false)
  );
end;
$$;

/* --------------------------------------------- calendar impact by DATE range */

-- Not an entity id: a calendar mark is keyed by date, and what it affects is
-- attendance already recorded on those days (audit S-4.11).
create or replace function public.fn_calendar_impact(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_inst uuid; v_att bigint;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();

  select count(*) into v_att from public.attendance a
   where a.institution_id = v_inst and a.att_date between p_from and coalesce(p_to, p_from);

  return jsonb_build_object(
    'items', case when v_att > 0
      then jsonb_build_array(jsonb_build_object('key','attendance_records','count',v_att,'blocking',false))
      else '[]'::jsonb end,
    'blocking', false);
end;
$$;

/* ------------------------------------------- M-7 · server-side mirror rules */

-- The client parses with zod; these are the checks that hold when it does not.
-- Each raises `CHK01`, which the client maps to a field error rather than a
-- generic failure.

create or replace function private.fn_check_subject(payload jsonb)
returns void language plpgsql set search_path to '' as $$
declare v_full numeric; v_pass numeric; v_min int; v_max int;
begin
  v_full := nullif(payload->>'full_marks','')::numeric;
  v_pass := nullif(payload->>'pass_marks','')::numeric;
  v_min  := nullif(payload->>'min_class_level','')::int;
  v_max  := nullif(payload->>'max_class_level','')::int;

  if v_full is not null and (v_full <= 0 or v_full > 1000) then
    raise exception 'full marks must be between 1 and 1000' using errcode = 'CHK01';
  end if;
  if v_pass is not null and v_pass < 0 then
    raise exception 'pass marks cannot be negative' using errcode = 'CHK01';
  end if;
  if v_full is not null and v_pass is not null and v_pass > v_full then
    raise exception 'pass marks cannot exceed full marks' using errcode = 'CHK01';
  end if;
  if v_min is not null and v_max is not null and v_min > v_max then
    raise exception 'the last applicable class comes before the first' using errcode = 'CHK01';
  end if;
end;
$$;

create or replace function private.fn_check_class(payload jsonb)
returns void language plpgsql set search_path to '' as $$
declare v_inst uuid; v_level int; v_id uuid;
begin
  v_inst  := private.current_institution_id();
  v_level := nullif(payload->>'numeric_level','')::int;
  v_id    := nullif(payload->>'id','')::uuid;
  if v_level is null then return; end if;
  if v_level < 1 or v_level > 20 then
    raise exception 'numeric level must be between 1 and 20' using errcode = 'CHK01';
  end if;
  -- Two classes at level 9 make ordering ambiguous everywhere it is used.
  if exists (select 1 from public.class c
              where c.institution_id = v_inst and c.numeric_level = v_level
                and c.deleted_at is null and (v_id is null or c.id <> v_id)) then
    raise exception 'another class already uses that numeric level' using errcode = 'CHK01';
  end if;
end;
$$;

create or replace function private.fn_check_class_section(payload jsonb)
returns void language plpgsql set search_path to '' as $$
declare v_cap int; v_id uuid; v_enrolled bigint;
begin
  v_cap := nullif(payload->>'capacity','')::int;
  v_id  := nullif(payload->>'id','')::uuid;
  if v_cap is null then return; end if;
  if v_cap < 1 then
    raise exception 'capacity must be at least 1' using errcode = 'CHK01';
  end if;
  if v_id is not null then
    select count(*) into v_enrolled from public.student_enrollment e where e.class_section_id = v_id;
    if v_cap < v_enrolled then
      raise exception 'capacity is below the % students already enrolled', v_enrolled using errcode = 'CHK01';
    end if;
  end if;
end;
$$;

create or replace function private.fn_check_subject_group(payload jsonb)
returns void language plpgsql set search_path to '' as $$
declare v_inst uuid; v_name text; v_id uuid; v_count int;
begin
  v_inst := private.current_institution_id();
  v_name := lower(trim(coalesce(payload->>'name','')));
  v_id   := nullif(payload->>'id','')::uuid;

  select count(*) into v_count from jsonb_array_elements_text(coalesce(payload->'subject_ids','[]'::jsonb));
  if v_count = 0 then
    raise exception 'a group with no subjects does nothing' using errcode = 'CHK01';
  end if;
  if exists (select 1 from public.subject_group g
              where g.institution_id = v_inst and lower(trim(g.name)) = v_name
                and (v_id is null or g.id <> v_id)) then
    raise exception 'a group with that name already exists' using errcode = 'CHK01';
  end if;
end;
$$;

/* --------------------------------------- wire the checks into the wrappers */

-- The guard wrappers are the one place every caller passes through, PostgREST
-- or route alike, which is exactly why the check belongs here and not in
-- `private.fn_upsert_*` (those are also called by the bulk importers, which
-- have their own row-level reporting and must not raise on the first bad row).

create or replace function public.fn_upsert_subject(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
begin
  perform private.require_permission('core.settings');
  perform private.fn_check_subject(payload);
  return private.fn_upsert_subject(payload);
end;
$$;

create or replace function public.fn_upsert_class(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
begin
  perform private.require_permission('core.settings');
  perform private.fn_check_class(payload);
  return private.fn_upsert_class(payload);
end;
$$;

create or replace function public.fn_upsert_class_section(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
begin
  perform private.require_permission('core.settings');
  perform private.fn_check_class_section(payload);
  return private.fn_upsert_class_section(payload);
end;
$$;

create or replace function public.fn_upsert_subject_group(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
begin
  perform private.require_permission('core.settings');
  perform private.fn_check_subject_group(payload);
  return private.fn_upsert_subject_group(payload);
end;
$$;

grant execute on function public.fn_entity_impact(text, uuid) to authenticated;
grant execute on function public.fn_calendar_impact(date, date) to authenticated;

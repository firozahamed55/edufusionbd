-- ============================================================================
-- `fn_settings_status` — the numbers the Settings hub is built on (audit M-6).
--
-- The module had no landing page: `/admin/core` 404'd, the rail pointed straight
-- at a form, and eleven unfamiliar tabs were presented as one flat strip. The
-- hub replaces that, and a hub is only worth building if each card can say what
-- the state of its area actually is — "12 classes", "0 signatures", "calendar
-- not set up". A card that says only its own name is a link with a border.
--
-- ONE ROUND TRIP, DELIBERATELY. The alternative is eleven `count` queries fired
-- from the hub on mount, which is eleven round trips before the first paint of
-- the screen an administrator meets during onboarding. Each count below is an
-- index-only scan on an already-indexed tenant column.
--
-- The setup flags are the more important half. `signature = 0` means every
-- certificate the product has printed is unsigned, and `academic_calendar = 0`
-- means attendance is takeable on Eid — both true in production today, and
-- neither discoverable anywhere in the product except by the failure they
-- eventually cause.
-- ============================================================================

create or replace function public.fn_settings_status()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_inst uuid;
  v_year uuid;
  v_inst_row record;
  v_result jsonb;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select id into v_year from public.academic_year
   where institution_id = v_inst and is_current and deleted_at is null limit 1;

  select i.name_en, i.eiin, i.address, i.logo_file_id, i.head_teacher_id
    into v_inst_row
    from public.institution i where i.id = v_inst;

  select jsonb_build_object(
    'classes',        (select count(*) from public.class where institution_id = v_inst and deleted_at is null),
    'sections',       (select count(*) from public.class_section where institution_id = v_inst and deleted_at is null),
    'subjects',       (select count(*) from public.subject where institution_id = v_inst and deleted_at is null),
    'subject_groups', (select count(*) from public.subject_group where institution_id = v_inst),
    'grade_schemes',  (select count(*) from public.grade_scheme where institution_id = v_inst and deleted_at is null),
    'signatures',     (select count(*) from public.signature where institution_id = v_inst and image_file_id is not null),
    'users',          (select count(*) from public.profile where institution_id = v_inst),
    'roles',          (select count(*) from public.role),
    'terms',          (select count(*) from public.academic_term where institution_id = v_inst
                        and (v_year is null or academic_year_id = v_year)),
    -- Only non-working days count as "the calendar is set up": the weekend rows
    -- a seed job writes are not a declaration that anyone made.
    'calendar_days',  (select count(*) from public.academic_calendar
                        where institution_id = v_inst and is_working_day = false),
    'audit_events_30d', (select count(*) from public.audit_log
                          where institution_id = v_inst and at > now() - interval '30 days'),
    'identity', jsonb_build_object(
      'name',  coalesce(nullif(trim(v_inst_row.name_en), ''), null) is not null,
      'eiin',  coalesce(nullif(trim(v_inst_row.eiin), ''), null) is not null,
      'address', coalesce(nullif(trim(v_inst_row.address), ''), null) is not null,
      'logo',  v_inst_row.logo_file_id is not null,
      'head_teacher', v_inst_row.head_teacher_id is not null
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.fn_settings_status() to authenticated;

-- ============================================================================
-- Settings audit M-3 / S-1.1 — two administrators, one erased configuration.
--
-- `fn_save_setting` was `value = excluded.value`: a whole-document replace.
-- `BasicConfigScreen` loads the entire `basic_config` blob into React state and
-- re-sends all of it on save. So:
--
--   09:00  A and B both open Basic Config
--   09:05  A changes the pass mark and saves
--   09:06  B changes the currency and saves — sending the blob B loaded at
--          09:00, which still carries the OLD pass mark
--
-- A's change is gone. Silently, with a green "Saved" toast, and the audit log
-- records both writes as legitimate UPDATEs, so the loss is invisible until a
-- cohort is graded against a pass mark nobody set. `basic_config` holds fifteen
-- values including the grading scheme, the pass mark and the attendance model,
-- and the certificate module's admit-instruction and exam-essentials editors
-- have exactly the same shape.
--
-- TWO CHANGES, AND THE FIRST IS THE ONE THAT MATTERS.
--
-- 1. MERGE, not replace. `value = coalesce(value,'{}') || p_value`. The client
--    now sends only the keys it changed, so two operators editing DIFFERENT
--    settings no longer touch each other at all. This removes the catastrophic
--    case — losing fourteen unrelated settings — outright, rather than
--    detecting it.
--
--    The cost is that a key can no longer be REMOVED by omitting it. Nothing in
--    the product removes setting keys today; when something needs to,
--    `p_unset text[]` is the additive way to do it, not a return to replace.
--
-- 2. Optimistic concurrency, opt-in. When the caller passes the `updated_at` it
--    read, a row that has moved since raises instead of writing. The client
--    turns that into "this page was changed by someone else — reload, or
--    overwrite", which is a decision an operator can make. Callers that omit it
--    (the certificate editors, for now) keep working unchanged.
--
--    SQLSTATE `PT409`: PostgREST maps `PTxxx` to an HTTP status, so this
--    surfaces as a real 409 Conflict rather than a generic 500 the client would
--    have to string-match.
--
-- The return type changes from void to the new `updated_at`, so the client can
-- advance its baseline without a refetch. That needs a DROP — `create or
-- replace` cannot change a return type — and the four-argument signature with a
-- default means every existing three-argument call site still resolves here.
-- ============================================================================

drop function if exists public.fn_save_setting(text, text, jsonb);

create or replace function public.fn_save_setting(
  p_key text,
  p_scope text,
  p_value jsonb,
  p_expected_updated_at timestamptz default null
)
returns timestamptz language plpgsql security definer set search_path to '' as $fn$
declare
  v_inst uuid;
  v_scope text := coalesce(p_scope, 'general');
  v_current timestamptz;
  v_new timestamptz;
begin
  perform private.require_permission('core.settings');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select s.updated_at into v_current
    from public.setting s
   where s.institution_id = v_inst and s.key = p_key and s.scope = v_scope;

  -- Only when the caller opted in AND the row already existed. A first write
  -- has nothing to conflict with, and a caller that passes nothing is asking
  -- for the old behaviour.
  if p_expected_updated_at is not null
     and v_current is not null
     and v_current is distinct from p_expected_updated_at then
    raise exception 'this setting was changed by someone else'
      using errcode = 'PT409',
            detail = format('expected %s, found %s', p_expected_updated_at, v_current);
  end if;

  insert into public.setting(institution_id, key, scope, value, updated_at)
  values (v_inst, p_key, v_scope, coalesce(p_value, '{}'::jsonb), now())
  on conflict (institution_id, key, scope) do update
    set value = coalesce(public.setting.value, '{}'::jsonb) || coalesce(excluded.value, '{}'::jsonb),
        updated_at = now()
  returning updated_at into v_new;

  return v_new;
end; $fn$;

revoke all on function public.fn_save_setting(text, text, jsonb, timestamptz) from public, anon;
grant execute on function public.fn_save_setting(text, text, jsonb, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- `institution.metadata` has the mirror-image defect: it is merged with `||`
-- and never pruned, so a key written once can never be removed. Same fix in
-- the other direction — an explicit unset list, so "clear this" is expressible
-- without making every partial update destructive.
-- ---------------------------------------------------------------------------
create or replace function private.fn_update_institution(payload jsonb)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_unset text[];
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_unset := case when jsonb_typeof(payload->'metadata_unset') = 'array'
                  then array(select jsonb_array_elements_text(payload->'metadata_unset'))
                  else '{}'::text[] end;

  update public.institution set
    name_bn = coalesce(nullif(payload->>'name_bn',''), name_bn),
    name_en = coalesce(nullif(payload->>'name_en',''), name_en),
    eiin = case when payload ? 'eiin' then nullif(payload->>'eiin','') else eiin end,
    institution_type = case when payload ? 'institution_type' then nullif(payload->>'institution_type','') else institution_type end,
    address = case when payload ? 'address' then nullif(payload->>'address','') else address end,
    phone = case when payload ? 'phone' then nullif(payload->>'phone','') else phone end,
    email = case when payload ? 'email' then nullif(payload->>'email','') else email end,
    website = case when payload ? 'website' then nullif(payload->>'website','') else website end,
    established_year = case when payload ? 'established_year' then nullif(payload->>'established_year','')::int else established_year end,
    board_id = case when payload ? 'board_id' then nullif(payload->>'board_id','')::uuid else board_id end,
    head_teacher_id = case when payload ? 'head_teacher_id' then nullif(payload->>'head_teacher_id','')::uuid else head_teacher_id end,
    -- `logo_file_id` keeps coalesce (a partial save must not drop the logo) but
    -- gains an explicit clear, so "remove the logo" is now expressible.
    logo_file_id = case when coalesce((payload->>'logo_clear')::boolean, false) then null
                        else coalesce(nullif(payload->>'logo_file_id','')::uuid, logo_file_id) end,
    metadata = (coalesce(metadata, '{}'::jsonb) || coalesce(payload->'metadata', '{}'::jsonb)) - v_unset,
    updated_at = now()
  where id = v_inst;
end; $fn$;

-- ---------------------------------------------------------------------------
-- `fn_attendance_summary` documents "null section = the whole institution" in
-- its body — `(p_class_section_id is null or ...)` — and its wrapper had no
-- default on that parameter. So the Analytics screen's own default view ("All
-- classes & sections") could only be requested by explicitly sending null,
-- which the regenerated types correctly reject. Give the parameter the default
-- the implementation already assumes.
-- ---------------------------------------------------------------------------
drop function if exists public.fn_attendance_summary(uuid, date, date);

create or replace function public.fn_attendance_summary(
  p_class_section_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb language plpgsql security definer set search_path to '' as $fn$
begin
  perform private.require_permission('attendance.view');
  return private.fn_attendance_summary(p_class_section_id, p_from, p_to);
end; $fn$;

revoke all on function public.fn_attendance_summary(uuid, date, date) from public, anon;
grant execute on function public.fn_attendance_summary(uuid, date, date) to authenticated;

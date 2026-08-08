-- ============================================================================
-- Subject groups become the domain object they were always meant to be
-- (audit S-7.5, S-7.6).
--
-- The screen modelled a group as (name, subjects). That is not what a group is
-- in a Bangladeshi school, and the gap is why the audit says this screen "needs
-- the most conceptual work of the eleven":
--
--   • A "Science" group means nothing until it is attached to classes 9 and 10.
--     That relationship was absent from the product entirely (S-7.5), so a
--     group could not be used to drive anything.
--   • Within a group, some subjects are compulsory and some are an elective
--     pool the student picks N from — "choose 1 of Higher Math / Biology /
--     Agriculture" is the single most common rule in the country and was
--     unrepresentable (S-7.6). Every subject in a group was equally, silently
--     compulsory.
--
-- MODELLED, NOT ENFORCED, in this migration. The pick-N rule is stored so the
-- product can express it; enforcing "this student picked 2 where the rule says
-- 1" belongs to enrolment, which is a different module and a different phase.
-- Storing it first is what makes that work possible at all — and a rule nobody
-- can enter is a rule nobody can enforce.
-- ============================================================================

/* Which classes a group applies to. A group with none is a template nobody uses,
   which is exactly what every group in production is today. */
create table if not exists public.subject_group_class (
  subject_group_id uuid not null references public.subject_group(id) on delete cascade,
  class_id         uuid not null references public.class(id) on delete cascade,
  primary key (subject_group_id, class_id)
);

alter table public.subject_group_class enable row level security;

-- Scoped through the parent group, which already carries institution_id — the
-- join table holds no tenant column of its own to drift out of sync.
drop policy if exists subject_group_class_read on public.subject_group_class;
create policy subject_group_class_read on public.subject_group_class
  for select to authenticated
  using (exists (
    select 1 from public.subject_group g
     where g.id = subject_group_id and g.institution_id = private.current_institution_id()));

/* Compulsory vs elective, and how many of an elective pool a student takes. */
alter table public.subject_group_member
  add column if not exists is_elective boolean not null default false;

alter table public.subject_group
  -- How many subjects from this group's elective pool a student picks.
  -- Null means "no elective rule" — the pre-existing behaviour.
  add column if not exists elective_pick int;

alter table public.subject_group
  drop constraint if exists subject_group_elective_pick_sane;
alter table public.subject_group
  add constraint subject_group_elective_pick_sane
  check (elective_pick is null or elective_pick between 1 and 10);

create index if not exists idx_subject_group_class_class on public.subject_group_class(class_id);

/* ---------------------------------------------------------------- upsert */

create or replace function private.fn_upsert_subject_group(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_inst uuid; v_id uuid; v_sub jsonb; v_cls jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;

  if v_id is null then
    insert into public.subject_group(institution_id, name, name_bn, elective_pick)
    values (v_inst, coalesce(nullif(payload->>'name',''),'Group'), nullif(payload->>'name_bn',''),
            nullif(payload->>'elective_pick','')::int)
    returning id into v_id;
  else
    update public.subject_group
       set name          = coalesce(nullif(payload->>'name',''), name),
           name_bn       = nullif(payload->>'name_bn',''),
           elective_pick = nullif(payload->>'elective_pick','')::int
     where id = v_id and institution_id = v_inst;
  end if;

  -- `subject_ids` carries {id, is_elective}; a bare uuid string stays accepted
  -- so the bulk importer and any older caller keep working.
  if payload ? 'subject_ids' then
    delete from public.subject_group_member where subject_group_id = v_id;
    for v_sub in select value from jsonb_array_elements(payload->'subject_ids') loop
      insert into public.subject_group_member(subject_group_id, subject_id, is_elective)
      values (
        v_id,
        coalesce(nullif(v_sub->>'id',''), v_sub #>> '{}')::uuid,
        coalesce((v_sub->>'is_elective')::boolean, false)
      )
      on conflict do nothing;
    end loop;
  end if;

  if payload ? 'class_ids' then
    delete from public.subject_group_class where subject_group_id = v_id;
    for v_cls in select value from jsonb_array_elements(payload->'class_ids') loop
      insert into public.subject_group_class(subject_group_id, class_id)
      values (v_id, (v_cls #>> '{}')::uuid)
      on conflict do nothing;
    end loop;
  end if;

  return v_id;
end;
$$;

create or replace function private.fn_check_subject_group(payload jsonb)
returns void language plpgsql set search_path to '' as $$
declare v_inst uuid; v_name text; v_id uuid; v_count int; v_electives int; v_pick int;
begin
  v_inst := private.current_institution_id();
  v_name := lower(trim(coalesce(payload->>'name','')));
  v_id   := nullif(payload->>'id','')::uuid;
  v_pick := nullif(payload->>'elective_pick','')::int;

  select count(*) into v_count from jsonb_array_elements(coalesce(payload->'subject_ids','[]'::jsonb));
  if v_count = 0 then
    raise exception 'a group with no subjects does nothing' using errcode = 'CHK01';
  end if;
  if exists (select 1 from public.subject_group g
              where g.institution_id = v_inst and lower(trim(g.name)) = v_name
                and (v_id is null or g.id <> v_id)) then
    raise exception 'a group with that name already exists' using errcode = 'CHK01';
  end if;

  if v_pick is not null then
    select count(*) into v_electives
      from jsonb_array_elements(coalesce(payload->'subject_ids','[]'::jsonb)) e
     where coalesce((e.value->>'is_elective')::boolean, false);
    -- "Pick 3 of 2" is a rule no student can satisfy, and it would surface at
    -- enrolment as an unexplainable failure rather than here as a typo.
    if v_pick > v_electives then
      raise exception 'the rule asks for % elective subjects but only % are marked elective', v_pick, v_electives
        using errcode = 'CHK01';
    end if;
  end if;
end;
$$;

grant select on public.subject_group_class to authenticated;

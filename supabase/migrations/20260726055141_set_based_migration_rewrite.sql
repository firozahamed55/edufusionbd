-- ============================================================================
-- Phase 2.5 (A-H7) — set-based rewrite of the year-end promotion.
--
-- `fn_run_migration` processed one student per iteration of a PL/pgSQL
-- `for ... loop`, each iteration touching 4 tables. A 1,200-student school
-- promoted section-by-section meant ~30 sequential requests; a whole-school
-- call was long enough to exceed the `authenticated` role's statement timeout
-- and roll back after the operator had already been waiting on it.
--
-- The roll-number assignment IS expressible set-based, exactly as the audit
-- says: the client submits students pre-ordered (merit or manual), so
-- `jsonb_array_elements(...) WITH ORDINALITY` recovers that order as `ord`,
-- and `v_base_roll + ord` is the same arithmetic the loop did per iteration —
-- just computed for every row in one pass instead of one row per statement.
--
-- SHAPE: a session-temp working table plus four INSERT/UPDATE ... FROM
-- statements. Not a single mega-CTE, on purpose — `RETURNING` cannot hand back
-- columns that were never inserted (`merit_rank`, `result`), so a chained CTE
-- would need to re-derive the join key anyway. The temp table makes each step
-- readable and independently checkable, which matters more here than shaving
-- four statements down to one: this function moves a whole school's academic
-- record in one transaction.
--
-- `fn_pushback_migration` gets the same treatment — same shape of loop, same
-- fix, and it is the function an operator reaches for when something about
-- the migration went wrong, which is exactly the moment a slow query is least
-- welcome.
-- ============================================================================
create or replace function private.fn_run_migration(payload jsonb) returns uuid
 language plpgsql security definer set search_path = '' as $function$
declare
  v_inst uuid; v_batch uuid; v_year uuid; v_src uuid; v_tgt uuid; v_type text;
  v_base_roll int;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_year := nullif(payload->>'academic_year_id','')::uuid;
  v_src  := nullif(payload->>'source_class_section_id','')::uuid;
  v_tgt  := nullif(payload->>'target_class_section_id','')::uuid;
  v_type := coalesce(nullif(payload->>'type',''), 'merit');
  if v_year is null or v_tgt is null then raise exception 'academic_year and target section required'; end if;
  if payload->'students' is null or jsonb_array_length(payload->'students') = 0 then
    raise exception 'no students selected'; end if;

  select coalesce(max(roll_no), 0) into v_base_roll
    from public.student_enrollment where class_section_id = v_tgt and deleted_at is null;

  insert into public.migration_batch(
    institution_id, academic_year_id, source_class_section_id, target_class_section_id, type, status, created_by)
  values (v_inst, v_year, v_src, v_tgt, v_type, 'completed', (select auth.uid()))
  returning id into v_batch;

  -- `ord` preserves the payload's array order — the client already sorted it
  -- (by merit rank or by hand), so this is the same order the loop consumed.
  create temp table mig_items on commit drop as
  select (elem->>'student_id')::uuid            as student_id,
         nullif(elem->>'source_enrollment_id','')::uuid as source_enrollment_id,
         nullif(elem->>'merit_rank','')::int     as merit_rank,
         nullif(elem->>'result','')              as result,
         ord::int                                as ord,
         se.roll_no                              as old_roll
  from jsonb_array_elements(payload->'students') with ordinality as t(elem, ord)
  left join public.student_enrollment se
    on se.id = nullif(t.elem->>'source_enrollment_id','')::uuid;

  -- Close out the source enrolments (a student promoted from no prior
  -- enrolment — e.g. a fresh admission slotted into the batch — has none).
  update public.student_enrollment se set status = 'promoted', deleted_at = now()
    from mig_items m
    where se.id = m.source_enrollment_id and se.institution_id = v_inst;

  insert into public.student_enrollment(
    institution_id, student_id, academic_year_id, class_section_id, roll_no, status, promoted_from_id)
  select v_inst, m.student_id, v_year, v_tgt, v_base_roll + m.ord, 'active', m.source_enrollment_id
  from mig_items m;

  -- The target rows are found by (class_section_id, roll_no): unique by
  -- `uq_enrollment_roll` and exactly the value each was just inserted with —
  -- a reliable join key without a RETURNING round trip per row.
  update public.student s set
    current_enrollment_id = se.id, updated_by = (select auth.uid()), updated_at = now()
    from mig_items m
    join public.student_enrollment se
      on se.class_section_id = v_tgt and se.academic_year_id = v_year and se.roll_no = v_base_roll + m.ord
    where s.id = m.student_id and s.institution_id = v_inst;

  insert into public.migration_student(
    migration_batch_id, student_id, source_enrollment_id, target_enrollment_id, old_roll, new_roll, merit_rank, result)
  select v_batch, m.student_id, m.source_enrollment_id, se.id, m.old_roll, v_base_roll + m.ord, m.merit_rank, m.result
  from mig_items m
  join public.student_enrollment se
    on se.class_section_id = v_tgt and se.academic_year_id = v_year and se.roll_no = v_base_roll + m.ord;

  return v_batch;
end; $function$;
revoke all on function private.fn_run_migration(jsonb) from authenticated, anon, public;

create or replace function private.fn_pushback_migration(p_batch_id uuid) returns integer
 language plpgsql security definer set search_path = '' as $function$
declare v_inst uuid; v_owner uuid; v_count int;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  select institution_id into v_owner from public.migration_batch where id = p_batch_id;
  if v_owner is null or v_owner <> v_inst then raise exception 'batch not found in institution'; end if;

  update public.student_enrollment se set status = 'dropped', deleted_at = now()
    from public.migration_student ms
    where ms.migration_batch_id = p_batch_id
      and se.id = ms.target_enrollment_id and se.institution_id = v_inst;

  update public.student_enrollment se set status = 'active', deleted_at = null
    from public.migration_student ms
    where ms.migration_batch_id = p_batch_id
      and se.id = ms.source_enrollment_id and se.institution_id = v_inst;

  update public.student s set
    current_enrollment_id = ms.source_enrollment_id, updated_by = (select auth.uid()), updated_at = now()
    from public.migration_student ms
    where ms.migration_batch_id = p_batch_id
      and s.id = ms.student_id and s.institution_id = v_inst;

  select count(*) into v_count from public.migration_student where migration_batch_id = p_batch_id;

  update public.migration_batch set status = 'reverted' where id = p_batch_id;
  return v_count;
end; $function$;
revoke all on function private.fn_pushback_migration(uuid) from authenticated, anon, public;

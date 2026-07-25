create or replace function public.fn_pushback_migration(p_batch_id uuid)
returns int language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_owner uuid; v_rec record; v_count int := 0;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  select institution_id into v_owner from public.migration_batch where id = p_batch_id;
  if v_owner is null or v_owner <> v_inst then raise exception 'batch not found in institution'; end if;

  for v_rec in select * from public.migration_student where migration_batch_id = p_batch_id loop
    if v_rec.target_enrollment_id is not null then
      update public.student_enrollment set status='dropped', deleted_at=now()
        where id = v_rec.target_enrollment_id and institution_id = v_inst;
    end if;
    if v_rec.source_enrollment_id is not null then
      update public.student_enrollment set status='active', deleted_at=null
        where id = v_rec.source_enrollment_id and institution_id = v_inst;
    end if;
    update public.student set current_enrollment_id = v_rec.source_enrollment_id,
      updated_by=(select auth.uid()), updated_at=now()
      where id = v_rec.student_id and institution_id = v_inst;
    v_count := v_count + 1;
  end loop;

  update public.migration_batch set status='reverted' where id = p_batch_id;
  return v_count;
end; $fn$;
revoke execute on function public.fn_pushback_migration(uuid) from public, anon;
grant execute on function public.fn_pushback_migration(uuid) to authenticated, service_role;

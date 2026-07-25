
create or replace function public.fn_upsert_class_section(payload jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_inst uuid; v_id uuid; v_year uuid; v_section uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select id into v_year from public.academic_year where institution_id = v_inst and is_current = true limit 1;

  v_section := nullif(payload->>'section_id','')::uuid;
  if v_section is null and nullif(payload->>'section_name','') is not null then
    insert into public.section(institution_id, name) values (v_inst, payload->>'section_name') returning id into v_section;
  end if;

  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.class_section(institution_id, class_id, section_id, academic_year_id, capacity, class_teacher_id)
    values (v_inst, (payload->>'class_id')::uuid, v_section, v_year,
      nullif(payload->>'capacity','')::int, nullif(payload->>'class_teacher_id','')::uuid)
    returning id into v_id;
  else
    update public.class_section set
      capacity = nullif(payload->>'capacity','')::int,
      class_teacher_id = nullif(payload->>'class_teacher_id','')::uuid
    where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $function$;

create or replace function public.fn_delete_class_section(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  update public.class_section set deleted_at = now()
  where id = p_id and institution_id = private.current_institution_id();
end; $function$;

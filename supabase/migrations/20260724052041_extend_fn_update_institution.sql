
create or replace function public.fn_update_institution(payload jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_inst uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  update public.institution set
    name_bn = coalesce(nullif(payload->>'name_bn',''), name_bn),
    name_en = coalesce(nullif(payload->>'name_en',''), name_en),
    eiin = nullif(payload->>'eiin',''),
    institution_type = nullif(payload->>'institution_type',''),
    address = nullif(payload->>'address',''),
    phone = nullif(payload->>'phone',''),
    email = nullif(payload->>'email',''),
    website = nullif(payload->>'website',''),
    established_year = nullif(payload->>'established_year','')::int,
    board_id = nullif(payload->>'board_id','')::uuid,
    head_teacher_id = nullif(payload->>'head_teacher_id','')::uuid,
    logo_file_id = coalesce(nullif(payload->>'logo_file_id','')::uuid, logo_file_id),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(payload->'metadata', '{}'::jsonb),
    updated_at = now()
  where id = v_inst;
end; $function$;

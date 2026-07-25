
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
    eiin = case when payload ? 'eiin' then nullif(payload->>'eiin','') else eiin end,
    institution_type = case when payload ? 'institution_type' then nullif(payload->>'institution_type','') else institution_type end,
    address = case when payload ? 'address' then nullif(payload->>'address','') else address end,
    phone = case when payload ? 'phone' then nullif(payload->>'phone','') else phone end,
    email = case when payload ? 'email' then nullif(payload->>'email','') else email end,
    website = case when payload ? 'website' then nullif(payload->>'website','') else website end,
    established_year = case when payload ? 'established_year' then nullif(payload->>'established_year','')::int else established_year end,
    board_id = case when payload ? 'board_id' then nullif(payload->>'board_id','')::uuid else board_id end,
    head_teacher_id = case when payload ? 'head_teacher_id' then nullif(payload->>'head_teacher_id','')::uuid else head_teacher_id end,
    logo_file_id = coalesce(nullif(payload->>'logo_file_id','')::uuid, logo_file_id),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(payload->'metadata', '{}'::jsonb),
    updated_at = now()
  where id = v_inst;
end; $function$;

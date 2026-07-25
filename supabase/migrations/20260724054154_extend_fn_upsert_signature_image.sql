
create or replace function public.fn_upsert_signature(payload jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.signature(institution_id, role_label, holder_name, image_file_id)
    values (v_inst, coalesce(nullif(payload->>'role_label',''),'Signatory'), nullif(payload->>'holder_name',''), nullif(payload->>'image_file_id','')::uuid)
    returning id into v_id;
  else
    update public.signature set
      role_label = coalesce(nullif(payload->>'role_label',''), role_label),
      holder_name = case when payload ? 'holder_name' then nullif(payload->>'holder_name','') else holder_name end,
      image_file_id = case when payload ? 'image_file_id' then nullif(payload->>'image_file_id','')::uuid else image_file_id end
    where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $function$;

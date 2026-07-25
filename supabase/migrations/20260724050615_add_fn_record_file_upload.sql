
create or replace function public.fn_record_file_upload(payload jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  insert into public.file_object(institution_id, bucket, path, mime, size_bytes, entity, entity_id, uploaded_by)
  values (v_inst, payload->>'bucket', payload->>'path', nullif(payload->>'mime',''),
    nullif(payload->>'size_bytes','')::bigint, nullif(payload->>'entity',''), nullif(payload->>'entity_id','')::uuid,
    (select auth.uid()))
  returning id into v_id;
  return v_id;
end; $function$;

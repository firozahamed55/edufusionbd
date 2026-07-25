
alter table public.subject
  add column if not exists min_class_level integer,
  add column if not exists max_class_level integer,
  add column if not exists status text not null default 'active';

create or replace function public.fn_upsert_subject(payload jsonb)
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
    insert into public.subject(institution_id, name_bn, name_en, code, type, full_marks, pass_marks, min_class_level, max_class_level, status)
    values (v_inst, coalesce(nullif(payload->>'name_bn',''),'Subject'), coalesce(nullif(payload->>'name_en',''),'Subject'),
      nullif(payload->>'code',''), coalesce(nullif(payload->>'type',''),'compulsory'),
      nullif(payload->>'full_marks','')::numeric, nullif(payload->>'pass_marks','')::numeric,
      nullif(payload->>'min_class_level','')::integer, nullif(payload->>'max_class_level','')::integer,
      coalesce(nullif(payload->>'status',''),'active'))
    returning id into v_id;
  else
    update public.subject set name_bn = coalesce(nullif(payload->>'name_bn',''), name_bn),
      name_en = coalesce(nullif(payload->>'name_en',''), name_en), code = nullif(payload->>'code',''),
      type = coalesce(nullif(payload->>'type',''), type),
      full_marks = nullif(payload->>'full_marks','')::numeric, pass_marks = nullif(payload->>'pass_marks','')::numeric,
      min_class_level = nullif(payload->>'min_class_level','')::integer,
      max_class_level = nullif(payload->>'max_class_level','')::integer,
      status = coalesce(nullif(payload->>'status',''), status)
    where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $function$;

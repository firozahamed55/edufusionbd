-- Phase 6 Core Settings: institution, class, subject, subject-group, grading, signature.

create or replace function public.fn_update_institution(payload jsonb)
returns void language plpgsql security definer set search_path to '' as $fn$
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
    updated_at = now()
  where id = v_inst;
end; $fn$;

create or replace function public.fn_upsert_class(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.class(institution_id, name_bn, name_en, numeric_level, grade_scheme_id)
    values (v_inst, coalesce(nullif(payload->>'name_bn',''),'Class'), coalesce(nullif(payload->>'name_en',''),'Class'),
      nullif(payload->>'numeric_level','')::int, nullif(payload->>'grade_scheme_id','')::uuid)
    returning id into v_id;
  else
    update public.class set name_bn = coalesce(nullif(payload->>'name_bn',''), name_bn),
      name_en = coalesce(nullif(payload->>'name_en',''), name_en),
      numeric_level = nullif(payload->>'numeric_level','')::int,
      grade_scheme_id = nullif(payload->>'grade_scheme_id','')::uuid
    where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $fn$;
create or replace function public.fn_delete_class(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; begin v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  update public.class set deleted_at = now() where id = p_id and institution_id = v_inst; end; $fn$;

create or replace function public.fn_upsert_subject(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.subject(institution_id, name_bn, name_en, code, type, full_marks, pass_marks)
    values (v_inst, coalesce(nullif(payload->>'name_bn',''),'Subject'), coalesce(nullif(payload->>'name_en',''),'Subject'),
      nullif(payload->>'code',''), coalesce(nullif(payload->>'type',''),'compulsory'),
      nullif(payload->>'full_marks','')::numeric, nullif(payload->>'pass_marks','')::numeric)
    returning id into v_id;
  else
    update public.subject set name_bn = coalesce(nullif(payload->>'name_bn',''), name_bn),
      name_en = coalesce(nullif(payload->>'name_en',''), name_en), code = nullif(payload->>'code',''),
      type = coalesce(nullif(payload->>'type',''), type),
      full_marks = nullif(payload->>'full_marks','')::numeric, pass_marks = nullif(payload->>'pass_marks','')::numeric
    where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $fn$;
create or replace function public.fn_delete_subject(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; begin v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  update public.subject set deleted_at = now() where id = p_id and institution_id = v_inst; end; $fn$;

create or replace function public.fn_upsert_subject_group(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid; v_sub jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.subject_group(institution_id, name) values (v_inst, coalesce(nullif(payload->>'name',''),'Group')) returning id into v_id;
  else
    update public.subject_group set name = coalesce(nullif(payload->>'name',''), name) where id = v_id and institution_id = v_inst;
  end if;
  if payload ? 'subject_ids' then
    delete from public.subject_group_member where subject_group_id = v_id;
    for v_sub in select value from jsonb_array_elements(payload->'subject_ids') loop
      insert into public.subject_group_member(subject_group_id, subject_id) values (v_id, (v_sub #>> '{}')::uuid) on conflict do nothing;
    end loop;
  end if;
  return v_id;
end; $fn$;
create or replace function public.fn_delete_subject_group(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; begin v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  delete from public.subject_group where id = p_id and institution_id = v_inst; end; $fn$;

create or replace function public.fn_upsert_grade_scheme(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid; v_row jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.grade_scheme(institution_id, name, is_default) values (v_inst, coalesce(nullif(payload->>'name',''),'Scheme'), coalesce((payload->>'is_default')::boolean, false)) returning id into v_id;
  else
    update public.grade_scheme set name = coalesce(nullif(payload->>'name',''), name), is_default = coalesce((payload->>'is_default')::boolean, is_default) where id = v_id and institution_id = v_inst;
  end if;
  if payload ? 'scales' then
    delete from public.grade_scale where grade_scheme_id = v_id;
    for v_row in select value from jsonb_array_elements(payload->'scales') loop
      insert into public.grade_scale(grade_scheme_id, grade_letter, gpa_point, min_marks, max_marks)
      values (v_id, coalesce(nullif(v_row->>'grade_letter',''),'F'), coalesce(nullif(v_row->>'gpa_point','')::numeric,0),
        coalesce(nullif(v_row->>'min_marks','')::numeric,0), coalesce(nullif(v_row->>'max_marks','')::numeric,100));
    end loop;
  end if;
  return v_id;
end; $fn$;
create or replace function public.fn_delete_grade_scheme(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; begin v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  update public.grade_scheme set deleted_at = now() where id = p_id and institution_id = v_inst; end; $fn$;

create or replace function public.fn_upsert_signature(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.signature(institution_id, role_label, holder_name) values (v_inst, coalesce(nullif(payload->>'role_label',''),'Signatory'), nullif(payload->>'holder_name','')) returning id into v_id;
  else
    update public.signature set role_label = coalesce(nullif(payload->>'role_label',''), role_label), holder_name = nullif(payload->>'holder_name','') where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $fn$;
create or replace function public.fn_delete_signature(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; begin v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  delete from public.signature where id = p_id and institution_id = v_inst; end; $fn$;

do $$
declare fn text;
begin
  for fn in select unnest(array[
    'fn_update_institution(jsonb)','fn_upsert_class(jsonb)','fn_delete_class(uuid)','fn_upsert_subject(jsonb)','fn_delete_subject(uuid)',
    'fn_upsert_subject_group(jsonb)','fn_delete_subject_group(uuid)','fn_upsert_grade_scheme(jsonb)','fn_delete_grade_scheme(uuid)',
    'fn_upsert_signature(jsonb)','fn_delete_signature(uuid)'])
  loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

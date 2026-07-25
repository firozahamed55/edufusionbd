-- Phase 6 Certificate module: templates, batches, testimonial/transfer records + generic settings.

create or replace function public.fn_upsert_certificate_template(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.certificate_template(institution_id, type, format_config, is_default)
    values (v_inst, coalesce(nullif(payload->>'type',''),'id'), coalesce(payload->'format_config','{}'::jsonb), coalesce((payload->>'is_default')::boolean, false))
    returning id into v_id;
  else
    update public.certificate_template set
      type = coalesce(nullif(payload->>'type',''), type),
      format_config = coalesce(payload->'format_config', format_config),
      is_default = coalesce((payload->>'is_default')::boolean, is_default)
    where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $fn$;

create or replace function public.fn_delete_certificate_template(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  delete from public.certificate_template where id = p_id and institution_id = v_inst;
end; $fn$;

create or replace function public.fn_create_id_card_batch(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  insert into public.id_card_batch(institution_id, class_id, section_id, roll_from, roll_to, template, class_color, valid_till, includes)
  values (v_inst, nullif(payload->>'class_id','')::uuid, nullif(payload->>'section_id','')::uuid,
    nullif(payload->>'roll_from','')::int, nullif(payload->>'roll_to','')::int,
    nullif(payload->>'template',''), nullif(payload->>'class_color',''), nullif(payload->>'valid_till','')::date,
    coalesce(payload->'includes','{}'::jsonb))
  returning id into v_id;
  return v_id;
end; $fn$;

create or replace function public.fn_create_admit_batch(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  insert into public.admit_card_batch(institution_id, exam_id, class_id, section_id, roll_from, roll_to, center, issue_date, includes)
  values (v_inst, nullif(payload->>'exam_id','')::uuid, nullif(payload->>'class_id','')::uuid, nullif(payload->>'section_id','')::uuid,
    nullif(payload->>'roll_from','')::int, nullif(payload->>'roll_to','')::int,
    nullif(payload->>'center',''), nullif(payload->>'issue_date','')::date, coalesce(payload->'includes','{}'::jsonb))
  returning id into v_id;
  return v_id;
end; $fn$;

create or replace function public.fn_create_testimonial(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  if nullif(payload->>'student_id','') is null then raise exception 'student required'; end if;
  insert into public.testimonial(institution_id, student_id, session, conduct, cert_no, parent_name, permanent_address, language, remarks, issued_at)
  values (v_inst, (payload->>'student_id')::uuid, nullif(payload->>'session',''), nullif(payload->>'conduct',''),
    nullif(payload->>'cert_no',''), nullif(payload->>'parent_name',''), nullif(payload->>'permanent_address',''),
    nullif(payload->>'language','')::public.app_language, nullif(payload->>'remarks',''), now())
  returning id into v_id;
  return v_id;
end; $fn$;

create or replace function public.fn_create_transfer(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  if nullif(payload->>'student_id','') is null then raise exception 'student required'; end if;
  insert into public.transfer_certificate(institution_id, student_id, session, issue_date, cert_type, cert_no, parent_name, permanent_address, reason, language)
  values (v_inst, (payload->>'student_id')::uuid, nullif(payload->>'session',''), nullif(payload->>'issue_date','')::date,
    nullif(payload->>'cert_type',''), nullif(payload->>'cert_no',''), nullif(payload->>'parent_name',''),
    nullif(payload->>'permanent_address',''), nullif(payload->>'reason',''), nullif(payload->>'language','')::public.app_language)
  returning id into v_id;
  return v_id;
end; $fn$;

-- Generic institution setting upsert (used by admit-instruction, exam-essentials, core startup, etc.).
create or replace function public.fn_save_setting(p_key text, p_scope text, p_value jsonb)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  insert into public.setting(institution_id, key, scope, value, updated_at)
  values (v_inst, p_key, coalesce(p_scope,'general'), coalesce(p_value,'{}'::jsonb), now())
  on conflict (institution_id, key, scope) do update set value = excluded.value, updated_at = now();
end; $fn$;

revoke execute on function public.fn_upsert_certificate_template(jsonb) from public, anon;
revoke execute on function public.fn_delete_certificate_template(uuid) from public, anon;
revoke execute on function public.fn_create_id_card_batch(jsonb) from public, anon;
revoke execute on function public.fn_create_admit_batch(jsonb) from public, anon;
revoke execute on function public.fn_create_testimonial(jsonb) from public, anon;
revoke execute on function public.fn_create_transfer(jsonb) from public, anon;
revoke execute on function public.fn_save_setting(text, text, jsonb) from public, anon;
grant execute on function public.fn_upsert_certificate_template(jsonb) to authenticated, service_role;
grant execute on function public.fn_delete_certificate_template(uuid) to authenticated, service_role;
grant execute on function public.fn_create_id_card_batch(jsonb) to authenticated, service_role;
grant execute on function public.fn_create_admit_batch(jsonb) to authenticated, service_role;
grant execute on function public.fn_create_testimonial(jsonb) to authenticated, service_role;
grant execute on function public.fn_create_transfer(jsonb) to authenticated, service_role;
grant execute on function public.fn_save_setting(text, text, jsonb) to authenticated, service_role;

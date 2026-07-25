-- Phase 6 SMS & Notice: send campaign, template CRUD, package purchase, notice CRUD.

create or replace function public.fn_send_sms_campaign(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid; v_count int; v_acct uuid; v_rate numeric;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_count := coalesce(nullif(payload->>'recipient_count','')::int, 0);
  select id, per_sms_rate into v_acct, v_rate from public.sms_account where institution_id = v_inst limit 1;

  insert into public.sms_campaign(institution_id, recipient_type, recipient_group, language, template_id, body, recipient_count, est_cost, sent_by, sent_at)
  values (v_inst, coalesce(nullif(payload->>'recipient_type',''),'parent'), nullif(payload->>'recipient_group',''),
    nullif(payload->>'language','')::public.app_language, nullif(payload->>'template_id','')::uuid, nullif(payload->>'body',''),
    v_count, v_count * coalesce(v_rate, 0.5), (select auth.uid()), now())
  returning id into v_id;

  -- debit the SMS balance (credits) for the recipients (simulated send).
  if v_acct is not null and v_count > 0 then
    update public.sms_account set balance = greatest(balance - v_count, 0) where id = v_acct;
  end if;
  return v_id;
end; $fn$;

create or replace function public.fn_upsert_sms_template(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.sms_template(institution_id, name, description, body, category)
    values (v_inst, coalesce(nullif(payload->>'name',''),'Untitled'), nullif(payload->>'description',''),
      coalesce(nullif(payload->>'body',''),''), nullif(payload->>'category',''))
    returning id into v_id;
  else
    update public.sms_template set
      name = coalesce(nullif(payload->>'name',''), name),
      description = nullif(payload->>'description',''),
      body = coalesce(nullif(payload->>'body',''), body),
      category = nullif(payload->>'category','')
    where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $fn$;

create or replace function public.fn_delete_sms_template(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  update public.sms_template set deleted_at = now() where id = p_id and institution_id = v_inst;
end; $fn$;

create or replace function public.fn_purchase_sms_package(p_package_id uuid)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_acct uuid; v_qty int; v_price numeric; v_txn uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  select sms_qty, price into v_qty, v_price from public.sms_package where id = p_package_id and is_active;
  if v_qty is null then raise exception 'package not found'; end if;
  select id into v_acct from public.sms_account where institution_id = v_inst limit 1;
  if v_acct is null then
    insert into public.sms_account(institution_id, balance, per_sms_rate, masking_enabled) values (v_inst, 0, 0.5, false) returning id into v_acct;
  end if;

  insert into public.sms_transaction(institution_id, sms_account_id, sms_package_id, amount, sms_added, at)
  values (v_inst, v_acct, p_package_id, v_price, v_qty, now()) returning id into v_txn;

  update public.sms_account set balance = balance + v_qty, last_recharge_amount = v_price, last_recharge_at = now() where id = v_acct;
  return v_txn;
end; $fn$;

create or replace function public.fn_upsert_notice(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.notice(institution_id, title, body, audience, event_date, status, created_by)
    values (v_inst, coalesce(nullif(payload->>'title',''),'Untitled'), nullif(payload->>'body',''),
      nullif(payload->>'audience',''), nullif(payload->>'event_date','')::date, coalesce(nullif(payload->>'status',''),'published'), (select auth.uid()))
    returning id into v_id;
  else
    update public.notice set
      title = coalesce(nullif(payload->>'title',''), title),
      body = nullif(payload->>'body',''),
      audience = nullif(payload->>'audience',''),
      event_date = nullif(payload->>'event_date','')::date,
      status = coalesce(nullif(payload->>'status',''), status)
    where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $fn$;

create or replace function public.fn_delete_notice(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  update public.notice set is_archived = true where id = p_id and institution_id = v_inst;
end; $fn$;

revoke execute on function public.fn_send_sms_campaign(jsonb) from public, anon;
revoke execute on function public.fn_upsert_sms_template(jsonb) from public, anon;
revoke execute on function public.fn_delete_sms_template(uuid) from public, anon;
revoke execute on function public.fn_purchase_sms_package(uuid) from public, anon;
revoke execute on function public.fn_upsert_notice(jsonb) from public, anon;
revoke execute on function public.fn_delete_notice(uuid) from public, anon;
grant execute on function public.fn_send_sms_campaign(jsonb) to authenticated, service_role;
grant execute on function public.fn_upsert_sms_template(jsonb) to authenticated, service_role;
grant execute on function public.fn_delete_sms_template(uuid) to authenticated, service_role;
grant execute on function public.fn_purchase_sms_package(uuid) to authenticated, service_role;
grant execute on function public.fn_upsert_notice(jsonb) to authenticated, service_role;
grant execute on function public.fn_delete_notice(uuid) to authenticated, service_role;

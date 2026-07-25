-- Phase 6 Fee module: collection (payment+invoice+ledger), delete, mapping CRUD, reports.

-- 1) Collect a fee payment against an invoice (transaction-safe: payment + invoice + ledger).
create or replace function public.fn_collect_fee(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_inv public.fee_invoice; v_amt numeric; v_pay uuid; v_new_paid numeric; v_status text; v_acct uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select * into v_inv from public.fee_invoice
    where id = nullif(payload->>'fee_invoice_id','')::uuid and deleted_at is null;
  if v_inv.id is null or v_inv.institution_id <> v_inst then raise exception 'invoice not found in institution'; end if;

  v_amt := coalesce(nullif(payload->>'amount','')::numeric, 0);
  if v_amt <= 0 then raise exception 'amount must be positive'; end if;
  -- never over-collect beyond the remaining due
  if v_inv.paid_amount + v_inv.waiver_amount + v_amt > v_inv.total_amount then
    v_amt := v_inv.total_amount - v_inv.paid_amount - v_inv.waiver_amount;
  end if;
  if v_amt <= 0 then raise exception 'invoice already settled'; end if;

  v_acct := nullif(payload->>'account_id','')::uuid;
  insert into public.fee_payment(institution_id, fee_invoice_id, student_id, amount, method, account_id, txn_ref, paid_by, received_by, paid_at)
  values (v_inst, v_inv.id, v_inv.student_id, v_amt,
    coalesce(nullif(payload->>'method',''),'cash'), v_acct, nullif(payload->>'txn_ref',''),
    nullif(payload->>'paid_by',''), (select auth.uid()),
    coalesce(nullif(payload->>'paid_at','')::timestamptz, now()))
  returning id into v_pay;

  v_new_paid := v_inv.paid_amount + v_amt;
  v_status := case when v_new_paid + v_inv.waiver_amount >= v_inv.total_amount then 'paid'
                   when v_new_paid > 0 then 'partial' else 'due' end;
  update public.fee_invoice set paid_amount = v_new_paid, status = v_status, updated_at = now() where id = v_inv.id;

  insert into public.ledger_entry(institution_id, account_id, entry_date, direction, amount, source_type, source_id, head, note)
  values (v_inst, v_acct, current_date, 'credit'::public.ledger_direction, v_amt, 'fee_payment', v_pay, 'Fee collection', nullif(payload->>'note',''));

  return v_pay;
end; $fn$;

-- 2) Soft-delete (void) selected invoices.
create or replace function public.fn_delete_fee_invoice(payload jsonb)
returns int language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_ids uuid[]; v_count int;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(coalesce(payload->'ids','[]'::jsonb)) as x;
  if v_ids is null then return 0; end if;
  update public.fee_invoice set deleted_at = now(), status = 'void', updated_at = now()
    where id = any(v_ids) and institution_id = v_inst and deleted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end; $fn$;

-- 3) Upsert a fee mapping.
create or replace function public.fn_upsert_fee_mapping(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  v_id := nullif(payload->>'id','')::uuid;
  if v_id is null then
    insert into public.fee_mapping(institution_id, class_id, fee_head_id, student_category_id, amount, frequency, is_active)
    values (v_inst, nullif(payload->>'class_id','')::uuid, nullif(payload->>'fee_head_id','')::uuid,
      nullif(payload->>'student_category_id','')::uuid, coalesce(nullif(payload->>'amount','')::numeric, 0),
      coalesce(nullif(payload->>'frequency',''), 'monthly'), coalesce((payload->>'is_active')::boolean, true))
    returning id into v_id;
  else
    update public.fee_mapping set
      class_id = coalesce(nullif(payload->>'class_id','')::uuid, class_id),
      fee_head_id = coalesce(nullif(payload->>'fee_head_id','')::uuid, fee_head_id),
      student_category_id = nullif(payload->>'student_category_id','')::uuid,
      amount = coalesce(nullif(payload->>'amount','')::numeric, amount),
      frequency = coalesce(nullif(payload->>'frequency',''), frequency),
      is_active = coalesce((payload->>'is_active')::boolean, is_active)
    where id = v_id and institution_id = v_inst;
  end if;
  return v_id;
end; $fn$;

-- 4) Delete a fee mapping.
create or replace function public.fn_delete_fee_mapping(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  delete from public.fee_mapping where id = p_id and institution_id = v_inst;
end; $fn$;

-- 5) Institute-wide dues summary (class/section-wise).
create or replace function public.fn_unpaid_by_institute()
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_result jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  with r as (
    select c.numeric_level, c.name_bn cls_bn, c.name_en cls_en, sec.name sec_name,
      count(distinct se.student_id) total_students,
      count(distinct case when coalesce(fi.due_amount,0) > 0 then fi.student_id end) due_students,
      coalesce(sum(case when coalesce(fi.due_amount,0) > 0 then fi.due_amount else 0 end), 0) due_amount
    from public.class_section cs
    join public.class c on c.id = cs.class_id and c.institution_id = v_inst
    left join public.section sec on sec.id = cs.section_id
    join public.student_enrollment se on se.class_section_id = cs.id and se.deleted_at is null and se.status = 'active'
    left join public.fee_invoice fi on fi.student_id = se.student_id and fi.academic_year_id = se.academic_year_id and fi.deleted_at is null
    where cs.deleted_at is null
    group by c.numeric_level, c.name_bn, c.name_en, sec.name
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(to_jsonb(r) order by r.numeric_level), '[]'::jsonb),
    'total_students', (select coalesce(sum(total_students),0) from r),
    'due_students', (select coalesce(sum(due_students),0) from r),
    'total_due', (select coalesce(sum(due_amount),0) from r)
  ) into v_result from r;
  return v_result;
end; $fn$;

-- 6) Income statement over a date range (collections attributed to fee heads).
create or replace function public.fn_fee_income_statement(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_result jsonb;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  with pay as (
    select fp.amount pay_amt, fp.fee_invoice_id, fi.total_amount
    from public.fee_payment fp
    join public.fee_invoice fi on fi.id = fp.fee_invoice_id
    where fp.institution_id = v_inst and fp.paid_at::date between p_from and p_to
  ),
  income as (
    select fh.name head, sum(pay.pay_amt * (fil.amount / nullif(pay.total_amount, 0))) amt
    from pay
    join public.fee_invoice_line fil on fil.fee_invoice_id = pay.fee_invoice_id
    join public.fee_head fh on fh.id = fil.fee_head_id
    group by fh.name
  ),
  expense as (
    select coalesce(le.head, 'Other') head, sum(le.amount) amt
    from public.ledger_entry le
    where le.institution_id = v_inst and le.direction = 'debit'::public.ledger_direction
      and le.entry_date between p_from and p_to
    group by le.head
  )
  select jsonb_build_object(
    'income', (select coalesce(jsonb_agg(jsonb_build_object('head', head, 'amount', round(amt, 2)) order by amt desc), '[]'::jsonb) from income where amt is not null),
    'total_income', (select coalesce(round(sum(amt), 2), 0) from income),
    'expense', (select coalesce(jsonb_agg(jsonb_build_object('head', head, 'amount', round(amt, 2)) order by amt desc), '[]'::jsonb) from expense),
    'total_expense', (select coalesce(round(sum(amt), 2), 0) from expense)
  ) into v_result;
  return v_result;
end; $fn$;

revoke execute on function public.fn_collect_fee(jsonb) from public, anon;
revoke execute on function public.fn_delete_fee_invoice(jsonb) from public, anon;
revoke execute on function public.fn_upsert_fee_mapping(jsonb) from public, anon;
revoke execute on function public.fn_delete_fee_mapping(uuid) from public, anon;
revoke execute on function public.fn_unpaid_by_institute() from public, anon;
revoke execute on function public.fn_fee_income_statement(date, date) from public, anon;
grant execute on function public.fn_collect_fee(jsonb) to authenticated, service_role;
grant execute on function public.fn_delete_fee_invoice(jsonb) to authenticated, service_role;
grant execute on function public.fn_upsert_fee_mapping(jsonb) to authenticated, service_role;
grant execute on function public.fn_delete_fee_mapping(uuid) to authenticated, service_role;
grant execute on function public.fn_unpaid_by_institute() to authenticated, service_role;
grant execute on function public.fn_fee_income_statement(date, date) to authenticated, service_role;

-- ===================== RLS tenancy helpers (private) =====================
create or replace function private.current_institution_id() returns uuid
  language sql stable security definer set search_path = '' as $$
  select institution_id from public.profile where id = (select auth.uid())
$$;

create or replace function private.is_platform_admin() returns boolean
  language sql stable security definer set search_path = '' as $$
  select coalesce((select is_platform_admin from public.profile where id = (select auth.uid())), false)
$$;

create or replace function private.has_role(role_code text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_role ur join public.role r on r.id = ur.role_id
    where ur.profile_id = (select auth.uid()) and r.code = role_code
  )
$$;

create or replace function private.can_access_class_section(cs_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin()
      or private.has_role('institution_admin')
      or exists (select 1 from public.teacher_assignment ta
                 join public.profile p on p.linked_teacher_id = ta.teacher_id
                 where p.id = (select auth.uid()) and ta.class_section_id = cs_id)
      or exists (select 1 from public.class_section cs
                 join public.profile p on p.linked_teacher_id = cs.class_teacher_id
                 where p.id = (select auth.uid()) and cs.id = cs_id)
$$;

-- Policies (run as authenticated) must be able to call the helpers.
-- The `private` schema is NOT in PostgREST's exposed schemas, so this stays off-API.
grant usage on schema private to authenticated;
grant execute on function private.current_institution_id() to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.has_role(text) to authenticated;
grant execute on function private.can_access_class_section(uuid) to authenticated;

-- ===================== updated_at touch triggers =====================
do $$
declare t text;
begin
  foreach t in array array['institution','subscription','profile','teacher','class_section',
                           'student','guardian','exam','mark','exam_result','fee_invoice']
  loop
    execute format('create trigger trg_touch_%1$s before update on public.%1$s
                    for each row execute function private.set_updated_at();', t);
  end loop;
end $$;

-- ===================== generic audit trigger =====================
create or replace function private.audit_trigger() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_inst uuid; v_id uuid;
begin
  if tg_op = 'DELETE' then v_before := to_jsonb(old); v_after := null;
  elsif tg_op = 'UPDATE' then v_before := to_jsonb(old); v_after := to_jsonb(new);
  else v_before := null; v_after := to_jsonb(new); end if;
  v_inst := coalesce(v_after->>'institution_id', v_before->>'institution_id')::uuid;
  v_id   := coalesce(v_after->>'id', v_before->>'id')::uuid;
  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, before, after)
  values (v_inst, tg_table_name, v_id, lower(tg_op), auth.uid(), v_before, v_after);
  return coalesce(new, old);
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['mark','exam_result','fee_invoice','student_enrollment','migration_batch','setting']
  loop
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function private.audit_trigger();', t);
  end loop;
end $$;

-- ===================== fee reconciliation (C7 / M4 / R5) =====================
create or replace function private.recompute_fee_invoice(p_invoice uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare v_total numeric(12,2); v_waiver numeric(12,2); v_paid numeric(12,2);
begin
  select coalesce(sum(amount),0), coalesce(sum(waiver),0) into v_total, v_waiver
    from public.fee_invoice_line where fee_invoice_id = p_invoice;
  select coalesce(sum(amount),0) into v_paid
    from public.fee_payment where fee_invoice_id = p_invoice;
  update public.fee_invoice set
    total_amount = v_total, waiver_amount = v_waiver, paid_amount = v_paid,
    status = case when v_total = 0 then 'due'
                  when v_paid + v_waiver >= v_total then 'paid'
                  when v_paid > 0 then 'partial' else 'due' end,
    updated_at = now()
  where id = p_invoice and status <> 'void';
end;
$$;

create or replace function private.fee_invoice_line_trg() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  perform private.recompute_fee_invoice(coalesce(new.fee_invoice_id, old.fee_invoice_id));
  return coalesce(new, old);
end;
$$;
create trigger trg_fee_invoice_line after insert or update or delete on public.fee_invoice_line
  for each row execute function private.fee_invoice_line_trg();

create or replace function private.fee_payment_trg() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  perform private.recompute_fee_invoice(coalesce(new.fee_invoice_id, old.fee_invoice_id));
  if tg_op = 'INSERT' then
    insert into public.ledger_entry(institution_id, account_id, entry_date, direction, amount, source_type, source_id, head, note)
    values (new.institution_id, new.account_id, current_date, 'credit', new.amount, 'fee_payment', new.id, 'Fee Collection', new.method);
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_fee_payment after insert or update or delete on public.fee_payment
  for each row execute function private.fee_payment_trg();

-- ===================== mark bounds (M6 cross-table) =====================
create or replace function private.mark_bounds_trg() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare v_full numeric(6,2);
begin
  if new.marks_obtained is null then return new; end if;
  select coalesce(es.full_marks, cs.full_marks, s.full_marks) into v_full
  from public.exam_subject es
  join public.subject s on s.id = es.subject_id
  left join public.class_subject cs on cs.class_id = es.class_id and cs.subject_id = es.subject_id
  where es.id = new.exam_subject_id;
  if v_full is not null and new.marks_obtained > v_full then
    raise exception 'marks_obtained (%) exceeds full_marks (%)', new.marks_obtained, v_full;
  end if;
  return new;
end;
$$;
create trigger trg_mark_bounds before insert or update on public.mark
  for each row execute function private.mark_bounds_trg();

-- ===================== digital txn -> fee_payment reconcile (R5) =====================
create or replace function private.digital_txn_reconcile_trg() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'success' and old.status is distinct from 'success' and new.fee_invoice_id is not null then
    insert into public.fee_payment(institution_id, fee_invoice_id, student_id, amount, method, txn_ref, paid_at)
    values (new.institution_id, new.fee_invoice_id, new.student_id, new.amount, new.gateway, new.gateway_txn_id, now());
  end if;
  return new;
end;
$$;
create trigger trg_digital_txn_reconcile after update on public.digital_transaction
  for each row execute function private.digital_txn_reconcile_trg();

-- ===================== concurrency-safe code generation (R4) =====================
create or replace function public.fn_generate_code(p_entity text) returns text
  language plpgsql security definer set search_path = '' as $$
declare v_inst uuid; v_next bigint; v_prefix text;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  insert into public.code_sequence(institution_id, entity, next_val) values (v_inst, p_entity, 1)
    on conflict (institution_id, entity) do update set next_val = public.code_sequence.next_val + 1
    returning next_val into v_next;
  v_prefix := case p_entity when 'student' then 'STU' when 'teacher' then 'EMP' else upper(left(p_entity,3)) end;
  return v_prefix || '-' || lpad(v_next::text, 4, '0');
end;
$$;
grant execute on function public.fn_generate_code(text) to authenticated;

-- ===================== exam result processing (§17) =====================
create or replace function public.fn_process_exam_result(p_exam_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare v_inst uuid; v_scheme uuid;
begin
  select institution_id, grade_scheme_id into v_inst, v_scheme from public.exam where id = p_exam_id;
  if v_scheme is null then
    select id into v_scheme from public.grade_scheme where institution_id = v_inst and is_default limit 1;
  end if;

  with base as (
    select m.student_id,
           coalesce(m.marks_obtained,0) as obtained,
           coalesce(es.full_marks, cs.full_marks, s.full_marks, 100) as fullm,
           m.is_absent
    from public.mark m
    join public.exam_subject es on es.id = m.exam_subject_id
    join public.subject s on s.id = es.subject_id
    left join public.class_subject cs on cs.class_id = es.class_id and cs.subject_id = es.subject_id
    where es.exam_id = p_exam_id
  ),
  scored as (
    select b.student_id, b.obtained, b.is_absent,
           (select gsc.gpa_point from public.grade_scale gsc
            where gsc.grade_scheme_id = v_scheme
              and (b.obtained / nullif(b.fullm,0) * 100) between gsc.min_marks and gsc.max_marks
            limit 1) as gp
    from base b
  ),
  agg as (
    select student_id,
           sum(obtained) as total_marks,
           round(avg(coalesce(gp,0)),2) as gpa,
           bool_or(coalesce(gp,0) = 0 or is_absent) as any_fail
    from scored group by student_id
  )
  insert into public.exam_result(institution_id, exam_id, student_id, total_marks, gpa, result, status)
  select v_inst, p_exam_id, student_id, total_marks, gpa,
         case when any_fail then 'fail' else 'pass' end, 'processed'
  from agg
  on conflict (exam_id, student_id) do update
    set total_marks = excluded.total_marks, gpa = excluded.gpa,
        result = excluded.result, status = 'processed', updated_at = now();

  with ranked as (
    select id, rank() over (order by total_marks desc nulls last) as rnk
    from public.exam_result where exam_id = p_exam_id)
  update public.exam_result er set merit_rank = ranked.rnk
  from ranked where er.id = ranked.id;
end;
$$;
grant execute on function public.fn_process_exam_result(uuid) to authenticated;

-- ===================== auth.users -> profile bootstrap (C3) =====================
create or replace function public.handle_new_auth_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profile (id, full_name, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'invited')
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

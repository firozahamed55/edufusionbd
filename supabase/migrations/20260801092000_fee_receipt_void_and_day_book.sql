-- ============================================================================
-- SRA A-6.1 — the four controls that make cash collection auditable.
--
-- "A fee-collection screen that does not produce a receipt is not usable at a
-- cash counter — the parent will not leave without paper, so the clerk keeps a
-- parallel manual book, and the system's ledger and the school's ledger
-- diverge from day one."
--
-- Item 6 (idempotency) landed in Phase 1. This closes the other three:
--   1. a receipt number, minted server-side, on every payment;
--   5. void-with-reason, written as a REVERSING entry, never a delete;
--   8. a day book — per-collector daily totals and a close-of-day lock.
-- ============================================================================

/* -------------------------------------------------------------- receipt no */

alter table public.fee_payment
  add column if not exists receipt_no text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profile(id) on delete set null,
  add column if not exists void_reason text,
  -- Set on the reversing row, pointing at what it reverses. The pair is the
  -- audit trail: two rows that sum to zero, both visible.
  add column if not exists reverses_payment_id uuid references public.fee_payment(id) on delete set null;

create unique index if not exists ux_fee_payment_receipt_no
  on public.fee_payment (institution_id, receipt_no) where receipt_no is not null;

-- Backfill so historical payments are reprintable. Ordered by paid_at, so the
-- numbers run in the order the money was actually taken.
do $$
declare v_inst uuid; v_max bigint;
begin
  for v_inst in select distinct institution_id from public.fee_payment where receipt_no is null loop
    with numbered as (
      select id, row_number() over (order by paid_at, id) as seq
        from public.fee_payment
       where institution_id = v_inst and receipt_no is null
    )
    update public.fee_payment p
       set receipt_no = 'RCP-' || lpad(n.seq::text, 6, '0')
      from numbered n
     where p.id = n.id;

    -- Hand the sequence over at the right place, or the first live collection
    -- mints RCP-000001 again and collides with the unique index.
    select count(*) into v_max from public.fee_payment where institution_id = v_inst;
    insert into public.code_sequence(institution_id, entity, next_val)
    values (v_inst, 'receipt', v_max)
    on conflict (institution_id, entity)
      do update set next_val = greatest(public.code_sequence.next_val, excluded.next_val);
  end loop;
end $$;

create or replace function private.next_receipt_no(p_inst uuid) returns text
language plpgsql security definer set search_path to '' as $fn$
declare v_next bigint;
begin
  insert into public.code_sequence(institution_id, entity, next_val) values (p_inst, 'receipt', 1)
    on conflict (institution_id, entity) do update set next_val = public.code_sequence.next_val + 1
    returning next_val into v_next;
  return 'RCP-' || lpad(v_next::text, 6, '0');
end; $fn$;

/* ------------------------------------------------- collection, with receipt */

create or replace function private.fn_collect_fee(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare
  v_inst uuid;
  v_inv  public.fee_invoice;
  v_amt  numeric;
  v_pay  uuid;
  v_key  uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_key := nullif(payload->>'idempotency_key','')::uuid;

  -- Fast path: this exact attempt already landed (Phase 1, A-6.1 item 6).
  if v_key is not null then
    select id into v_pay from public.fee_payment
     where institution_id = v_inst and idempotency_key = v_key;
    if v_pay is not null then return v_pay; end if;
  end if;

  select * into v_inv from public.fee_invoice
    where id = nullif(payload->>'fee_invoice_id','')::uuid and deleted_at is null;
  if v_inv.id is null or v_inv.institution_id <> v_inst then raise exception 'invoice not found in institution'; end if;

  v_amt := coalesce(nullif(payload->>'amount','')::numeric, 0);
  if v_amt <= 0 then raise exception 'amount must be positive'; end if;
  if v_inv.paid_amount + v_inv.waiver_amount + v_amt > v_inv.total_amount then
    v_amt := v_inv.total_amount - v_inv.paid_amount - v_inv.waiver_amount;
  end if;
  if v_amt <= 0 then raise exception 'invoice already settled'; end if;

  insert into public.fee_payment(institution_id, fee_invoice_id, student_id, amount, method, account_id,
    txn_ref, paid_by, received_by, paid_at, idempotency_key, receipt_no)
  values (v_inst, v_inv.id, v_inv.student_id, v_amt,
    coalesce(nullif(payload->>'method',''),'cash'), nullif(payload->>'account_id','')::uuid, nullif(payload->>'txn_ref',''),
    nullif(payload->>'paid_by',''), (select auth.uid()),
    coalesce(nullif(payload->>'paid_at','')::timestamptz, now()), v_key,
    private.next_receipt_no(v_inst))
  returning id into v_pay;
  return v_pay;

exception when unique_violation then
  select id into v_pay from public.fee_payment
   where institution_id = v_inst and idempotency_key = v_key;
  if v_pay is null then raise; end if;
  return v_pay;
end; $fn$;
revoke all on function private.fn_collect_fee(jsonb) from authenticated, anon, public;

/* ---------------------------------------------------------------- void */

/**
 * Void a payment.
 *
 * NEVER a delete and never an UPDATE of the amount. Both destroy the record
 * that money changed hands, and the parent is holding a receipt that says it
 * did. Instead: mark the original voided and insert a reversing row for the
 * negative amount. The invoice recompute trigger nets them to zero, the ledger
 * carries a matching debit, and both rows print.
 */
create or replace function private.fn_void_fee_payment(p_payment_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_pay public.fee_payment; v_rev uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'a void reason is required'; end if;

  select * into v_pay from public.fee_payment where id = p_payment_id and institution_id = v_inst;
  if v_pay.id is null then raise exception 'payment not found in institution'; end if;
  if v_pay.voided_at is not null then raise exception 'payment already voided'; end if;
  if v_pay.amount < 0 then raise exception 'a reversing entry cannot itself be voided'; end if;

  update public.fee_payment
     set voided_at = now(), voided_by = (select auth.uid()), void_reason = p_reason
   where id = p_payment_id;

  insert into public.fee_payment(institution_id, fee_invoice_id, student_id, amount, method, account_id,
    txn_ref, paid_by, received_by, paid_at, receipt_no, reverses_payment_id, void_reason)
  values (v_inst, v_pay.fee_invoice_id, v_pay.student_id, -v_pay.amount, v_pay.method, v_pay.account_id,
    v_pay.txn_ref, v_pay.paid_by, (select auth.uid()), now(),
    private.next_receipt_no(v_inst), v_pay.id, p_reason)
  returning id into v_rev;

  return v_rev;
end; $fn$;
revoke all on function private.fn_void_fee_payment(uuid, text) from authenticated, anon, public;

create or replace function public.fn_void_fee_payment(p_payment_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_permission('fee.void');
  return private.fn_void_fee_payment(p_payment_id, p_reason);
end $$;
revoke all on function public.fn_void_fee_payment(uuid, text) from public, anon;
grant execute on function public.fn_void_fee_payment(uuid, text) to authenticated;

/* ------------------------------------------------------------- day book */

/**
 * One collector's day, aggregated in Postgres.
 *
 * Aggregating in the client was never an option here: PostgREST truncates at
 * `db-max-rows`, so a busy admission day would silently produce a cash total
 * for a partial table — the same class of defect the digital-transaction
 * stats RPC was written to close, on a number a clerk reconciles against a
 * physical drawer.
 *
 * `p_collector` NULL means every collector, which is the head teacher's view.
 */
create or replace function public.fn_fee_day_book(p_date date, p_collector uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_inst uuid; v_out jsonb;
begin
  perform private.require_permission('fee.view');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  with day as (
    select p.*, pr.full_name as collector_name
      from public.fee_payment p
      left join public.profile pr on pr.id = p.received_by
     where p.institution_id = v_inst
       and (p.paid_at at time zone 'Asia/Dhaka')::date = p_date
       and (p_collector is null or p.received_by = p_collector)
  )
  select jsonb_build_object(
    'date', p_date,
    'gross',   coalesce((select sum(amount) from day where amount > 0), 0),
    'refunds', coalesce((select -sum(amount) from day where amount < 0), 0),
    'net',     coalesce((select sum(amount) from day), 0),
    'count',   (select count(*) from day where amount > 0),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', method, 'amount', total, 'count', cnt) order by total desc)
        from (select method, sum(amount) as total, count(*) as cnt from day group by method) m), '[]'::jsonb),
    'by_collector', coalesce((
      select jsonb_agg(jsonb_build_object('collector_id', rid, 'collector', name, 'amount', total, 'count', cnt) order by total desc)
        from (select received_by as rid, coalesce(collector_name, '—') as name, sum(amount) as total, count(*) as cnt
                from day group by received_by, collector_name) c), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'payment_id', id, 'receipt_no', receipt_no, 'at', paid_at, 'amount', amount,
               'method', method, 'collector', coalesce(collector_name,'—'),
               'voided', voided_at is not null, 'reversal', reverses_payment_id is not null,
               'student_code', (select student_code from public.student s where s.id = day.student_id),
               'student_bn', (select name_bn from public.student s where s.id = day.student_id),
               'student_en', (select name_en from public.student s where s.id = day.student_id))
             order by paid_at)
        from day), '[]'::jsonb)
  ) into v_out;

  return v_out;
end; $fn$;
revoke all on function public.fn_fee_day_book(date, uuid) from public, anon;
grant execute on function public.fn_fee_day_book(date, uuid) to authenticated;

/* ------------------------------------------------------- receipt payload */

/** Everything one receipt prints, in one round trip. */
create or replace function public.fn_fee_receipt(p_payment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_inst uuid; v_out jsonb;
begin
  perform private.require_permission('fee.view');
  v_inst := private.current_institution_id();

  select jsonb_build_object(
    'payment_id', p.id, 'receipt_no', p.receipt_no, 'paid_at', p.paid_at,
    'amount', p.amount, 'method', p.method, 'txn_ref', p.txn_ref,
    'voided', p.voided_at is not null, 'void_reason', p.void_reason,
    'is_reversal', p.reverses_payment_id is not null,
    'collector', coalesce(pr.full_name, '—'),
    'account', acc.name,
    'student_code', s.student_code, 'student_bn', s.name_bn, 'student_en', s.name_en,
    'roll', enr.roll_no,
    'class_bn', cls.name_bn, 'class_en', cls.name_en, 'section', sec.name,
    'invoice_period', inv.period,
    'invoice_total', inv.total_amount, 'invoice_paid', inv.paid_amount, 'invoice_due', inv.due_amount,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object('head', fh.name, 'amount', l.amount))
        from public.fee_invoice_line l join public.fee_head fh on fh.id = l.fee_head_id
       where l.fee_invoice_id = inv.id), '[]'::jsonb)
  ) into v_out
  from public.fee_payment p
  join public.fee_invoice inv on inv.id = p.fee_invoice_id
  join public.student s on s.id = p.student_id
  left join public.profile pr on pr.id = p.received_by
  left join public.financial_account acc on acc.id = p.account_id
  left join public.student_enrollment enr on enr.id = s.current_enrollment_id
  left join public.class_section cs on cs.id = enr.class_section_id
  left join public.class cls on cls.id = cs.class_id
  left join public.section sec on sec.id = cs.section_id
  where p.id = p_payment_id and p.institution_id = v_inst;

  return coalesce(v_out, '{}'::jsonb);
end; $fn$;
revoke all on function public.fn_fee_receipt(uuid) from public, anon;
grant execute on function public.fn_fee_receipt(uuid) to authenticated;

-- ============================================================================
-- SRA A-6.1 — idempotent fee collection.
--
-- WHAT WAS WRONG. `fn_collect_fee` had no way to tell a retry from a second
-- payment. A double-click on the Collect button, or a client retry over the
-- flaky connection a Bangladeshi school counter actually has, posts the payment
-- twice: two `fee_payment` rows, two ledger credits via the AFTER-INSERT
-- trigger, and an invoice that reports more paid than the parent handed over.
-- There is also no void path, so the correction is a manual database edit.
--
-- THE FIX. A client-generated key carried with the request, stored with the
-- payment under a unique constraint. A retry with the same key returns the
-- ORIGINAL payment id instead of inserting — so a retry is safe by construction
-- rather than by the operator not clicking twice.
--
-- ponytail: a nullable column plus a partial unique index, not a separate
-- idempotency-key table with TTL sweeps. The key belongs to the payment, dies
-- with the payment, and needs no janitor. Nullable so the constraint cannot
-- break an older client that sends no key.
-- ============================================================================

alter table public.fee_payment
  add column if not exists idempotency_key uuid;

comment on column public.fee_payment.idempotency_key is
  'Client-generated per collection attempt. A retry carrying the same key '
  'returns the original payment instead of posting a second one.';

-- Partial: rows without a key (every payment taken before this migration) do
-- not participate, and NULLs would not collide anyway — being explicit costs
-- nothing and states the intent.
create unique index if not exists ux_fee_payment_idempotency
  on public.fee_payment (institution_id, idempotency_key)
  where idempotency_key is not null;

-- Targets `private.fn_collect_fee`, NOT `public.fn_collect_fee`. Migration
-- 20260726044457 moved every RPC body into `private` and left a permission-
-- checking wrapper behind in `public`; replacing the public name here would
-- silently delete the `fee.collect` guard and re-open the hole that migration
-- was written to close.
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

  -- Fast path: this exact attempt already landed. Return what it produced.
  -- Checked BEFORE any work so a retry costs one indexed lookup.
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
  -- Over-payment is capped, not rejected: a clerk who types the round figure a
  -- parent handed over should not be blocked. The screen now states the cap
  -- before the click, so it is no longer a silent adjustment.
  if v_inv.paid_amount + v_inv.waiver_amount + v_amt > v_inv.total_amount then
    v_amt := v_inv.total_amount - v_inv.paid_amount - v_inv.waiver_amount;
  end if;
  if v_amt <= 0 then raise exception 'invoice already settled'; end if;

  insert into public.fee_payment(institution_id, fee_invoice_id, student_id, amount, method, account_id, txn_ref, paid_by, received_by, paid_at, idempotency_key)
  values (v_inst, v_inv.id, v_inv.student_id, v_amt,
    coalesce(nullif(payload->>'method',''),'cash'), nullif(payload->>'account_id','')::uuid, nullif(payload->>'txn_ref',''),
    nullif(payload->>'paid_by',''), (select auth.uid()),
    coalesce(nullif(payload->>'paid_at','')::timestamptz, now()), v_key)
  returning id into v_pay;
  -- invoice recompute + ledger credit are handled by private.fee_payment_trg.
  return v_pay;

-- Two tabs, or a retry racing the original, can both pass the fast-path check.
-- The unique index is the real arbiter; this turns its violation into the same
-- answer the fast path would have given.
exception when unique_violation then
  select id into v_pay from public.fee_payment
   where institution_id = v_inst and idempotency_key = v_key;
  if v_pay is null then raise; end if;
  return v_pay;
end; $fn$;
revoke all on function private.fn_collect_fee(jsonb) from authenticated, anon, public;

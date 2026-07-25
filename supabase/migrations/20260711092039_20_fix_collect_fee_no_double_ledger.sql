-- fee_payment already has an AFTER-INSERT trigger (private.fee_payment_trg) that
-- recomputes the invoice AND writes the ledger credit. fn_collect_fee must ONLY
-- insert the payment (cap to remaining due) and let the trigger do the rest,
-- otherwise the ledger is double-credited and the invoice update is redundant.
create or replace function public.fn_collect_fee(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_inv public.fee_invoice; v_amt numeric; v_pay uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select * into v_inv from public.fee_invoice
    where id = nullif(payload->>'fee_invoice_id','')::uuid and deleted_at is null;
  if v_inv.id is null or v_inv.institution_id <> v_inst then raise exception 'invoice not found in institution'; end if;

  v_amt := coalesce(nullif(payload->>'amount','')::numeric, 0);
  if v_amt <= 0 then raise exception 'amount must be positive'; end if;
  if v_inv.paid_amount + v_inv.waiver_amount + v_amt > v_inv.total_amount then
    v_amt := v_inv.total_amount - v_inv.paid_amount - v_inv.waiver_amount;
  end if;
  if v_amt <= 0 then raise exception 'invoice already settled'; end if;

  insert into public.fee_payment(institution_id, fee_invoice_id, student_id, amount, method, account_id, txn_ref, paid_by, received_by, paid_at)
  values (v_inst, v_inv.id, v_inv.student_id, v_amt,
    coalesce(nullif(payload->>'method',''),'cash'), nullif(payload->>'account_id','')::uuid, nullif(payload->>'txn_ref',''),
    nullif(payload->>'paid_by',''), (select auth.uid()),
    coalesce(nullif(payload->>'paid_at','')::timestamptz, now()))
  returning id into v_pay;
  -- invoice recompute + ledger credit are handled by private.fee_payment_trg.
  return v_pay;
end; $fn$;
revoke execute on function public.fn_collect_fee(jsonb) from public, anon;
grant execute on function public.fn_collect_fee(jsonb) to authenticated, service_role;

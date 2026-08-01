-- ============================================================================
-- SRA A-7 — the Documents module becomes a delivered capability.
--
-- WHAT WAS WRONG. Seven screens created *records of documents* and produced no
-- document. The batch rows themselves were a bare specification: class,
-- section, roll range. There was no created-by, no count, no reprint, no
-- cancel (A-7 point 8); no way to pick individual students or exclude one who
-- joined mid-range (point 9); the "card type" and "class colour" were free
-- text nothing read (point 3); and the certificates carried no serial and no
-- verification path despite being legal-adjacent documents (point 6).
--
-- This migration adds only what the artefact layer needs to be honest about
-- WHO produced WHICH document WHEN, and to let a receiving school check one.
-- The rendering itself is print-CSS in the client and needs no schema at all.
-- ============================================================================

/* ------------------------------------------------------------ batch metadata */

do $$
declare tbl text;
begin
  foreach tbl in array array['id_card_batch','admit_card_batch'] loop
    execute format($sql$
      alter table public.%I
        -- Attribution. "Who printed 400 ID cards last Tuesday" is the first
        -- question asked when a card turns up somewhere it should not.
        add column if not exists created_by uuid references public.profile(id) on delete set null,
        -- NULL = the whole roll range, which is the behaviour every existing
        -- batch already has. A non-empty array is an explicit selection, so
        -- "exclude the two who transferred out" is expressible without
        -- inventing a second range.
        add column if not exists student_ids uuid[],
        -- Resolved at creation so a reprint six months later reproduces the
        -- sheet that was printed, not the roster as it stands today.
        add column if not exists card_count integer,
        add column if not exists theme text,
        add column if not exists status text not null default 'active',
        add column if not exists cancelled_at timestamptz,
        add column if not exists cancel_reason text
    $sql$, tbl);

    execute format(
      'alter table public.%I add constraint %I check (status in (''active'',''cancelled'')) not valid',
      tbl, tbl || '_status_chk');
    execute format('alter table public.%I validate constraint %I', tbl, tbl || '_status_chk');
  end loop;
exception when duplicate_object then null;
end $$;

comment on column public.id_card_batch.student_ids is
  'Explicit student selection. NULL means the whole roll range — the pre-existing behaviour.';

/* --------------------------------------------------- creation RPCs, extended */

-- Targets `private.*`: migration 20260726044457 moved every RPC body there and
-- left a permission-checking wrapper in `public`. Replacing the public name
-- would silently delete the `certificate.generate` guard.
create or replace function private.fn_create_id_card_batch(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid; v_students uuid[];
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select array_agg(value::uuid) into v_students
    from jsonb_array_elements_text(coalesce(payload->'student_ids','[]'::jsonb));

  insert into public.id_card_batch(
    institution_id, class_id, section_id, roll_from, roll_to, template, class_color,
    valid_till, includes, created_by, student_ids, card_count, theme)
  values (v_inst, nullif(payload->>'class_id','')::uuid, nullif(payload->>'section_id','')::uuid,
    nullif(payload->>'roll_from','')::int, nullif(payload->>'roll_to','')::int,
    nullif(payload->>'template',''), nullif(payload->>'class_color',''),
    nullif(payload->>'valid_till','')::date, coalesce(payload->'includes','{}'::jsonb),
    (select auth.uid()), nullif(v_students, '{}'), nullif(payload->>'card_count','')::int,
    nullif(payload->>'theme',''))
  returning id into v_id;
  return v_id;
end; $fn$;
revoke all on function private.fn_create_id_card_batch(jsonb) from authenticated, anon, public;

create or replace function private.fn_create_admit_batch(payload jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_id uuid; v_students uuid[];
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select array_agg(value::uuid) into v_students
    from jsonb_array_elements_text(coalesce(payload->'student_ids','[]'::jsonb));

  insert into public.admit_card_batch(
    institution_id, exam_id, class_id, section_id, roll_from, roll_to, center, issue_date,
    includes, created_by, student_ids, card_count, theme)
  values (v_inst, nullif(payload->>'exam_id','')::uuid, nullif(payload->>'class_id','')::uuid,
    nullif(payload->>'section_id','')::uuid, nullif(payload->>'roll_from','')::int,
    nullif(payload->>'roll_to','')::int, nullif(payload->>'center',''),
    nullif(payload->>'issue_date','')::date, coalesce(payload->'includes','{}'::jsonb),
    (select auth.uid()), nullif(v_students, '{}'), nullif(payload->>'card_count','')::int,
    nullif(payload->>'theme',''))
  returning id into v_id;
  return v_id;
end; $fn$;
revoke all on function private.fn_create_admit_batch(jsonb) from authenticated, anon, public;

/* ------------------------------------------------------------------- cancel */

-- Cancel-with-reason, never DELETE. A batch is the record that 400 cards were
-- issued; deleting it destroys the only evidence the print happened.
create or replace function private.fn_cancel_document_batch(p_kind text, p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare v_inst uuid; v_rows int;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'a cancellation reason is required'; end if;

  if p_kind = 'id' then
    update public.id_card_batch
       set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
     where id = p_id and institution_id = v_inst and status <> 'cancelled';
  elsif p_kind = 'admit' then
    update public.admit_card_batch
       set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
     where id = p_id and institution_id = v_inst and status <> 'cancelled';
  else
    raise exception 'unknown batch kind: %', p_kind;
  end if;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'batch not found, or already cancelled'; end if;
end; $fn$;
revoke all on function private.fn_cancel_document_batch(text, uuid, text) from authenticated, anon, public;

create or replace function public.fn_cancel_document_batch(p_kind text, p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_permission('certificate.generate');
  perform private.fn_cancel_document_batch(p_kind, p_id, p_reason);
end $$;
-- REVOKE FROM PUBLIC FIRST. `create function` grants EXECUTE to PUBLIC by
-- default and every role inherits it — granting to `authenticated` does not
-- take that away. Omitting this line left the function with `=X/postgres` in
-- its ACL on the live project, i.e. anon-executable, and it was caught by
-- reading the ACL rather than by reading the migration. Check the ACL.
revoke all on function public.fn_cancel_document_batch(text, uuid, text) from public, anon;
grant execute on function public.fn_cancel_document_batch(text, uuid, text) to authenticated;

/* ------------------------------------------- certificate serial + verification */

-- A testimonial or transfer certificate leaves the institution's control the
-- moment it is handed over. Without a serial there is nothing to check it
-- against; without a verification path the receiving school has to phone.
alter table public.testimonial
  add column if not exists issued_by uuid references public.profile(id) on delete set null;
alter table public.transfer_certificate
  add column if not exists issued_by uuid references public.profile(id) on delete set null;

create unique index if not exists ux_testimonial_cert_no
  on public.testimonial (institution_id, cert_no) where cert_no is not null;
create unique index if not exists ux_transfer_cert_no
  on public.transfer_certificate (institution_id, cert_no) where cert_no is not null;

/**
 * Public verification. SECURITY DEFINER and deliberately callable by `anon`:
 * the QR on a printed certificate has to resolve for somebody who has no
 * account here.
 *
 * WHAT IT DISCLOSES, AND WHY THAT IS THE LIMIT. Given an id somebody is
 * physically holding, it confirms the document exists, names the institution
 * and the student, and gives the issue date — which is the whole point of
 * verification. It takes a uuid, so it cannot be walked; it returns nothing
 * for an unknown id; and it exposes no address, no guardian, no marks, no
 * fees. Returning "not found" for a wrong id is not an enumeration risk
 * because the id space is 122 bits.
 */
create or replace function public.fn_verify_document(p_kind text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v jsonb;
begin
  if p_kind = 'testimonial' then
    select jsonb_build_object(
             'kind','testimonial', 'found', true, 'serial', t.cert_no,
             'issued_at', t.issued_at, 'session', t.session,
             'student_bn', s.name_bn, 'student_en', s.name_en,
             'institution_bn', i.name_bn, 'institution_en', i.name_en)
      into v
      from public.testimonial t
      join public.student s on s.id = t.student_id
      join public.institution i on i.id = t.institution_id
     where t.id = p_id;
  elsif p_kind = 'transfer' then
    select jsonb_build_object(
             'kind','transfer', 'found', true, 'serial', c.cert_no,
             'issued_at', c.issue_date, 'session', c.session,
             'student_bn', s.name_bn, 'student_en', s.name_en,
             'institution_bn', i.name_bn, 'institution_en', i.name_en)
      into v
      from public.transfer_certificate c
      join public.student s on s.id = c.student_id
      join public.institution i on i.id = c.institution_id
     where c.id = p_id;
  else
    return jsonb_build_object('found', false);
  end if;

  return coalesce(v, jsonb_build_object('found', false));
end; $fn$;

-- Revoke from PUBLIC first. The default grant on a new function is to PUBLIC,
-- and every role inherits it — the ACL, not the statement, is what decides
-- (the lesson from the Phase 1 `fn_*` sweep).
revoke all on function public.fn_verify_document(text, uuid) from public;
grant execute on function public.fn_verify_document(text, uuid) to anon, authenticated;

/* ------------------------------ ID / admit cards also carry a QR ------------ */

/**
 * The ID-card and admit-card templates print a QR at /verify/id/{student} and
 * /verify/admit/{student}. The version above knew only 'testimonial' and
 * 'transfer', so every card in the first batch would have scanned to "no such
 * document on record" — a QR that reliably says the card is fake is worse than
 * no QR at all. Caught by scanning the rendered preview, not by reading this
 * file.
 *
 * DISCLOSURE. The scanner is physically holding the card, which already prints
 * the name, the ID and the class. This returns the same facts from the
 * database, which is what verification means: does the card match the record.
 *
 * A student who has left does NOT verify — an ID card surrendered on transfer
 * must stop working, and that is the most useful thing this endpoint does.
 */
create or replace function public.fn_verify_document(p_kind text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v jsonb;
begin
  if p_kind = 'testimonial' then
    select jsonb_build_object(
             'kind','testimonial', 'found', true, 'serial', t.cert_no,
             'issued_at', t.issued_at, 'session', t.session,
             'student_bn', s.name_bn, 'student_en', s.name_en,
             'institution_bn', i.name_bn, 'institution_en', i.name_en)
      into v
      from public.testimonial t
      join public.student s on s.id = t.student_id
      join public.institution i on i.id = t.institution_id
     where t.id = p_id;

  elsif p_kind = 'transfer' then
    select jsonb_build_object(
             'kind','transfer', 'found', true, 'serial', c.cert_no,
             'issued_at', c.issue_date, 'session', c.session,
             'student_bn', s.name_bn, 'student_en', s.name_en,
             'institution_bn', i.name_bn, 'institution_en', i.name_en)
      into v
      from public.transfer_certificate c
      join public.student s on s.id = c.student_id
      join public.institution i on i.id = c.institution_id
     where c.id = p_id;

  elsif p_kind in ('id','admit') then
    select jsonb_build_object(
             'kind', p_kind, 'found', true,
             'serial', s.student_code, 'issued_at', null, 'session', ay.year_label,
             'student_bn', s.name_bn, 'student_en', s.name_en,
             'class_bn', cls.name_bn, 'class_en', cls.name_en, 'roll', enr.roll_no,
             'institution_bn', i.name_bn, 'institution_en', i.name_en)
      into v
      from public.student s
      join public.institution i on i.id = s.institution_id
      left join public.student_enrollment enr on enr.id = s.current_enrollment_id
      left join public.academic_year ay on ay.id = enr.academic_year_id
      left join public.class_section cs on cs.id = enr.class_section_id
      left join public.class cls on cls.id = cs.class_id
     where s.id = p_id and s.deleted_at is null and s.status = 'active';

  else
    return jsonb_build_object('found', false);
  end if;

  return coalesce(v, jsonb_build_object('found', false));
end; $fn$;
revoke all on function public.fn_verify_document(text, uuid) from public;
grant execute on function public.fn_verify_document(text, uuid) to anon, authenticated;

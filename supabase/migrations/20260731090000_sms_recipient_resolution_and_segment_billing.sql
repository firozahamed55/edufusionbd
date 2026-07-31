-- ============================================================================
-- SRA F-2 — SMS billing computed from real recipients and real segments.
--
-- WHAT WAS WRONG. `fn_send_sms_campaign` billed from `payload->>'recipient_count'`
-- — a free-text number the operator typed into the Send screen — and debited the
-- balance by that count. Two independent defects fell out of that:
--
--   (a) The count was a guess. The system holds the roster; it knows exactly how
--       many guardians are in section 9-A. It asked the operator instead. Any
--       typo was a direct billing error in either direction, and the recorded
--       campaign size was fiction.
--   (b) Segments were never in the arithmetic at all. Gateways bill per SEGMENT
--       per recipient. A 150-character Bangla notice is 3 segments (UCS-2 holds
--       70 chars, 67 concatenated) — it was billed as 1 message.
--
-- Together, an ordinary Bangla campaign to a mistyped audience could be off by
-- a multiple. The institution's balance and the gateway's invoice could never
-- agree, and nobody had computed either number.
--
-- SHAPE OF THE FIX. Resolution and billing move into the database, because that
-- is the only place they cannot be spoofed by a caller. `recipient_count` is now
-- an OUTPUT of the send, not an input. The Send screen calls the same resolver
-- to show a preview, so the number the operator is quoted is the number that is
-- charged, by construction rather than by agreement.
-- ============================================================================

-- ── Segment arithmetic ──────────────────────────────────────────────────────
-- Mirrors src/shared/lib/sms.ts. The duplication is deliberate: the client needs
-- it to quote a price before the round trip, and the server needs it because the
-- client's answer is advisory. Both are tested against the same cases.
create or replace function private.sms_segments(p_body text) returns int
  language plpgsql immutable set search_path = '' as $$
declare
  -- GSM 03.38 basic alphabet. Written literally rather than as a range test:
  -- the alphabet is not contiguous (it includes £ ¥ è É Ø and the Greek
  -- capitals, and excludes plenty of Latin-1 that looks safe), so a range test
  -- would be permissive in exactly the direction that under-bills.
  gsm_basic constant text :=
    '@£$¥èéùìòÇ' || chr(10) || 'Øø' || chr(13) ||
    'ÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&''()*+,-./0123456789:;<=>?' ||
    '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
  -- Escape-table characters: legal in GSM-7, but each costs TWO septets.
  gsm_ext constant text := '^{}\[~]|€';
  v_units int;
  v_single int;
  v_multi int;
begin
  if p_body is null or p_body = '' then return 0; end if;

  if translate(p_body, gsm_basic || gsm_ext, '') = '' then
    v_units := length(p_body) + (length(p_body) - length(translate(p_body, gsm_ext, '')));
    v_single := 160; v_multi := 153;
  else
    -- Any single non-GSM character forces the WHOLE message to UCS-2, exactly
    -- as the radio layer does. One Bangla word in an English notice triples it.
    -- ponytail: length() counts characters where UCS-2 bills UTF-16 code units,
    -- so an astral-plane character (emoji) is under-counted by one unit. Bangla
    -- and Latin are entirely BMP, so this is exact for every message this
    -- product actually sends; revisit if emoji templates ever ship.
    v_units := length(p_body);
    v_single := 70; v_multi := 67;
  end if;

  -- 161 GSM chars is 2x153, not 160+1: concatenation adds a 6-byte User Data
  -- Header to EVERY part, so the per-part capacity drops for the whole message.
  if v_units <= v_single then return 1; end if;
  return ceil(v_units::numeric / v_multi)::int;
end;
$$;

-- ── Recipient resolution ────────────────────────────────────────────────────
-- The audience the operator picks, turned into actual reachable mobile numbers.
-- Returns one row per DISTINCT number: two siblings in the same section share a
-- guardian, and billing that guardian twice for one notice is the same class of
-- error as the hand-typed count.
create or replace function private.resolve_sms_recipients(
  p_audience         text,
  p_class_section_id uuid default null
) returns table(name text, mobile text)
  language sql stable security definer set search_path = '' as $$
  with inst as (select private.current_institution_id() as id)
  -- Staff: their own mobile.
  select distinct on (t.mobile) t.name_en, t.mobile
    from public.teacher t, inst
   where p_audience = 'teacher'
     and t.institution_id = inst.id
     and t.deleted_at is null
     and t.status = 'active'
     and nullif(trim(t.mobile), '') is not null

  union all

  -- Students and parents both resolve to the GUARDIAN's mobile. `student` holds
  -- no phone column, and in this market a school reaches a child through their
  -- guardian regardless — so a "students" audience that silently reached nobody
  -- would be worse than one that is honest about who it texts.
  select distinct on (g.mobile) g.name, g.mobile
    from public.student_enrollment e
    join public.student           s on s.id = e.student_id and s.deleted_at is null
    join public.student_guardian sg on sg.student_id = s.id and sg.is_primary_contact
    join public.guardian          g on g.id = sg.guardian_id and g.deleted_at is null
       , inst
   where p_audience in ('parent', 'student')
     and e.institution_id = inst.id
     and e.deleted_at is null
     and e.status = 'active'
     -- Year-scoped: without it, last year's leavers are billed for this year's
     -- notices. Same defect the dashboard's overdue-fee query was fixed for.
     and e.academic_year_id = (
       select ay.id from public.academic_year ay
        where ay.institution_id = inst.id and ay.is_current and ay.deleted_at is null
        limit 1)
     and (p_class_section_id is null or e.class_section_id = p_class_section_id)
     and nullif(trim(g.mobile), '') is not null
$$;

-- Client-facing wrapper so the Send screen can preview the exact set it will
-- pay for. Read-only and RLS-equivalent (it filters on the caller's own
-- institution), so it needs no permission guard beyond being authenticated.
create or replace function public.fn_resolve_sms_recipients(
  p_audience         text,
  p_class_section_id uuid default null
) returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'count',  (select count(*) from private.resolve_sms_recipients(p_audience, p_class_section_id)),
    -- A bounded sample so the operator can sanity-check WHO, not just how many.
    -- The full list is never shipped to the browser: it is a few thousand
    -- guardians' phone numbers, and nothing on the screen needs it.
    'sample', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'mobile', r.mobile))
        from (select * from private.resolve_sms_recipients(p_audience, p_class_section_id) limit 10) r
    ), '[]'::jsonb)
  )
$$;
revoke all on function public.fn_resolve_sms_recipients(text, uuid) from anon, public;
grant execute on function public.fn_resolve_sms_recipients(text, uuid) to authenticated;

-- ── Send, billed from what was resolved ─────────────────────────────────────
create or replace function private.fn_send_sms_campaign(payload jsonb) returns uuid
 language plpgsql security definer set search_path = '' as $function$
declare
  v_inst     uuid;
  v_id       uuid;
  v_section  uuid;
  v_body     text;
  v_audience text;
  v_people   int;
  v_segments int;
  v_units    int;
  v_acct     uuid;
  v_rate     numeric;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  if not private.check_rate_limit('sms.send', 20, interval '1 hour') then
    raise exception 'rate limit exceeded: too many SMS campaigns sent recently' using errcode = 'RLIM1';
  end if;

  v_body     := nullif(payload->>'body', '');
  v_audience := coalesce(nullif(payload->>'recipient_type', ''), 'parent');
  v_section  := nullif(payload->>'class_section_id', '')::uuid;

  if v_body is null then raise exception 'message body is required'; end if;

  -- THE FIX: the count comes from the roster, never from the caller. A client
  -- that lies about `recipient_count` — or an old client that still sends one —
  -- cannot change what is billed.
  select count(*) into v_people
    from private.resolve_sms_recipients(v_audience, v_section);

  if v_people = 0 then
    raise exception 'no reachable recipients for this audience' using errcode = 'SMS01';
  end if;

  v_segments := private.sms_segments(v_body);
  v_units    := v_people * v_segments;   -- what the gateway will actually charge

  select id, per_sms_rate into v_acct, v_rate
    from public.sms_account where institution_id = v_inst limit 1;

  -- Refuse rather than silently send a campaign the balance cannot cover. A
  -- partially-delivered notice is worse than an un-sent one: the school believes
  -- every parent was told.
  if v_acct is not null and (select balance from public.sms_account where id = v_acct) < v_units then
    raise exception 'insufficient SMS balance: % messages needed', v_units using errcode = 'SMS02';
  end if;

  insert into public.sms_campaign(
    institution_id, recipient_type, recipient_group, language, template_id, body,
    recipient_count, est_cost, sent_by, sent_at)
  values (
    v_inst, v_audience, nullif(payload->>'recipient_group',''),
    nullif(payload->>'language','')::public.app_language,
    nullif(payload->>'template_id','')::uuid, v_body,
    v_people, v_units * coalesce(v_rate, 0.5), (select auth.uid()), now())
  returning id into v_id;

  if v_acct is not null then
    update public.sms_account set balance = greatest(balance - v_units, 0) where id = v_acct;
  end if;

  return v_id;
end; $function$;
revoke all on function private.fn_send_sms_campaign(jsonb) from authenticated, anon, public;

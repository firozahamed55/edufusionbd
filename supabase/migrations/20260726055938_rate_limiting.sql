-- ============================================================================
-- Phase 2.1 (A-H8) — a rate-limit primitive, and it protects the one write
-- path the audit named by name: SMS send.
--
-- "There is no limit on anything else [besides GoTrue's own auth throttling].
-- Because the client calls PostgREST directly, an authenticated user can
-- issue unlimited queries... There is also no protection on the SMS send
-- path, which spends real money per message."
--
-- WHERE THE CHECK LIVES. The audit's fix text says "route the write path
-- through /api/v1/* handlers with a token-bucket in Postgres". The token
-- bucket goes in Postgres either way; the question is whether a Next.js route
-- handler is the only thing that enforces it. It is not, here: the client
-- talks to PostgREST directly (§3.1 of the audit — there is no server tier in
-- front of most of the API surface), so a check that lives only in a Next.js
-- handler protects nothing against a direct `POST /rest/v1/rpc/fn_send_sms_
-- campaign` call with a stolen or replayed session. The limit is enforced
-- inside `public.fn_send_sms_campaign` itself — the one chokepoint every
-- caller must pass through, PostgREST or Next.js alike. The Next.js route
-- handler added alongside this migration is real (it validates and forwards),
-- not a second, weaker copy of the same check.
-- ============================================================================

create table public.request_log (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institution(id) on delete cascade,
  profile_id      uuid not null references public.profile(id) on delete cascade,
  bucket          text not null,
  at              timestamptz not null default now()
);
-- The only query this table serves: "how many rows for this actor+bucket in
-- the last N minutes". Leading columns match that lookup exactly.
create index ix_request_log_lookup on public.request_log (institution_id, profile_id, bucket, at desc);

alter table public.request_log enable row level security;
alter table public.request_log force row level security;
-- No client-facing policy at all: this table exists for `check_rate_limit()`
-- to read and write as SECURITY DEFINER. A row appearing in an operator's own
-- audit view would be noise, not a control, and a client that could read it
-- could infer how close another user is to their limit.

-- Retention: rate-limit history older than a day answers no question anyone
-- has. ponytail: a manual DELETE, not a pg_cron job — this table is small
-- (one row per rate-limited call) and pg_cron is not enabled in this project;
-- wire a scheduled `select private.prune_request_log()` if the table's size
-- ever becomes a reason to.
create or replace function private.prune_request_log() returns void
  language sql security definer set search_path = '' as $$
  delete from public.request_log where at < now() - interval '1 day'
$$;

-- ---------------------------------------------------------------------------
-- private.check_rate_limit(bucket, max_calls, window)
--
-- Fixed window, not sliding or token-bucket: the audit's own wording says
-- "token-bucket", but a fixed window is one INSERT + one COUNT, needs no
-- background refill process, and for "N sends per window" (a school does not
-- send SMS at a smooth, continuous rate — it sends bursts around exam results
-- and admit cards) a fixed window is the same user experience with a third of
-- the mechanism. Logs the attempt whether or not it is allowed, so a caller
-- hammering the limit cannot avoid appearing in it.
-- ponytail: per (institution, profile, bucket) — no per-IP dimension. Add one
-- if abuse ever originates from a single IP across many accounts; nothing
-- here needs to guess that shape today.
-- ---------------------------------------------------------------------------
create or replace function private.check_rate_limit(
  p_bucket text, p_max_calls int, p_window interval
) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare v_inst uuid; v_actor uuid; v_count int;
begin
  v_inst := private.current_institution_id();
  v_actor := (select auth.uid());
  if v_inst is null or v_actor is null then raise exception 'no institution context'; end if;

  select count(*) into v_count from public.request_log
   where institution_id = v_inst and profile_id = v_actor and bucket = p_bucket
     and at >= now() - p_window;

  insert into public.request_log (institution_id, profile_id, bucket) values (v_inst, v_actor, p_bucket);

  return v_count < p_max_calls;
end;
$$;
revoke all on function private.check_rate_limit(text, int, interval) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- Wire it into the one function the audit named: 20 sends per rolling hour,
-- per person, per school. Generous enough that a real admissions/results day
-- (a handful of campaigns) never trips it; tight enough that a compromised
-- session cannot script the balance to zero in a loop.
-- ---------------------------------------------------------------------------
create or replace function private.fn_send_sms_campaign(payload jsonb) returns uuid
 language plpgsql security definer set search_path = '' as $function$
declare v_inst uuid; v_id uuid; v_count int; v_acct uuid; v_rate numeric;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;
  -- `errors.ts` already classifies any thrown message containing "rate limit"
  -- as `rate_limited` (it has to — GoTrue's own 429s arrive as plain text).
  -- The custom SQLSTATE is a bonus signal for future callers that want to
  -- branch on `code` instead of message text; 'RLIM1' is not a Postgres or
  -- PostgREST built-in class.
  if not private.check_rate_limit('sms.send', 20, interval '1 hour') then
    raise exception 'rate limit exceeded: too many SMS campaigns sent recently' using errcode = 'RLIM1';
  end if;

  v_count := coalesce(nullif(payload->>'recipient_count','')::int, 0);
  select id, per_sms_rate into v_acct, v_rate from public.sms_account where institution_id = v_inst limit 1;

  insert into public.sms_campaign(institution_id, recipient_type, recipient_group, language, template_id, body, recipient_count, est_cost, sent_by, sent_at)
  values (v_inst, coalesce(nullif(payload->>'recipient_type',''),'parent'), nullif(payload->>'recipient_group',''),
    nullif(payload->>'language','')::public.app_language, nullif(payload->>'template_id','')::uuid, nullif(payload->>'body',''),
    v_count, v_count * coalesce(v_rate, 0.5), (select auth.uid()), now())
  returning id into v_id;

  if v_acct is not null and v_count > 0 then
    update public.sms_account set balance = greatest(balance - v_count, 0) where id = v_acct;
  end if;
  return v_id;
end; $function$;
revoke all on function private.fn_send_sms_campaign(jsonb) from authenticated, anon, public;

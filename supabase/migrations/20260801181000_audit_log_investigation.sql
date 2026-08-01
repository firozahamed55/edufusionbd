-- ============================================================================
-- Settings audit M-14 / S-11.1–S-11.4 — the Audit Log is a record, not an
-- investigation tool.
--
-- The screen is well built for what it does: server-paged, URL-persisted
-- filters, honest that its export covers one page, correct that the search box
-- takes a record id. What it cannot answer is the two questions an
-- investigation actually opens with — "what changed last week" and "what did
-- this person do" — and it shows the full before/after of a `student` row,
-- phone and guardian and address included, to anyone holding `audit.read`,
-- with no record of who looked.
--
-- Three things here. An actor list, so the "changed by" filter has something to
-- offer. A reveal logger, so looking at redacted values is itself an event.
-- And a retention path, because a table that only grows and that nobody ever
-- archives is a data-protection finding waiting to be written up.
-- ============================================================================

-- ── who appears in the log ──────────────────────────────────────────────────
/**
 * The distinct actors present in this institution's audit log.
 *
 * Not "every user": the filter's job is to narrow a log, and offering fifty
 * names that appear in it zero times is a list of dead ends. Sourced from the
 * log itself so the options and the results cannot disagree.
 *
 * Guarded on `audit.read`, not `core.user_manage`. An auditor who may read the
 * log may see whose names are in it — that is the log's own content — and
 * requiring the user-management permission would make the filter unusable by
 * exactly the role it exists for.
 */
create or replace function public.fn_audit_actors()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_inst uuid; v_out jsonb;
begin
  perform private.require_permission('audit.read');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) order by a.name), '[]'::jsonb)
    into v_out
    from (
      select distinct p.id, coalesce(p.full_name, p.email, 'Unknown') as name
        from public.audit_log l
        join public.profile p on p.id = l.changed_by
       where l.institution_id = v_inst
    ) a;

  return v_out;
end; $fn$;
revoke all on function public.fn_audit_actors() from public, anon;
grant execute on function public.fn_audit_actors() to authenticated;

-- ── reading PII is an event ─────────────────────────────────────────────────
/**
 * Record that someone revealed the redacted fields of one audit entry.
 *
 * WHAT THIS IS AND IS NOT. The redaction itself is applied in the client, in
 * `shared/lib/auditRedaction.ts`, and that is a DISPLAY control, not an access
 * control: `audit_log.before`/`after` remain readable through PostgREST by any
 * caller holding `audit.read`, exactly as they were before. Making redaction
 * enforceable means moving the list read behind an RPC that strips the keys
 * server-side, which changes the shape of the whole screen and belongs with
 * the Phase 4 data-contract work.
 *
 * What is real today is this row. "Nobody could tell who had read a student's
 * address out of the audit log" was half of finding M-14's PII item, and it is
 * the half that can be closed without redesigning the read path. Said plainly
 * rather than described as redaction it is not yet.
 */
create or replace function public.fn_log_audit_reveal(p_audit_id uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_inst uuid; v_entity text; v_entity_id uuid;
begin
  perform private.require_permission('audit.read');
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  select l.entity, l.entity_id into v_entity, v_entity_id
    from public.audit_log l
   where l.id = p_audit_id and l.institution_id = v_inst;
  if not found then raise exception 'audit entry not found'; end if;

  insert into public.access_log(institution_id, profile_id, action)
  values (v_inst, (select auth.uid()), 'audit.pii_revealed');

  -- Also in the audit log itself, so the reveal appears in the same chronology
  -- as the change it was looking at. An auditor should not need two screens.
  insert into public.audit_log(institution_id, entity, entity_id, action, changed_by, after)
  values (v_inst, 'audit_log', p_audit_id, 'pii_revealed', (select auth.uid()),
          jsonb_build_object('of_entity', v_entity, 'of_entity_id', v_entity_id, 'severity', 'medium'));
end; $fn$;
revoke all on function public.fn_log_audit_reveal(uuid) from public, anon;
grant execute on function public.fn_log_audit_reveal(uuid) to authenticated;

-- ── retention ───────────────────────────────────────────────────────────────
-- 1,916 rows today and the table only grows. Archive rather than delete: the
-- reason to keep an audit log is that someone may ask about a year ago, and a
-- retention policy that answers "we deleted it" is a worse finding than having
-- no policy at all.
create table if not exists public.audit_log_archive (
  like public.audit_log including defaults,
  archived_at timestamptz not null default now()
);
alter table public.audit_log_archive enable row level security;
alter table public.audit_log_archive force row level security;
-- No client-facing policy. Restoring from the archive is a deliberate
-- operator action through a support path, not a screen — and a reader that
-- could see it would sidestep the retention window it exists to implement.

comment on table public.audit_log_archive is
  'Audit rows older than the retention window (Settings audit M-14, S-11.8). Written by private.archive_audit_log; not exposed to any client.';

/**
 * Move everything older than `p_keep` out of the hot table.
 *
 * Two years by default: long enough to cover a full academic cycle plus the
 * year someone spends noticing, short enough that the table serving the screen
 * stays small.
 *
 * ponytail: a function, not a pg_cron job — pg_cron is not enabled on this
 * project (the same reason `private.prune_request_log` is called by hand).
 * Wire `select private.archive_audit_log()` to a schedule when it is.
 */
create or replace function private.archive_audit_log(p_keep interval default interval '2 years')
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_count int;
begin
  with moved as (
    delete from public.audit_log
     where at < now() - p_keep
    returning *
  )
  insert into public.audit_log_archive
  select m.*, now() from moved m;
  get diagnostics v_count = row_count;
  return v_count;
end; $fn$;
revoke all on function private.archive_audit_log(interval) from authenticated, anon, public;

-- The delete needs to be possible at all: `20260726043523` made audit_log
-- append-only. Archiving is the one legitimate exception and it runs as the
-- table owner inside a SECURITY DEFINER function, so state the intent here
-- rather than leaving the next reader to discover the interaction.
comment on function private.archive_audit_log(interval) is
  'The only sanctioned deleter of audit_log rows, and it moves them rather than dropping them (M-14, S-11.8).';

-- ── the index the two new filters need ──────────────────────────────────────
-- The screen now pages by (institution, at desc) with optional equality on
-- changed_by. Without this, "what did this person do last week" is a scan of
-- the whole log for the tenant.
create index if not exists ix_audit_log_actor_at
  on public.audit_log (institution_id, changed_by, at desc);
create index if not exists ix_audit_log_at
  on public.audit_log (institution_id, at desc);

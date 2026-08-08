-- ============================================================================
-- Settings audit M-14 / S-11.1 – S-11.8 — the audit log is a record, not an
-- investigation tool.
--
-- 1,916 rows already and a table that only grows, and the two questions an
-- investigation actually starts with cannot be asked: "what changed last week"
-- (no date range) and "what did this person do" (no actor filter) — the latter
-- despite the join to `profile` already being in the query.
--
-- THE PII PROBLEM IS THE ONE THAT NEEDED A NEW READ PATH. `before`/`after` on a
-- `student` row is the complete record — phone, guardian, address, date of
-- birth, national ID — rendered verbatim to anyone holding `audit.read`, with
-- no redaction and no record of who looked. `audit.read` is a reporting
-- permission; it is not consent to browse the student body's contact details.
--
-- Redacting in the client would be theatre: the values would still be on the
-- wire. So `before` and `after` leave the client's grant entirely, and are
-- served only through `fn_audit_log`, which masks them, and `fn_audit_reveal`,
-- which does not and writes an access-log entry naming the reader. The
-- remaining columns stay granted so the dashboard's activity strip
-- (`id, action, entity, at`) keeps working untouched.
--
-- `changed_keys` is computed server-side from the RAW values before masking.
-- Without it a redacted field that changed and a redacted field that did not
-- would both render as `••• → •••`, and the diff would lie in the one place it
-- matters most.
-- ============================================================================

/* --------------------------------------------------------- redaction policy */

create or replace function private.audit_redacted_keys()
returns text[] language sql immutable set search_path to '' as $$
  -- Personal data that appears in a row snapshot and is never needed to answer
  -- "what changed". Deliberately a function and not a literal in three places.
  select array[
    'phone','mobile','guardian_mobile','alt_mobile','emergency_contact',
    'email','nid','national_id','birth_reg_no',
    'dob','date_of_birth',
    'address','present_address','permanent_address',
    'account_no','bank_account','password','token'
  ]
$$;

create or replace function private.audit_mask(p jsonb)
returns jsonb language sql immutable set search_path to '' as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' then p
    else (
      select coalesce(jsonb_object_agg(k, case when k = any(private.audit_redacted_keys()) and v <> 'null'::jsonb
                                               then '"•••"'::jsonb else v end), '{}'::jsonb)
        from jsonb_each(p) as e(k, v))
  end
$$;

/* ------------------------------------------------------------- the list read */

create or replace function public.fn_audit_log(
  p_page       integer default 1,
  p_per_page   integer default 25,
  p_entity     text    default null,
  p_action     text    default null,
  p_entity_id  uuid    default null,
  p_from       date    default null,
  p_to         date    default null,
  p_changed_by uuid    default null,
  p_dir        text    default 'desc'
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_inst  uuid;
  v_off   integer;
  v_lim   integer;
  v_total bigint;
  v_rows  jsonb;
begin
  perform private.require_permission('audit.read');
  v_inst := private.current_institution_id();

  v_lim := least(greatest(coalesce(p_per_page, 25), 1), 200);
  v_off := (greatest(coalesce(p_page, 1), 1) - 1) * v_lim;

  -- Inclusive on both ends. A half-open `to` would silently drop everything
  -- that happened on the `to` date, which is the date an investigator most
  -- often means.
  select count(*) into v_total
    from public.audit_log a
   where a.institution_id = v_inst
     and (p_entity     is null or a.entity     = p_entity)
     and (p_action     is null or a.action     = p_action)
     and (p_entity_id  is null or a.entity_id  = p_entity_id)
     and (p_changed_by is null or a.changed_by = p_changed_by)
     and (p_from is null or a.at >= p_from::timestamptz)
     and (p_to   is null or a.at <  (p_to + 1)::timestamptz);

  select coalesce(jsonb_agg(j order by rn), '[]'::jsonb) into v_rows
    from (
      select row_number() over () as rn,
             jsonb_build_object(
               'id', p.id,
               'entity', p.entity,
               'entity_id', p.entity_id,
               'action', p.action,
               'at', p.at,
               'changed_by', p.changed_by,
               'changed_by_name', (select pr.full_name from public.profile pr where pr.id = p.changed_by),
               'severity', coalesce(p.after->>'severity', 'normal'),
               'before', private.audit_mask(p.before),
               'after',  private.audit_mask(p.after),
               -- From the RAW values, before masking (see the header note).
               'changed_keys', coalesce((
                 select jsonb_agg(t.k order by t.k)
                   from jsonb_object_keys(coalesce(p.before,'{}'::jsonb) || coalesce(p.after,'{}'::jsonb)) as t(k)
                  where coalesce(p.before,'{}'::jsonb)->t.k is distinct from coalesce(p.after,'{}'::jsonb)->t.k),
                 '[]'::jsonb),
               'redacted_keys', coalesce((
                 select jsonb_agg(t.k order by t.k)
                   from jsonb_object_keys(coalesce(p.before,'{}'::jsonb) || coalesce(p.after,'{}'::jsonb)) as t(k)
                  where t.k = any(private.audit_redacted_keys())),
                 '[]'::jsonb)
             ) as j
        from (
          select a.*
            from public.audit_log a
           where a.institution_id = v_inst
             and (p_entity     is null or a.entity     = p_entity)
             and (p_action     is null or a.action     = p_action)
             and (p_entity_id  is null or a.entity_id  = p_entity_id)
             and (p_changed_by is null or a.changed_by = p_changed_by)
             and (p_from is null or a.at >= p_from::timestamptz)
             and (p_to   is null or a.at <  (p_to + 1)::timestamptz)
           order by case when lower(coalesce(p_dir,'desc')) = 'asc' then a.at end asc nulls last,
                    a.at desc
           limit v_lim offset v_off
        ) p
    ) rows_with_order;

  return jsonb_build_object('rows', coalesce(v_rows, '[]'::jsonb), 'total', coalesce(v_total, 0));
end;
$$;

/* ------------------------------------------------- the reveal, and its record */

create or replace function public.fn_audit_reveal(p_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_inst uuid; v_actor uuid; v_row public.audit_log;
begin
  perform private.require_permission('audit.read');
  v_inst  := private.current_institution_id();
  v_actor := (select auth.uid());

  select * into v_row from public.audit_log where id = p_id and institution_id = v_inst;
  if not found then raise exception 'audit record not found'; end if;

  -- Reading unmasked personal data is itself an event. Written to access_log
  -- rather than audit_log because nothing changed — and because a reveal that
  -- appended to the very table being read would be circular.
  insert into public.access_log(institution_id, profile_id, action)
  values (v_inst, v_actor, 'audit.reveal');

  return jsonb_build_object('before', v_row.before, 'after', v_row.after, 'reason', p_reason);
end;
$$;

/* ------------------------------------------------------- who can be an actor */

create or replace function public.fn_audit_actors()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_inst uuid;
begin
  perform private.require_permission('audit.read');
  v_inst := private.current_institution_id();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', pr.id, 'name', coalesce(pr.full_name, pr.email, 'Unknown'))
                     order by pr.full_name)
      from public.profile pr
     where pr.institution_id = v_inst
       and exists (select 1 from public.audit_log a where a.changed_by = pr.id and a.institution_id = v_inst)),
    '[]'::jsonb);
end;
$$;

/* --------------------------------------------------------- retention (S-11.8) */

create table if not exists public.audit_log_archive (like public.audit_log including defaults);
alter table public.audit_log_archive enable row level security;
comment on table public.audit_log_archive is
  'Cold storage for audit_log rows older than the retention window. No client grants: reachable only by a platform operator through the service role.';

create index if not exists audit_log_archive_at_idx on public.audit_log_archive (institution_id, at desc);

create or replace function private.fn_archive_audit_log(p_keep_months integer default 24)
returns integer language plpgsql security definer set search_path to '' as $$
declare v_count integer;
begin
  with moved as (
    delete from public.audit_log
     where at < now() - make_interval(months => greatest(p_keep_months, 6))
     returning *
  )
  insert into public.audit_log_archive select * from moved;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Monthly, an hour after the invoice run so the two never contend.
select cron.unschedule('audit-log-retention') where exists (select 1 from cron.job where jobname = 'audit-log-retention');
select cron.schedule('audit-log-retention', '0 2 1 * *', $$select private.fn_archive_audit_log(24);$$);

/* ------------------------------------------------------------ the real control */

-- The dashboard activity strip reads `id, action, entity, at` and must keep
-- working, so the grant becomes per-column rather than disappearing. `before`
-- and `after` are now reachable only through the two functions above.
--
-- Note the order: a column-level REVOKE against a table-level grant is a no-op
-- in Postgres. The table grant has to go first, and the columns granted back
-- explicitly, or this whole change is decoration. The `audit_read` RLS policy
-- still applies on top — this narrows WHICH columns, not WHO.
revoke select on public.audit_log from authenticated;
grant select (id, institution_id, entity, entity_id, action, at, changed_by)
  on public.audit_log to authenticated;

grant execute on function public.fn_audit_log(integer, integer, text, text, uuid, date, date, uuid, text) to authenticated;
grant execute on function public.fn_audit_reveal(uuid, text) to authenticated;
grant execute on function public.fn_audit_actors() to authenticated;

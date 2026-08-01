-- ============================================================================
-- R-7 — start writing to the export log that has existed, empty, since Phase 2.
--
-- `export_log` is in the schema, is typed in database.types.ts, has RLS on it,
-- and has zero rows. Not because nothing has been exported — because no
-- application code ever wrote to it:
--
--     grep -rn "export_log" src  →  src/shared/types/database.types.ts
--
-- Nineteen screens call `exportCsv`. Several of them emit full student rosters
-- carrying guardian mobile numbers. For a system holding the records of 268
-- minors, "who took a copy of the roll, and when" is the question most likely
-- to be asked by a regulator, a managing committee, or an incident review, and
-- the table purpose-built to answer it has never been asked to.
--
-- WHY AN RPC AND NOT A CLIENT INSERT. The RLS policy on `export_log` would
-- happily accept an insert from the browser: it checks `institution_id`, and a
-- signed-in user knows their own. But the client would then also be supplying
-- `profile_id` — the ACTOR. A log whose actor column is set by the party being
-- logged is not evidence of anything. Here the actor comes from `auth.uid()`
-- inside a SECURITY DEFINER function, so it is asserted by the database and
-- cannot be forged by the caller.
--
-- Deliberately NOT stored: the exported rows. The log records that an export
-- happened, by whom, of what kind, under which filters — not a second copy of
-- the personal data, which would turn an accountability record into a larger
-- version of the risk it exists to manage.
-- ============================================================================

create or replace function public.fn_log_export(payload jsonb)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_inst uuid;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  insert into public.export_log (institution_id, profile_id, kind, params)
  values (
    v_inst,
    auth.uid(),
    -- `kind` identifies the report, `params` the filters it was run under. A
    -- logged export whose filters are unknown cannot answer "how much of the
    -- roll did they take", which is the whole question.
    coalesce(nullif(payload->>'kind', ''), 'unknown'),
    coalesce(payload->'params', '{}'::jsonb)
  );
end;
$function$;

-- Same grant shape as every other RPC in this schema: `authenticated` only.
-- `anon` executing this would let an unauthenticated caller write rows into an
-- audit table, which is both a forgery vector and a way to bury a real entry.
revoke execute on function public.fn_log_export(jsonb) from public, anon;
grant execute on function public.fn_log_export(jsonb) to authenticated;

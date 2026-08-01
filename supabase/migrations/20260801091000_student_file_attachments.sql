-- ============================================================================
-- SRA A-2.1 item 1 — wire the admission form's photo and document uploads.
--
-- WHAT WAS WRONG. `institution-assets` (bucket), `fn_record_file_upload` (RPC)
-- and `institutionAssets.ts` (helper) all existed; the dropzone and the three
-- "Upload" buttons on the admission form were inert, with a source comment
-- reading "upload wired in a later pass". The missing piece was never storage.
-- It was the step AFTER the upload: nothing set `student.photo_file_id` or
-- inserted a `student_document` row, so an uploaded file was orphaned.
--
-- Downstream this blocked a whole module: an ID card without a photo is not an
-- ID card (A-7 point 4).
-- ============================================================================

create or replace function private.fn_attach_student_file(payload jsonb)
returns void language plpgsql security definer set search_path to '' as $fn$
declare
  v_inst    uuid;
  v_student uuid;
  v_file    uuid;
  v_kind    text;
begin
  v_inst := private.current_institution_id();
  if v_inst is null then raise exception 'no institution context'; end if;

  v_student := nullif(payload->>'student_id','')::uuid;
  v_file    := nullif(payload->>'file_id','')::uuid;
  v_kind    := coalesce(nullif(payload->>'kind',''), 'photo');

  -- Both sides are checked against the caller's institution. `file_object` is
  -- reachable by id alone, so without this a caller could attach another
  -- school's file — and its signed URL — to their own student.
  if not exists (select 1 from public.student where id = v_student and institution_id = v_inst and deleted_at is null) then
    raise exception 'student not found in institution';
  end if;
  if v_file is not null and not exists (select 1 from public.file_object where id = v_file and institution_id = v_inst) then
    raise exception 'file not found in institution';
  end if;

  if v_kind = 'photo' then
    update public.student set photo_file_id = v_file, updated_at = now(), updated_by = (select auth.uid())
     where id = v_student;
  else
    -- NULL file means "detach": the operator removed the document.
    if v_file is null then
      delete from public.student_document where student_id = v_student and type = v_kind;
    else
      insert into public.student_document(student_id, type, file_id)
      values (v_student, v_kind, v_file)
      on conflict on constraint ux_student_document_type
        do update set file_id = excluded.file_id, created_at = now();
    end if;
  end if;
end; $fn$;
revoke all on function private.fn_attach_student_file(jsonb) from authenticated, anon, public;

-- `student_document` had no uniqueness on (student, type), so re-uploading a
-- birth certificate left two rows and the screen showed whichever came back
-- first. Deduplicate before adding the constraint the upsert needs.
delete from public.student_document a
 using public.student_document b
 where a.student_id = b.student_id and a.type = b.type and a.created_at < b.created_at;

alter table public.student_document
  drop constraint if exists ux_student_document_type;
alter table public.student_document
  add constraint ux_student_document_type unique (student_id, type);

create or replace function public.fn_attach_student_file(payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_permission('student.update');
  perform private.fn_attach_student_file(payload);
end $$;
revoke all on function public.fn_attach_student_file(jsonb) from public, anon;
grant execute on function public.fn_attach_student_file(jsonb) to authenticated;

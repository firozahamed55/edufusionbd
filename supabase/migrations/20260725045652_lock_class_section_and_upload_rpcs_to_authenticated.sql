-- Security fix: three SECURITY DEFINER RPCs shipped with PUBLIC + anon EXECUTE,
-- making them callable unauthenticated via /rest/v1/rpc/. Because SECURITY DEFINER
-- bypasses RLS, fn_delete_class_section was an unauthenticated destructive write
-- against any tenant (verified: anon call returned HTTP 204).
--
-- This restores the same grant shape the rest of the RPC surface already uses
-- (see migration 15_lock_teacher_rpc_to_authenticated / fn_register_student):
-- authenticated + service_role only.

REVOKE ALL ON FUNCTION public.fn_delete_class_section(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_delete_class_section(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_upsert_class_section(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_upsert_class_section(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_record_file_upload(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_record_file_upload(jsonb) TO authenticated, service_role;

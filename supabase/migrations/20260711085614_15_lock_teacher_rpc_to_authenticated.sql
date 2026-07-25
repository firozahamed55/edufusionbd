-- Match the fn_register_student baseline: SECURITY DEFINER write RPCs must not be
-- callable by the anon role. Postgres grants EXECUTE to PUBLIC by default on
-- CREATE FUNCTION, so revoke it and re-grant only to authenticated + service_role.
revoke execute on function public.fn_register_teacher(jsonb) from public, anon;
revoke execute on function public.fn_update_teacher(jsonb) from public, anon;
grant execute on function public.fn_register_teacher(jsonb) to authenticated, service_role;
grant execute on function public.fn_update_teacher(jsonb) to authenticated, service_role;

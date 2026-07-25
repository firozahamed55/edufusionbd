-- ===== Create a covering index for every FK column lacking one (leading-column) =====
do $$
declare r record;
begin
  for r in
    select cl.relname as tbl, a.attname as col
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = a.attnum
      )
  loop
    execute format('create index if not exists %I on public.%I (%I);',
                   left('ix_'||r.tbl||'_'||r.col, 63), r.tbl, r.col);
  end loop;
end $$;

-- ===== Replace global read+write policies with per-command policies (no multiple-permissive on SELECT) =====
do $$
declare t text;
begin
  foreach t in array array['education_board','division','district','upazila','plan','permission','sms_package','enum_label']
  loop
    execute format('drop policy if exists global_read on public.%1$s;', t);
    execute format('drop policy if exists global_write on public.%1$s;', t);
    execute format('create policy global_select on public.%1$s for select to authenticated using (true);', t);
    execute format('create policy global_insert on public.%1$s for insert to authenticated with check ((select private.is_platform_admin()));', t);
    execute format('create policy global_update on public.%1$s for update to authenticated using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));', t);
    execute format('create policy global_delete on public.%1$s for delete to authenticated using ((select private.is_platform_admin()));', t);
  end loop;
end $$;

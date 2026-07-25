
insert into storage.buckets (id, name, public)
values ('institution-assets', 'institution-assets', false)
on conflict (id) do nothing;

-- Path convention: institution-assets/{institution_id}/... — scope every operation to the caller's own institution.
create policy "institution_assets_select" on storage.objects for select to authenticated
  using (bucket_id = 'institution-assets' and (storage.foldername(name))[1] = private.current_institution_id()::text);

create policy "institution_assets_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'institution-assets' and (storage.foldername(name))[1] = private.current_institution_id()::text);

create policy "institution_assets_update" on storage.objects for update to authenticated
  using (bucket_id = 'institution-assets' and (storage.foldername(name))[1] = private.current_institution_id()::text);

create policy "institution_assets_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'institution-assets' and (storage.foldername(name))[1] = private.current_institution_id()::text);

-- Fotos subidas desde la app: lectura pública (la web las enseña), escritura solo para editores.
-- La app ya las sube comprimidas a WebP (1600 y 800 px), así que el límite de 5 MB sobra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "editores: ver fotos" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (select public.es_editor()));
create policy "editores: subir fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (select public.es_editor()));
create policy "editores: cambiar fotos" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (select public.es_editor()));
create policy "editores: borrar fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (select public.es_editor()));

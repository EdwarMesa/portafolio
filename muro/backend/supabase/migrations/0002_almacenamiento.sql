-- Buckets de Supabase Storage (requiere el esquema "storage" de Supabase; no se valida en local).
insert into storage.buckets (id, name, public) values ('vistas', 'vistas', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('originales', 'originales', false) on conflict do nothing;

-- "vistas": lectura pública (miniaturas y vistas previas 720×1600).
create policy vistas_leer on storage.objects for select using (bucket_id = 'vistas');
create policy vistas_admin on storage.objects for all
  using (bucket_id = 'vistas' and public.es_admin()) with check (bucket_id = 'vistas' and public.es_admin());

-- "originales": sin lectura para anon/authenticated. Solo la función descarga-firmada (service_role)
-- genera URLs firmadas de pocos minutos tras comprobar tiene_derecho().
create policy originales_admin on storage.objects for all
  using (bucket_id = 'originales' and public.es_admin()) with check (bucket_id = 'originales' and public.es_admin());

-- Pruebas de seguridad del esquema: catálogo, ruta privada, derechos, RLS y auditoría.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create schema pruebas;
grant usage on schema pruebas to anon, authenticated;
create function pruebas.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok  %', msg;
end $$;
grant execute on function pruebas.ok(boolean, text) to anon, authenticated;

-- Datos (como service_role / administrador de base de datos)
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-0000000000ad');
insert into public.administradores values ('00000000-0000-0000-0000-0000000000ad');
insert into public.categorias (id, nombre) values ('cyberpunk', 'Cyberpunk');
insert into public.colecciones (id, nombre, tipo, producto_id, precio_centimos, publicada_en)
  values ('neon', 'Neón Nocturno', 'pack', 'col_neon', 499, now() - interval '1 day');
insert into public.fondos (id, titulo, autor, categoria_id, coleccion_id, ancho, alto, acceso, precio_centimos, estado, publicado_en, ruta_vista, ruta_original) values
  ('libre',    'Libre',    'Estudio', 'cyberpunk', null,  1080, 2400, 'gratis',      null, 'publicado',  now() - interval '2 day', 'v/libre.webp', 'o/libre.webp'),
  ('pago',     'Pago',     'Estudio', 'cyberpunk', 'neon',1080, 2400, 'premium',     199,  'publicado',  now() - interval '2 day', 'v/pago.webp',  'o/pago.webp'),
  ('plus',     'Plus',     'Estudio', 'cyberpunk', null,  1080, 2400, 'suscripcion', null, 'publicado',  now() - interval '2 day', 'v/plus.webp',  'o/plus.webp'),
  ('futuro',   'Futuro',   'Estudio', 'cyberpunk', 'neon',1080, 2400, 'premium',     199,  'programado', now() + interval '20 day','v/f.webp',     'o/f.webp'),
  ('borrador', 'Borrador', 'Estudio', 'cyberpunk', null,  1080, 2400, 'gratis',      null, 'borrador',   null,                     'v/b.webp',     'o/b.webp');

-- 1. Visitante anónimo
set role anon;
select pruebas.ok((select count(*) from public.fondos) = 3, 'anon solo ve los 3 fondos publicados');
select pruebas.ok(public.tiene_derecho('libre'), 'anon tiene derecho a un fondo gratuito');
select pruebas.ok(not public.tiene_derecho('pago'), 'anon NO tiene derecho a un fondo prémium');
select pruebas.ok(not public.tiene_derecho('borrador'), 'nadie tiene derecho a un borrador');
do $$ begin
  perform ruta_original from public.fondos;
  raise exception 'FALLO: anon pudo leer ruta_original';
exception when insufficient_privilege then raise notice 'ok  anon no puede leer la ruta del original';
end $$;
insert into public.eventos (sesion, tipo, fondo_id) values ('s1', 'vista', 'libre');
select pruebas.ok((select count(*) from public.eventos) = 0, 'anon puede registrar eventos pero no leerlos');
reset role;

-- 2. Compra de colección (la escribe el servidor tras verificar con Google Play)
insert into public.compras (usuario_id, tipo, objetivo_id, proveedor, referencia_proveedor, importe_centimos, moneda, estado)
  values ('00000000-0000-0000-0000-00000000000a', 'coleccion', 'neon', 'google_play', 'token-1', 499, 'USD', 'completada');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pruebas.ok(public.tiene_derecho('pago'), 'comprador de la colección tiene derecho a sus fondos');
select pruebas.ok(not public.tiene_derecho('futuro'), 'un fondo programado no se entrega antes de su fecha');
select pruebas.ok(not public.tiene_derecho('plus'), 'la compra de colección no incluye Muro+');
select pruebas.ok((select count(*) from public.compras) = 1, 'el comprador ve su compra');
select pruebas.ok((select array_agg(x order by x) from public.mis_derechos() x) = array['libre', 'pago'], 'mis_derechos devuelve libre y pago');
do $$ begin
  insert into public.compras (usuario_id, tipo, objetivo_id, proveedor, referencia_proveedor, importe_centimos, moneda, estado)
    values ('00000000-0000-0000-0000-00000000000a', 'fondo', 'plus', 'stripe', 'falsa', 0, 'USD', 'completada');
  raise exception 'FALLO: un cliente pudo registrarse una compra';
exception when insufficient_privilege then raise notice 'ok  un cliente no puede registrarse compras';
end $$;
insert into public.favoritos (usuario_id, fondo_id) values ('00000000-0000-0000-0000-00000000000a', 'libre');
do $$ begin
  insert into public.favoritos (usuario_id, fondo_id) values ('00000000-0000-0000-0000-00000000000b', 'libre');
  raise exception 'FALLO: se pudo escribir un favorito ajeno';
exception when insufficient_privilege then raise notice 'ok  no se pueden escribir favoritos de otro usuario';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pruebas.ok(not public.tiene_derecho('pago'), 'otro usuario no hereda la compra');
select pruebas.ok((select count(*) from public.compras) = 0, 'otro usuario no ve compras ajenas');
select pruebas.ok((select count(*) from public.favoritos) = 0, 'otro usuario no ve favoritos ajenos');
reset role;

-- 3. Suscripción: activa, caducada
insert into public.suscripciones (usuario_id, producto_id, proveedor, referencia_proveedor, estado, vence_en)
  values ('00000000-0000-0000-0000-00000000000b', 'muro_plus_mensual', 'google_play', 'sub-1', 'activa', now() + interval '20 day');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pruebas.ok(public.tiene_derecho('plus'), 'suscripción activa da acceso a fondos Muro+');
select pruebas.ok(not public.tiene_derecho('pago'), 'la suscripción no incluye fondos prémium individuales');
reset role;
update public.suscripciones set vence_en = now() - interval '1 minute' where referencia_proveedor = 'sub-1';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pruebas.ok(not public.tiene_derecho('plus'), 'suscripción caducada retira el acceso');
reset role;

-- 4. Reembolso
update public.compras set estado = 'reembolsada' where referencia_proveedor = 'token-1';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pruebas.ok(not public.tiene_derecho('pago'), 'un reembolso retira el acceso');
do $$ begin
  update public.fondos set titulo = 'pirata' where id = 'libre';
  if found then raise exception 'FALLO: un usuario normal modificó el catálogo'; end if;
  raise notice 'ok  un usuario normal no puede modificar el catálogo';
end $$;

-- 5. Administración y auditoría
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
update public.fondos set titulo = 'Libre (editado)' where id = 'libre';
select pruebas.ok((select count(*) from public.fondos) = 5, 'el administrador ve también borradores y programados');
select pruebas.ok(exists (select 1 from public.historial_cambios where registro_id = 'libre' and accion = 'UPDATE'
                          and autor = '00000000-0000-0000-0000-0000000000ad'), 'el cambio queda en el historial con su autor');
reset role;
\o
\echo 'Todas las pruebas de seguridad pasaron'

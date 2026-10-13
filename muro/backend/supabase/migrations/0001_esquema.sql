-- Muro · esquema inicial (Supabase / PostgreSQL 15+)
-- Principios:
--   * El cliente solo LEE catálogo y sus propios datos. Compras, suscripciones y descargas
--     las escriben funciones del servidor con la clave service_role tras verificar al proveedor.
--   * La ruta del archivo original nunca se expone al cliente (privilegios por columna).
--   * Ningún dato de tarjeta pasa por aquí: los pagos los procesan Google Play o Stripe.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- catálogo
create table public.categorias (
  id          text primary key,
  nombre      text not null,
  acento      text not null default '#e2c48a',
  tema        text not null default 'contenido',
  orden       int  not null default 0
);

create table public.colecciones (
  id               text primary key,
  nombre           text not null,
  descripcion      text not null default '',
  tipo             text not null check (tipo in ('gratis', 'pack', 'exclusiva', 'lanzamiento')),
  producto_id      text unique,                       -- SKU en Google Play / precio en Stripe
  precio_centimos  int  check (precio_centimos is null or precio_centimos >= 0),
  moneda           char(3) not null default 'USD',
  publicada_en     timestamptz,
  -- Una edición limitada solo es limitada si hay un límite real que el servidor hace cumplir.
  unidades_maximas int check (unidades_maximas is null or unidades_maximas > 0),
  check (tipo = 'gratis' or precio_centimos is not null)
);

create table public.fondos (
  id               text primary key,
  titulo           text not null,
  descripcion      text not null default '',
  autor            text not null,
  categoria_id     text not null references public.categorias (id),
  coleccion_id     text references public.colecciones (id),
  etiquetas        text[] not null default '{}',
  ancho            int  not null check (ancho > 0),
  alto             int  not null check (alto > 0),
  formato          text not null default 'webp',
  acceso           text not null check (acceso in ('gratis', 'premium', 'suscripcion')),
  precio_centimos  int  check (precio_centimos is null or precio_centimos >= 0),
  moneda           char(3) not null default 'USD',
  producto_id      text unique,
  licencia         text not null default 'Uso personal en un dispositivo',
  estado           text not null default 'borrador' check (estado in ('borrador', 'programado', 'publicado', 'retirado')),
  publicado_en     timestamptz,
  ruta_vista       text not null,                    -- bucket público "vistas" (720×1600)
  ruta_original    text not null,                    -- bucket privado "originales"
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  check (acceso <> 'premium' or precio_centimos is not null),
  check (estado not in ('programado', 'publicado') or publicado_en is not null)
);
create index fondos_publicados on public.fondos (publicado_en desc) where estado = 'publicado';
create index fondos_categoria on public.fondos (categoria_id);

-- ---------------------------------------------------------------- usuarios
create table public.perfiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  nombre        text,
  personalizar  boolean not null default false,       -- consentimiento para recomendaciones
  creado_en     timestamptz not null default now()
);

create table public.administradores (
  usuario_id uuid primary key references auth.users (id) on delete cascade
);

create table public.favoritos (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  fondo_id   text not null references public.fondos (id) on delete cascade,
  creado_en  timestamptz not null default now(),
  primary key (usuario_id, fondo_id)
);

-- ---------------------------------------------------------------- comercio
create table public.compras (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references auth.users (id) on delete restrict,
  tipo                  text not null check (tipo in ('fondo', 'coleccion')),
  objetivo_id           text not null,
  proveedor             text not null check (proveedor in ('google_play', 'stripe')),
  referencia_proveedor  text not null unique,         -- purchaseToken / payment_intent: idempotencia
  importe_centimos      int  not null check (importe_centimos >= 0),
  moneda                char(3) not null,
  estado                text not null check (estado in ('pendiente', 'completada', 'reembolsada', 'cancelada', 'fallida')),
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
create index compras_usuario on public.compras (usuario_id);

create table public.suscripciones (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references auth.users (id) on delete restrict,
  producto_id           text not null,
  proveedor             text not null check (proveedor in ('google_play', 'stripe')),
  referencia_proveedor  text not null unique,
  estado                text not null check (estado in ('activa', 'en_gracia', 'en_espera', 'cancelada', 'expirada')),
  vence_en              timestamptz not null,
  renovacion_automatica boolean not null default true,
  actualizado_en        timestamptz not null default now()
);
create index suscripciones_usuario on public.suscripciones (usuario_id);

create table public.descargas (
  id         bigint generated always as identity primary key,
  usuario_id uuid references auth.users (id) on delete set null,
  fondo_id   text not null references public.fondos (id),
  creado_en  timestamptz not null default now()
);

-- Eventos de producto mínimos para métricas (sin datos personales en "datos").
create table public.eventos (
  id         bigint generated always as identity primary key,
  usuario_id uuid references auth.users (id) on delete set null,
  sesion     text not null,
  tipo       text not null check (tipo in ('vista', 'favorito', 'descarga', 'compra_iniciada', 'compra_completada', 'compra_fallida')),
  fondo_id   text,
  datos      jsonb not null default '{}',
  creado_en  timestamptz not null default now()
);

create table public.historial_cambios (
  id          bigint generated always as identity primary key,
  tabla       text not null,
  registro_id text not null,
  accion      text not null,
  antes       jsonb,
  despues     jsonb,
  autor       uuid,
  creado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------- funciones
create function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.administradores where usuario_id = auth.uid());
$$;

-- ¿Puede el usuario actual descargar el original? Única fuente de verdad del acceso.
create function public.tiene_derecho(p_fondo text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.fondos f
    where f.id = p_fondo and f.estado = 'publicado' and f.publicado_en <= now()
      and (
        f.acceso = 'gratis'
        or exists (select 1 from public.compras c
                   where c.usuario_id = auth.uid() and c.estado = 'completada'
                     and ((c.tipo = 'fondo' and c.objetivo_id = f.id)
                       or (c.tipo = 'coleccion' and c.objetivo_id = f.coleccion_id)))
        or (f.acceso = 'suscripcion' and exists (
                   select 1 from public.suscripciones s
                   where s.usuario_id = auth.uid() and s.estado in ('activa', 'en_gracia') and s.vence_en > now()))
      )
  );
$$;

-- Ids de fondos a los que el usuario actual tiene acceso (para pintar la interfaz).
create function public.mis_derechos() returns setof text
language sql stable security definer set search_path = public as $$
  select f.id from public.fondos f where public.tiene_derecho(f.id);
$$;

create function public.tocar_actualizado() returns trigger language plpgsql as $$
begin new.actualizado_en := now(); return new; end $$;

create trigger fondos_actualizado before update on public.fondos for each row execute function public.tocar_actualizado();
create trigger compras_actualizado before update on public.compras for each row execute function public.tocar_actualizado();
create trigger suscripciones_actualizado before update on public.suscripciones for each row execute function public.tocar_actualizado();

create function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.historial_cambios (tabla, registro_id, accion, antes, despues, autor)
  values (tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', '?'),
          tg_op,
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end,
          auth.uid());
  return coalesce(new, old);
end $$;

create trigger fondos_auditoria after insert or update or delete on public.fondos for each row execute function public.auditar();
create trigger colecciones_auditoria after insert or update or delete on public.colecciones for each row execute function public.auditar();
create trigger compras_auditoria after insert or update or delete on public.compras for each row execute function public.auditar();

-- ---------------------------------------------------------------- seguridad (RLS)
alter table public.categorias        enable row level security;
alter table public.colecciones       enable row level security;
alter table public.fondos            enable row level security;
alter table public.perfiles          enable row level security;
alter table public.administradores   enable row level security;
alter table public.favoritos         enable row level security;
alter table public.compras           enable row level security;
alter table public.suscripciones     enable row level security;
alter table public.descargas         enable row level security;
alter table public.eventos           enable row level security;
alter table public.historial_cambios enable row level security;

-- Catálogo: lectura pública de lo publicado; escritura solo administradores.
create policy categorias_leer on public.categorias for select using (true);
create policy categorias_admin on public.categorias for all using (public.es_admin()) with check (public.es_admin());
create policy colecciones_leer on public.colecciones for select using (true);
create policy colecciones_admin on public.colecciones for all using (public.es_admin()) with check (public.es_admin());
create policy fondos_leer on public.fondos for select
  using ((estado = 'publicado' and publicado_en <= now()) or public.es_admin());
create policy fondos_admin on public.fondos for all using (public.es_admin()) with check (public.es_admin());

-- La ruta del original no se puede leer desde el cliente: privilegios por columna.
revoke select on public.fondos from anon, authenticated;
grant select (id, titulo, descripcion, autor, categoria_id, coleccion_id, etiquetas, ancho, alto, formato,
              acceso, precio_centimos, moneda, producto_id, licencia, estado, publicado_en, ruta_vista,
              creado_en, actualizado_en)
  on public.fondos to anon, authenticated;

-- Datos personales: cada usuario solo ve y edita lo suyo.
create policy perfiles_propio on public.perfiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy favoritos_propio on public.favoritos for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy compras_leer_propias on public.compras for select using (usuario_id = auth.uid() or public.es_admin());
create policy suscripciones_leer_propias on public.suscripciones for select using (usuario_id = auth.uid() or public.es_admin());
create policy descargas_leer_propias on public.descargas for select using (usuario_id = auth.uid() or public.es_admin());
-- Compras, suscripciones y descargas: sin políticas de escritura → solo service_role (funciones del servidor).

create policy eventos_insertar on public.eventos for insert to anon, authenticated
  with check (usuario_id is null or usuario_id = auth.uid());
create policy eventos_admin on public.eventos for select using (public.es_admin());
create policy historial_admin on public.historial_cambios for select using (public.es_admin());
create policy administradores_admin on public.administradores for select using (public.es_admin());

grant execute on function public.tiene_derecho(text), public.mis_derechos(), public.es_admin() to anon, authenticated;

-- =====================================================================
--  José Carrizo e Hijos · Web y Pileteros de confianza
--  Base de datos (Supabase) · 01 · Esquema, seguridad y datos iniciales
--  Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. PERFILES  (uno por cada usuario registrado)
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  nombre      text,
  telefono    text,
  rol         text not null default 'cliente' check (rol in ('cliente','admin')),
  creado      timestamptz not null default now()
);

-- Crea el perfil automáticamente cuando alguien se registra
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, telefono)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'nombre', ''),
          coalesce(new.raw_user_meta_data->>'telefono', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_registrarse on auth.users;
create trigger al_registrarse after insert on auth.users
  for each row execute function public.crear_perfil();

-- ¿El usuario actual es administrador?
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- ---------------------------------------------------------------------
-- 2. PRODUCTOS  (suscripción, paquetes digitales, combos y químicos)
-- ---------------------------------------------------------------------
create table if not exists public.productos (
  id           text primary key,                       -- ej.: 'suscripcion', 'paquete-shock', 'combo-basico'
  tipo         text not null check (tipo in ('suscripcion','paquete','combo','quimico')),
  nombre       text not null,
  descripcion  text,
  precio       numeric(12,2),                          -- en pesos; null = "Consultar"
  descuento_transferencia numeric(5,2) not null default 10,  -- % de descuento por transferencia
  mp_plan_id   text,                                   -- id del plan en Mercado Pago (suscripción)
  imagen       text,
  activo       boolean not null default true,
  orden        int not null default 0
);

-- ---------------------------------------------------------------------
-- 3. MÓDULOS Y CLASES  (el contenido de la videoteca)
-- ---------------------------------------------------------------------
create table if not exists public.modulos (
  id           text primary key,                       -- ej.: 'pasos', 'shock'
  titulo       text not null,
  descripcion  text,
  producto_id  text not null references public.productos(id),  -- qué compra da acceso
  estado       text not null default 'disponible' check (estado in ('disponible','nuevo','proximamente')),
  bunny_coleccion_id text,                             -- colección de Bunny (para sincronizar)
  colores      text[] not null default array['#2E86FF','#041437'],
  orden        int not null default 0
);

create table if not exists public.clases (
  id             uuid primary key default gen_random_uuid(),
  modulo_id      text not null references public.modulos(id) on delete cascade,
  titulo         text not null,
  descripcion    text,
  bunny_video_id text unique,                          -- "Video ID" de Bunny (se protege: no se expone)
  duracion_seg   int,
  orden          int not null default 0,
  gratis         boolean not null default false,       -- clase de muestra, la ve cualquiera
  publicada      boolean not null default true,
  publicar_desde timestamptz,                          -- para programar una clase
  creada         timestamptz not null default now()
);
create index if not exists clases_modulo_idx on public.clases (modulo_id, orden);

-- Orden automático por título: "Introducción" = 0, "Paso N" = N
create or replace function public.orden_por_titulo(t text)
returns int language sql immutable as $$
  select case
    when t ~* '^\s*intro' then 0
    when t ~* 'paso\s*\d+' then (regexp_match(t, '(?i)paso\s*(\d+)'))[1]::int
    when t ~* '^\s*\d+' then (regexp_match(t, '^\s*(\d+)'))[1]::int
    else 1000
  end;
$$;

create or replace function public.clases_orden_auto()
returns trigger language plpgsql as $$
begin
  if new.orden is null or new.orden = 0 then
    new.orden := public.orden_por_titulo(new.titulo);
  end if;
  return new;
end $$;
drop trigger if exists clases_orden on public.clases;
create trigger clases_orden before insert or update of titulo on public.clases
  for each row execute function public.clases_orden_auto();

-- ---------------------------------------------------------------------
-- 4. SUSCRIPCIONES, COMPRAS Y PEDIDOS
-- ---------------------------------------------------------------------
create table if not exists public.suscripciones (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references public.perfiles(id) on delete cascade,
  producto_id        text not null default 'suscripcion' references public.productos(id),
  estado             text not null default 'pendiente'
                     check (estado in ('pendiente','activa','pausada','cancelada')),
  origen             text not null default 'mercadopago' check (origen in ('mercadopago','transferencia','cortesia')),
  mp_preapproval_id  text unique,                      -- id de la suscripción en Mercado Pago
  vence              timestamptz,                      -- para altas manuales (transferencia/cortesía)
  proximo_cobro      timestamptz,
  creada             timestamptz not null default now(),
  actualizada        timestamptz not null default now()
);
create index if not exists suscripciones_usuario_idx on public.suscripciones (usuario_id);

create table if not exists public.compras (               -- paquetes digitales (pago único)
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.perfiles(id) on delete cascade,
  producto_id    text not null references public.productos(id),
  estado         text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada','reintegrada')),
  metodo         text not null default 'mercadopago' check (metodo in ('mercadopago','transferencia','cortesia')),
  monto          numeric(12,2),
  mp_payment_id  text unique,
  creada         timestamptz not null default now()
);
create index if not exists compras_usuario_idx on public.compras (usuario_id);

create table if not exists public.pedidos (               -- combos y químicos (con envío)
  id             uuid primary key default gen_random_uuid(),
  numero         bigint generated always as identity,
  usuario_id     uuid references public.perfiles(id) on delete set null,
  nombre         text,
  telefono       text,
  direccion      text,
  items          jsonb not null default '[]',         -- [{producto_id, nombre, cantidad, precio}]
  total          numeric(12,2),
  metodo         text not null default 'whatsapp' check (metodo in ('mercadopago','transferencia','whatsapp')),
  estado         text not null default 'nuevo' check (estado in ('nuevo','pagado','enviado','entregado','cancelado')),
  mp_payment_id  text,
  creado         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. PROGRESO  (qué clases vio cada usuario)
-- ---------------------------------------------------------------------
create table if not exists public.progreso (
  usuario_id   uuid not null references public.perfiles(id) on delete cascade,
  clase_id     uuid not null references public.clases(id) on delete cascade,
  visto        boolean not null default true,
  segundos     int not null default 0,
  actualizado  timestamptz not null default now(),
  primary key (usuario_id, clase_id)
);

-- ---------------------------------------------------------------------
-- 6. ACCESO  (¿puede el usuario actual ver un producto?)
-- ---------------------------------------------------------------------
create or replace function public.tiene_acceso(p_producto text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.es_admin()
    or exists (
      select 1 from public.suscripciones s
      where s.usuario_id = auth.uid() and s.producto_id = p_producto
        and s.estado = 'activa' and (s.vence is null or s.vence > now()))
    or exists (
      select 1 from public.compras c
      where c.usuario_id = auth.uid() and c.producto_id = p_producto and c.estado = 'aprobada');
$$;

-- Lo que el usuario actual tiene: suscripción y compras (para la web)
create or replace function public.mi_acceso()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'logueado', auth.uid() is not null,
    'admin', public.es_admin(),
    'perfil', (select row_to_json(p) from (select nombre, email, telefono from public.perfiles where id = auth.uid()) p),
    'suscripcion', (select row_to_json(s) from (
        select estado, origen, vence, proximo_cobro from public.suscripciones
        where usuario_id = auth.uid() order by actualizada desc limit 1) s),
    'productos', coalesce((select json_agg(distinct x.id) from public.productos x where public.tiene_acceso(x.id)), '[]'::json)
  );
$$;

-- ---------------------------------------------------------------------
-- 7. CATÁLOGO PARA LA VIDEOTECA (sin exponer los Video ID)
-- ---------------------------------------------------------------------
create or replace function public.catalogo()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(m order by m.orden), '[]'::json) from (
    select mo.id, mo.titulo, mo.descripcion, mo.estado, mo.colores, mo.orden,
           pr.id as producto_id, pr.tipo, pr.nombre as producto, pr.precio,
           public.tiene_acceso(pr.id) as acceso,
           coalesce((
             select json_agg(json_build_object(
                      'id', c.id, 'titulo', c.titulo, 'descripcion', c.descripcion,
                      'duracion', c.duracion_seg, 'gratis', c.gratis,
                      'tiene_video', c.bunny_video_id is not null,
                      'visto', exists (select 1 from public.progreso g where g.clase_id = c.id and g.usuario_id = auth.uid() and g.visto))
                    order by c.orden, c.titulo)
             from public.clases c
             where c.modulo_id = mo.id and c.publicada
               and (c.publicar_desde is null or c.publicar_desde <= now() or public.es_admin())
           ), '[]'::json) as clases
    from public.modulos mo join public.productos pr on pr.id = mo.producto_id
  ) m;
$$;

-- ---------------------------------------------------------------------
-- 8. VER UN VIDEO  (devuelve el link firmado de Bunny, vence en 2 horas)
--    Necesita el secreto "bunny_token_key" en Supabase → Vault.
-- ---------------------------------------------------------------------
create or replace function public.ver_clase(p_clase uuid)
returns json language plpgsql stable security definer set search_path = public, vault as $$
declare
  c record; v_key text; v_exp bigint; v_lib text := '812383';
begin
  select cl.*, mo.producto_id into c
  from public.clases cl join public.modulos mo on mo.id = cl.modulo_id where cl.id = p_clase;
  if not found then raise exception 'Clase inexistente'; end if;
  if not (c.gratis or public.tiene_acceso(c.producto_id)) then
    return json_build_object('ok', false, 'motivo', 'sin_acceso');
  end if;
  if c.bunny_video_id is null then
    return json_build_object('ok', false, 'motivo', 'sin_video');
  end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'bunny_token_key' limit 1;
  v_exp := extract(epoch from now() + interval '2 hours')::bigint;
  if v_key is null then   -- sin protección por token todavía
    return json_build_object('ok', true, 'url',
      format('https://iframe.mediadelivery.net/embed/%s/%s', v_lib, c.bunny_video_id));
  end if;
  return json_build_object('ok', true, 'url', format(
    'https://iframe.mediadelivery.net/embed/%s/%s?token=%s&expires=%s', v_lib, c.bunny_video_id,
    encode(digest(v_key || c.bunny_video_id || v_exp::text, 'sha256'), 'hex'), v_exp));
end $$;

-- Marcar una clase como vista / no vista
create or replace function public.marcar_visto(p_clase uuid, p_visto boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if p_visto then
    insert into public.progreso (usuario_id, clase_id, visto) values (auth.uid(), p_clase, true)
    on conflict (usuario_id, clase_id) do update set visto = true, actualizado = now();
  else
    delete from public.progreso where usuario_id = auth.uid() and clase_id = p_clase;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 9. SEGURIDAD (RLS): cada usuario ve solo lo suyo; el admin ve todo
-- ---------------------------------------------------------------------
alter table public.perfiles      enable row level security;
alter table public.productos     enable row level security;
alter table public.modulos       enable row level security;
alter table public.clases        enable row level security;
alter table public.suscripciones enable row level security;
alter table public.compras       enable row level security;
alter table public.pedidos       enable row level security;
alter table public.progreso      enable row level security;

-- Perfiles
drop policy if exists perfil_propio on public.perfiles;
create policy perfil_propio on public.perfiles for select using (id = auth.uid() or public.es_admin());
drop policy if exists perfil_editar on public.perfiles;
create policy perfil_editar on public.perfiles for update using (id = auth.uid() or public.es_admin())
  with check (public.es_admin() or rol = (select p.rol from public.perfiles p where p.id = auth.uid()));  -- nadie se hace admin solo

-- Productos y módulos: lectura pública, edición solo admin
drop policy if exists productos_leer on public.productos;
create policy productos_leer on public.productos for select using (activo or public.es_admin());
drop policy if exists productos_admin on public.productos;
create policy productos_admin on public.productos for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists modulos_leer on public.modulos;
create policy modulos_leer on public.modulos for select using (true);
drop policy if exists modulos_admin on public.modulos;
create policy modulos_admin on public.modulos for all using (public.es_admin()) with check (public.es_admin());

-- Clases: solo el admin lee la tabla directa (la web usa catalogo() y ver_clase())
drop policy if exists clases_admin on public.clases;
create policy clases_admin on public.clases for all using (public.es_admin()) with check (public.es_admin());

-- Suscripciones y compras: el usuario ve las suyas; las crea/actualiza el sistema (Mercado Pago) o el admin
drop policy if exists susc_propias on public.suscripciones;
create policy susc_propias on public.suscripciones for select using (usuario_id = auth.uid() or public.es_admin());
drop policy if exists susc_admin on public.suscripciones;
create policy susc_admin on public.suscripciones for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists compras_propias on public.compras;
create policy compras_propias on public.compras for select using (usuario_id = auth.uid() or public.es_admin());
drop policy if exists compras_admin on public.compras;
create policy compras_admin on public.compras for all using (public.es_admin()) with check (public.es_admin());

-- Pedidos: cualquiera puede crear (incluso sin cuenta); ve los suyos; el admin gestiona
drop policy if exists pedidos_crear on public.pedidos;
create policy pedidos_crear on public.pedidos for insert with check (usuario_id is null or usuario_id = auth.uid());
drop policy if exists pedidos_propios on public.pedidos;
create policy pedidos_propios on public.pedidos for select using (usuario_id = auth.uid() or public.es_admin());
drop policy if exists pedidos_admin on public.pedidos;
create policy pedidos_admin on public.pedidos for update using (public.es_admin()) with check (public.es_admin());

-- Progreso
drop policy if exists progreso_propio on public.progreso;
create policy progreso_propio on public.progreso for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Permisos de las funciones para la web
grant execute on function public.catalogo(), public.mi_acceso(), public.tiene_acceso(text),
  public.ver_clase(uuid), public.es_admin() to anon, authenticated;
grant execute on function public.marcar_visto(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 10. DATOS INICIALES
-- ---------------------------------------------------------------------
insert into public.productos (id, tipo, nombre, descripcion, precio, orden) values
  ('suscripcion',   'suscripcion', 'Pileteros de confianza', 'Suscripción mensual: todas las clases y capacitaciones.', null, 1),
  ('paquete-shock', 'paquete',     'Tratamiento de shock', 'Diagnóstico y tratamiento correctivo para piletas turbias y verdes.', null, 2),
  ('combo-basico',  'combo',       'Combo básico de mantenimiento', '1 kg cloro granulado 70% o 90%, 5 L regulador de pH −, 1 kg pastillas multiacción y 1 L clarificador.', null, 3),
  ('cloro-1kg',     'quimico',     'Cloro granulado 70% / 90% · 1 kg', null, null, 4),
  ('ph-menos-5l',   'quimico',     'Regulador de pH − · 5 L', null, null, 5),
  ('pastillas-1kg', 'quimico',     'Pastillas multiacción · 1 kg', null, null, 6),
  ('clarificador-1l','quimico',    'Clarificador · 1 L', null, null, 7)
on conflict (id) do nothing;

insert into public.modulos (id, titulo, descripcion, producto_id, estado, colores, orden) values
  ('pasos', 'Los 12 pasos del piletero', 'El método para hacer cada visita de mantenimiento de forma correcta, desde que llegás a la casa hasta que te vas.', 'suscripcion', 'disponible', array['#2E86FF','#041437'], 1),
  ('shock', 'Tratamiento de shock', 'Diagnóstico y tratamiento correctivo para recuperar piletas turbias y verdes: qué medir, qué productos usar, en qué orden y en qué dosis.', 'paquete-shock', 'nuevo', array['#5AA2FF','#0B2F86'], 2),
  ('quimica', 'Química de la pileta', 'Cloro, pH, alguicidas y clarificantes: qué, cuánto y cuándo.', 'suscripcion', 'proximamente', array['#8CC8FF','#1450C8'], 3),
  ('tipos', 'Tipos de piletas', 'Hormigón, fibra, lona y revestimientos.', 'suscripcion', 'proximamente', array['#B9DEFF','#1F63E8'], 4),
  ('filtrado', 'Sistemas de filtrado', 'Filtros de arena y cartucho, bombas y válvula selectora.', 'suscripcion', 'proximamente', array['#3D8BFF','#06205C'], 5),
  ('reparaciones', 'Reparaciones y equipos', 'Cambio de arena del filtro Vulcano BC30, y más.', 'suscripcion', 'proximamente', array['#9FD0FF','#0A2A78'], 6)
on conflict (id) do nothing;

-- Las 13 clases de "Los 12 pasos" (el Video ID se completa después, a mano o sincronizando con Bunny)
insert into public.clases (modulo_id, titulo, gratis)
select 'pasos', t, t = 'Introducción'
from unnest(array['Introducción','Paso 1','Paso 2','Paso 3','Paso 4','Paso 5','Paso 6',
                  'Paso 7','Paso 8','Paso 9','Paso 10','Paso 11','Paso 12']) as t
where not exists (select 1 from public.clases where modulo_id = 'pasos');

-- ---------------------------------------------------------------------
-- 11. DESPUÉS DE REGISTRARTE EN LA WEB, hacete administrador:
--   update public.perfiles set rol = 'admin' where email = 'josecarrizoehijos@gmail.com';
-- ---------------------------------------------------------------------

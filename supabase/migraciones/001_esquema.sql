-- Sequer A Fuego Lento · esquema de contenido de la web.
-- Las tablas reflejan exactamente las claves de datos/contenido.json: la web se genera de una «foto» de todas ellas.

create table public.ajustes (
  id int primary key default 1 check (id = 1),         -- fila única
  datos jsonb not null,                                 -- contacto, horarios, parking, aviso…
  actualizado timestamptz not null default now()
);

create table public.categorias (
  id text primary key,
  carta text not null check (carta in ('carta', 'almuerzos')),
  nombre text not null check (length(trim(nombre)) > 0),
  nota text,
  pendiente text,                                       -- texto del hueco «pendiente» en la web; null = completa
  visible boolean not null default true,
  orden int not null default 0,
  traducciones jsonb not null default '{}'
);

create table public.fotos (
  id text primary key,
  src text not null,                                    -- «fotos/salon» (repo) o URL pública de Storage, sin «-ancho.webp»
  anchos int[] not null check (cardinality(anchos) > 0),
  alt text not null default '',
  categoria text not null default 'espacio' check (categoria in ('arroces', 'carta', 'almuerzos', 'espacio', 'eventos', 'agenda')),
  foco text not null default '50% 50%',
  en_galeria boolean not null default true,
  uso text,                                             -- si tiene sitio fijo en la web: no se puede borrar, solo reemplazar
  orden int not null default 0,
  traducciones jsonb not null default '{}'
);

create table public.platos (
  id text primary key,
  categoria_id text not null references public.categorias (id) on update cascade on delete restrict,
  nombre text not null check (length(trim(nombre)) > 0),
  descripcion text,
  precio numeric(7, 2) check (precio >= 0),
  precio_texto text,                                    -- «S/M»
  por_persona boolean not null default false,
  alergenos text[] not null default '{}',
  etiquetas text[] not null default '{}',
  foto_id text references public.fotos (id) on delete set null,
  disponible boolean not null default true,
  visible boolean not null default true,
  orden int not null default 0,
  traducciones jsonb not null default '{}'
);
create index platos_categoria on public.platos (categoria_id);
create index platos_foto on public.platos (foto_id);

create table public.menus (
  id text primary key,
  tipo text not null check (tipo in ('mediodia', 'boda', 'comunion', 'grupo', 'coctel')),
  nombre text not null check (length(trim(nombre)) > 0),
  descripcion text,
  precio_persona numeric(7, 2) check (precio_persona >= 0),
  minimo int check (minimo > 0),
  tiempos jsonb not null default '[]',                  -- [{ "titulo": "Entrantes", "platos": ["…"] }]
  incluye text,
  notas text,
  pendiente text,
  visible boolean not null default true,
  orden int not null default 0,
  traducciones jsonb not null default '{}'
);

create table public.agenda (
  id text primary key,
  titulo text not null check (length(trim(titulo)) > 0),
  fecha date not null,
  hora_inicio text,
  hora_fin text,
  descripcion text,
  foto_id text references public.fotos (id) on delete set null,
  acceso text not null default 'libre' check (acceso in ('libre', 'reserva', 'entrada')),
  precio_texto text,
  visible boolean not null default true,
  orden int not null default 0,
  traducciones jsonb not null default '{}'
);
create index agenda_foto on public.agenda (foto_id);

-- Cada «Publicar» guarda aquí la foto completa del contenido. La web se genera siempre de la última.
create table public.publicaciones (
  version bigint generated always as identity primary key,
  snapshot jsonb not null,
  creado timestamptz not null default now(),
  autor text,
  resumen text,
  estado text not null default 'enviada' check (estado in ('enviada', 'error'))
);

-- Quién puede entrar en la app (por email). Se da de alta a mano o desde el panel.
create table public.editores (
  email text primary key check (email = lower(email)),
  nombre text,
  creado timestamptz not null default now()
);

-- marca de última edición en ajustes
create function public.tocar_actualizado() returns trigger language plpgsql set search_path = '' as $$
begin new.actualizado := now(); return new; end $$;
create trigger ajustes_actualizado before update on public.ajustes for each row execute function public.tocar_actualizado();

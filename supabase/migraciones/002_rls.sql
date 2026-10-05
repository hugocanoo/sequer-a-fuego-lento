-- Seguridad: solo los emails de «editores» leen y escriben el contenido.
-- El público (clave anónima) solo puede leer la ÚLTIMA publicación, que es lo que ya sale en la web.

create function public.es_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.editores
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.es_editor() from public;
grant execute on function public.es_editor() to authenticated;

-- devuelve la versión publicada más reciente sin pasar por RLS (evita la recursión en la política)
create function public.ultima_version() returns bigint
language sql stable security definer set search_path = '' as $$
  select max(version) from public.publicaciones;
$$;
revoke all on function public.ultima_version() from public;
grant execute on function public.ultima_version() to anon, authenticated;

alter table public.ajustes enable row level security;
alter table public.categorias enable row level security;
alter table public.fotos enable row level security;
alter table public.platos enable row level security;
alter table public.menus enable row level security;
alter table public.agenda enable row level security;
alter table public.publicaciones enable row level security;
alter table public.editores enable row level security;   -- sin políticas: nadie la lee desde fuera

-- defensa en profundidad: la clave anónima no toca el contenido de trabajo
revoke all on public.ajustes, public.categorias, public.fotos, public.platos, public.menus, public.agenda, public.editores from anon;
revoke insert, update, delete on public.publicaciones from anon, authenticated;   -- solo la función «publicar» (service role)

create policy "editores: ajustes" on public.ajustes for all to authenticated
  using ((select public.es_editor())) with check ((select public.es_editor()));
create policy "editores: categorias" on public.categorias for all to authenticated
  using ((select public.es_editor())) with check ((select public.es_editor()));
create policy "editores: fotos" on public.fotos for all to authenticated
  using ((select public.es_editor())) with check ((select public.es_editor()));
create policy "editores: platos" on public.platos for all to authenticated
  using ((select public.es_editor())) with check ((select public.es_editor()));
create policy "editores: menus" on public.menus for all to authenticated
  using ((select public.es_editor())) with check ((select public.es_editor()));
create policy "editores: agenda" on public.agenda for all to authenticated
  using ((select public.es_editor())) with check ((select public.es_editor()));

create policy "público: última publicación" on public.publicaciones for select to anon, authenticated
  using (version = (select public.ultima_version()));
create policy "editores: historial" on public.publicaciones for select to authenticated
  using ((select public.es_editor()));

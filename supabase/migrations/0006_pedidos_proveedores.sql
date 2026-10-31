-- M4 Pedidos a proveedores (RF-19 a RF-22): registro e historial de pedidos.
-- Los avisos antes de la hora de corte siguen siendo obligaciones (seed.sql).
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

create table public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  supplier text not null check (length(trim(supplier)) > 0),
  for_date date not null,              -- día en que llega / se usa el pedido
  quantity numeric(10, 2) not null check (quantity > 0),
  unit text not null,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index supplier_orders_supplier_date on public.supplier_orders (supplier, for_date desc);

-- Todo el equipo hace pedidos (Beto: harinas; Majo: champiñón y etiquetas).
alter table public.supplier_orders enable row level security;
create policy "ver pedidos" on public.supplier_orders for select to authenticated using (true);
create policy "registrar pedidos" on public.supplier_orders for insert to authenticated
  with check (created_by = auth.uid());
create policy "borrar pedidos (quien lo hizo o admin)" on public.supplier_orders for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

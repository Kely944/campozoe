-- M2 Corporación Favorita (RF-08 a RF-13).
-- Solo la administradora usa este módulo; el equipo recibe los avisos como tareas.
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

-- Datos fijos del negocio (una sola fila).
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  supplier_code text,                              -- código de proveedor en Favorita
  acopio text not null default 'CAF 400 (Loja)',   -- centro de acopio
  van_capacity int not null default 100 check (van_capacity > 0) -- javas por viaje (RF-11)
);
insert into public.app_settings (id) values (1);

create table public.favorita_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  barcode text,
  product_code text,
  units_per_java int not null check (units_per_java > 0),
  grams_per_unit int check (grams_per_unit > 0),   -- M6: gramos cocidos por unidad
  dry_yield numeric(4, 2) check (dry_yield >= 1),  -- M6: el grano aumenta N veces al cocinarse
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Oferta semanal: enlace (llega el lunes) y javas por producto y día de entrega.
create table public.favorita_offers (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique check (extract(isodow from week_start) = 1),
  link text,
  created_at timestamptz not null default now()
);

create table public.favorita_offer_items (
  offer_id uuid not null references public.favorita_offers (id) on delete cascade,
  product_id uuid not null references public.favorita_products (id) on delete cascade,
  delivery_day smallint not null check (delivery_day in (3, 5)), -- miércoles o viernes
  javas int not null check (javas > 0),
  sent boolean not null default false,             -- formulario de este producto ya enviado
  primary key (offer_id, product_id, delivery_day)
);

-- Órdenes de compra recibidas y su factura.
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  week int not null check (week between 1 and 53),
  delivery_at timestamptz not null,
  driver_id uuid references public.profiles (id) on delete set null,
  notes text,
  delivered_at timestamptz,
  invoice_number text,
  invoice_amount numeric(12, 2) check (invoice_amount > 0),
  invoiced_at timestamptz,
  delivery_obligation_id uuid references public.obligations (id) on delete set null,
  invoice_obligation_id uuid references public.obligations (id) on delete set null,
  created_at timestamptz not null default now()
);
create index purchase_orders_delivery on public.purchase_orders (delivery_at desc);

create table public.purchase_order_items (
  order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid not null references public.favorita_products (id) on delete restrict,
  units int not null check (units > 0),
  primary key (order_id, product_id)
);

alter table public.app_settings enable row level security;
alter table public.favorita_products enable row level security;
alter table public.favorita_offers enable row level security;
alter table public.favorita_offer_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy "ver ajustes" on public.app_settings for select to authenticated using (true);
create policy "editar ajustes (admin)" on public.app_settings for update to authenticated using (public.is_admin());
create policy "productos (admin)" on public.favorita_products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ofertas (admin)" on public.favorita_offers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "items de oferta (admin)" on public.favorita_offer_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ordenes (admin)" on public.purchase_orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "items de orden (admin)" on public.purchase_order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

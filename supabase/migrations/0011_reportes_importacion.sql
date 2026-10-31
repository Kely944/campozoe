-- M7 Reportes (RF-31 a RF-33): datos importados del facturador y del historial 2019–2023.
-- Solo la administradora (datos financieros, RNF-04 y RNF-06).
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sold_on date not null,
  customer text not null,
  product text not null,
  units numeric(12, 2) not null,
  amount numeric(12, 2) not null,
  document text,
  import_key text not null unique,   -- evita duplicar ventas al importar el mismo archivo otra vez
  imported_at timestamptz not null default now()
);
create index sales_sold_on on public.sales (sold_on);

create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null unique,
  price numeric(12, 2),
  updated_at timestamptz not null default now()
);

-- Foto de las cuentas por cobrar del facturador: cada importación reemplaza la anterior.
create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  document text,
  issued_on date,
  due_on date,
  balance numeric(12, 2) not null check (balance > 0),
  imported_at timestamptz not null default now()
);

alter table public.sales enable row level security;
alter table public.catalog_products enable row level security;
alter table public.receivables enable row level security;
create policy "ventas importadas (admin)" on public.sales for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "catalogo (admin)" on public.catalog_products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "cuentas por cobrar (admin)" on public.receivables for all to authenticated using (public.is_admin()) with check (public.is_admin());

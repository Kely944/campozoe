-- M3 Pagos y préstamos (RF-15 a RF-18).
-- RNF-04: solo la administradora (Majo) ve montos de préstamos, pagos y cheques.
-- El aviso para transferir es una obligación mensual vinculada (sin monto, cuenta enmascarada).
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

-- Origen de cada obligación: 'manual' (creada en Tareas) o el módulo que la generó.
alter table public.obligations add column source text not null default 'manual';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('prestamo', 'proveedor', 'trabajador', 'otro')),
  name text not null check (length(trim(name)) > 0),
  bank text,
  amount numeric(12, 2) not null check (amount > 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  debit_account text,
  notice_days smallint not null default 3 check (notice_days between 0 and 15),
  active boolean not null default true,
  notes text,
  obligation_id uuid references public.obligations (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.cheques (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  bank text,
  beneficiary text not null,
  amount numeric(12, 2) not null check (amount > 0),
  issued_on date not null,
  cash_on date not null check (cash_on >= issued_on),
  status text not null default 'emitido' check (status in ('emitido', 'cobrado', 'anulado')),
  notes text,
  created_at timestamptz not null default now()
);
create index cheques_cash_on on public.cheques (cash_on);

alter table public.payments enable row level security;
alter table public.cheques enable row level security;
create policy "pagos (solo admin)" on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "cheques (solo admin)" on public.cheques for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

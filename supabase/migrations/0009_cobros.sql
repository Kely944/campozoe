-- M5 Cuentas por cobrar informales (RF-23 a RF-27).
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

-- RF-24: a los cuántos días se avisa un cobro pendiente (pregunta abierta; audio 2: "pasado dos semanas").
alter table public.app_settings add column credit_days int not null default 14 check (credit_days between 1 and 90);

-- RF-23: ventas fiadas a mercados (sin datos tributarios).
create table public.credit_sales (
  id uuid primary key default gen_random_uuid(),
  customer text not null check (length(trim(customer)) > 0),  -- nombre o puesto
  amount numeric(12, 2) not null check (amount > 0),
  sold_on date not null default (now() at time zone 'America/Guayaquil')::date,
  seller_id uuid default auth.uid() references public.profiles (id) on delete set null,
  paid_on date,
  paid_by uuid references public.profiles (id) on delete set null,
  notes text,
  obligation_id uuid references public.obligations (id) on delete set null,
  created_at timestamptz not null default now()
);
create index credit_sales_pending on public.credit_sales (customer) where paid_on is null;

alter table public.credit_sales enable row level security;
create policy "ver ventas a credito" on public.credit_sales for select to authenticated using (true);
-- Cada vendedor registra a su nombre; la administradora puede registrar por otro.
create policy "registrar venta a credito" on public.credit_sales for insert to authenticated
  with check (seller_id = auth.uid() or public.is_admin());
create policy "corregir venta (admin)" on public.credit_sales for update to authenticated using (public.is_admin());
create policy "borrar venta (admin)" on public.credit_sales for delete to authenticated using (public.is_admin());

-- RF-24: al registrar la venta se crea el aviso de cobro (los operativos no pueden crear obligaciones).
-- Vence a las 10:00 del día X; el vendedor recibe aviso 1 h antes y, si sigue pendiente,
-- el aviso de "vencida" llega al vendedor y a la administradora (respaldo).
create function public.credit_sale_reminder() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  days int;
  admin_id uuid;
  due timestamptz;
  ob_id uuid;
begin
  select credit_days into days from app_settings where id = 1;
  select id into admin_id from profiles where role = 'admin' order by created_at limit 1;
  due := ((new.sold_on + coalesce(days, 14))::timestamp + time '10:00') at time zone 'America/Guayaquil';
  -- Venta registrada tarde (ya pasó el plazo): avisar enseguida.
  if due < now() then due := now() + interval '10 minutes'; end if;

  insert into obligations (title, description, frequency, due_at, reminder_offsets_min, repeat_every_min,
                           responsible_id, backup_id, priority, source)
  values (
    'Cobrar a ' || new.customer || ': $' || to_char(new.amount, 'FM999999990.00'),
    'Venta a crédito del ' || to_char(new.sold_on, 'DD/MM/YYYY') || '. Marcar "Cobrado" en Cobros cuando pague.',
    'once', due, '{60}', null,
    coalesce(new.seller_id, admin_id),
    case when new.seller_id is distinct from admin_id then admin_id end,
    'normal', 'cobro'
  )
  returning id into ob_id;
  new.obligation_id := ob_id;
  return new;
end;
$$;

create trigger credit_sale_reminder
  before insert on public.credit_sales
  for each row execute function public.credit_sale_reminder();

-- Marcar cobrado: el vendedor o la administradora. Cierra el aviso para que no llegue.
create function public.mark_credit_paid(sale_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s credit_sales;
begin
  select * into s from credit_sales where id = sale_id;
  if s.id is null or auth.uid() is null or not (s.seller_id = auth.uid() or public.is_admin()) then
    raise exception 'No autorizado';
  end if;
  if s.paid_on is not null then return; end if;
  update credit_sales
     set paid_on = (now() at time zone 'America/Guayaquil')::date, paid_by = auth.uid()
   where id = sale_id;
  update occurrences set status = 'done', done_by = auth.uid(), done_at = now(), done_via = 'app'
   where obligation_id = s.obligation_id and status = 'pending';
  update obligations set active = false where id = s.obligation_id;
end;
$$;

revoke execute on function public.mark_credit_paid(uuid) from public, anon;
grant execute on function public.mark_credit_paid(uuid) to authenticated;
revoke execute on function public.credit_sale_reminder() from public, anon, authenticated;

-- RF-26: facturas marcadas para vigilar el plazo de nota de crédito (solo admin).
create table public.credit_note_watch (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  customer text,
  issued_on date not null,
  reason text,
  resolved_at timestamptz,
  obligation_id uuid references public.obligations (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.credit_note_watch enable row level security;
create policy "notas de credito (admin)" on public.credit_note_watch for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- RF-27: pagos de Favorita conciliados contra las facturas de sus órdenes (solo admin).
create table public.favorita_payments (
  id uuid primary key default gen_random_uuid(),
  received_on date not null,
  amount numeric(12, 2) not null check (amount > 0),
  reference text,          -- número de cheque o transferencia
  notes text,
  created_at timestamptz not null default now()
);
alter table public.favorita_payments enable row level security;
create policy "pagos favorita (admin)" on public.favorita_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.purchase_orders
  add column payment_id uuid references public.favorita_payments (id) on delete set null;

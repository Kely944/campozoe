-- Correcciones de seguridad de M5 (revisión de código del 31-oct-2026).
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

-- 1) Si el vendedor fue borrado (seller_id NULL), la condición daba NULL y no se rechazaba:
--    cualquier usuario podía marcar esa venta como cobrada. coalesce(…, false) lo cierra.
create or replace function public.mark_credit_paid(sale_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s credit_sales;
begin
  select * into s from credit_sales where id = sale_id;
  if s.id is null or auth.uid() is null or not coalesce(s.seller_id = auth.uid() or public.is_admin(), false) then
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

-- 2) Una venta nueva nunca nace "cobrada": el cobro solo se registra con mark_credit_paid.
create or replace function public.credit_sale_reminder() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  days int;
  admin_id uuid;
  due timestamptz;
  ob_id uuid;
begin
  new.paid_on := null;
  new.paid_by := null;
  select credit_days into days from app_settings where id = 1;
  select id into admin_id from profiles where role = 'admin' order by created_at limit 1;
  due := ((new.sold_on + coalesce(days, 14))::timestamp + time '10:00') at time zone 'America/Guayaquil';
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

-- 3) "Hecho" sobre un aviso de cobro registra el cobro (mismos permisos que en Cobros);
--    antes cerraba el aviso y la venta quedaba pendiente sin volver a avisar.
create or replace function public.mark_done(occurrence_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  sale uuid;
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  select cs.id into sale
    from occurrences o join credit_sales cs on cs.obligation_id = o.obligation_id
   where o.id = mark_done.occurrence_id and cs.paid_on is null;
  if sale is not null then
    perform public.mark_credit_paid(sale);
    return;
  end if;
  update occurrences
     set status = 'done', done_by = auth.uid(), done_at = now(), done_via = 'app'
   where id = mark_done.occurrence_id and status = 'pending';
end;
$$;

-- Deshacer un aviso de cobro también deshace el cobro y vuelve a activar el aviso.
create or replace function public.undo_done(occurrence_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  ob uuid;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;
  update occurrences
     set status = 'pending', done_by = null, done_at = null, done_via = null
   where id = undo_done.occurrence_id and status = 'done'
     and (done_by = auth.uid() or public.is_admin())
  returning obligation_id into ob;
  if ob is not null then
    update credit_sales set paid_on = null, paid_by = null where obligation_id = ob and paid_on is not null;
    if found then
      update obligations set active = true where id = ob;
    end if;
  end if;
end;
$$;

-- M6 Producción, RF-29: agenda de cocción de granos (lunes para el martes, jueves para el viernes).
-- El aviso del día anterior (16 h antes) recuerda remojar el grano; la cantidad está en Producción.
-- Hora 08:00 a confirmar con Majo. No duplica si ya existen.
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

insert into public.obligations
  (title, description, frequency, time_of_day, weekdays, reminder_offsets_min, repeat_every_min, priority, source)
select v.title, v.description, 'weekly', '08:00', v.weekdays, '{960,60}', 60, 'normal', 'produccion'
from (values
  ('Cocinar granos para el martes', 'Remojar el grano el día anterior. Cuánto grano: ver Producción.', '{1}'::smallint[]),
  ('Cocinar granos para el viernes', 'Remojar el grano el día anterior. Cuánto grano: ver Producción.', '{4}'::smallint[])
) as v(title, description, weekdays)
where not exists (select 1 from public.obligations o where o.title = v.title);

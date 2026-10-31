-- RF-21: pedidos que se hacen 1 o 2 veces por mes (etiquetas).
-- Segundo día opcional para la frecuencia mensual.
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

alter table public.obligations
  add column extra_day_of_month smallint check (extra_day_of_month between 1 and 31);

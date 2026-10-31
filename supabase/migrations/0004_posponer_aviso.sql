-- "Recordar en 1 h": el botón de WhatsApp pausa la insistencia hasta esta hora.
-- Solo lo escribe el webhook (service role); la app no puede actualizar ocurrencias.
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

alter table public.occurrences add column snoozed_until timestamptz;

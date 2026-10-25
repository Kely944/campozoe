-- Fallos de envío de avisos, para el panel de administración.
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.
-- Solo escribe el cron (service role); la administradora puede leer.

create table public.notification_failures (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.occurrences (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  slot text not null,
  error text not null,
  failed_at timestamptz not null default now()
);
create index notification_failures_failed_at on public.notification_failures (failed_at);
alter table public.notification_failures enable row level security;
create policy "ver fallos (admin)" on public.notification_failures
  for select to authenticated using (public.is_admin());

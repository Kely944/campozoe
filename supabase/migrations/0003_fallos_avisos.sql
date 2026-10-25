-- Fallos de envío de avisos, para el panel de administración.
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.
-- Una fila por aviso (ocurrencia, slot, destinatario) con su contador de intentos:
-- el cron reintenta cada 5 minutos y no debe llenar la tabla.
-- Solo escribe el cron (service role) mediante log_notification_failure; la administradora puede leer.

create table public.notification_failures (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.occurrences (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  slot text not null,
  error text not null,
  attempts int not null default 1,
  failed_at timestamptz not null default now(),
  unique (occurrence_id, slot, recipient_id)
);
create index notification_failures_failed_at on public.notification_failures (failed_at);
alter table public.notification_failures enable row level security;
create policy "ver fallos (admin)" on public.notification_failures
  for select to authenticated using (public.is_admin());

-- Registra un intento fallido: crea la fila o suma un intento y guarda el último error.
create function public.log_notification_failure(p_occurrence uuid, p_recipient uuid, p_slot text, p_error text)
returns void language sql security definer set search_path = public as $$
  insert into notification_failures (occurrence_id, recipient_id, slot, error)
  values (p_occurrence, p_recipient, p_slot, p_error)
  on conflict (occurrence_id, slot, recipient_id)
  do update set attempts = notification_failures.attempts + 1, error = excluded.error, failed_at = now();
$$;
revoke execute on function public.log_notification_failure(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.log_notification_failure(uuid, uuid, text, text) to service_role;

-- M1 Recordatorios y avisos
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

-- Perfiles (uno por usuario de Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text, -- formato internacional sin "+", ej. 593991234567
  role text not null default 'operativo' check (role in ('admin', 'operativo')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Obligaciones: lo que hay que hacer y cuándo
create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  frequency text not null check (frequency in ('once', 'daily', 'weekly', 'monthly')),
  due_at timestamptz,          -- solo 'once'
  time_of_day time,            -- hora local (America/Guayaquil)
  weekdays smallint[],         -- 0 = domingo; 'daily' y 'weekly'
  day_of_month smallint check (day_of_month between 1 and 31),
  starts_on date not null default current_date,
  reminder_offsets_min int[] not null default '{1440,120}',
  repeat_every_min int,        -- null = no repetir
  escalate_before_min int,     -- null = no escalar al respaldo
  responsible_id uuid references public.profiles (id) on delete set null,
  backup_id uuid references public.profiles (id) on delete set null,
  priority text not null default 'normal' check (priority in ('normal', 'alta')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (frequency = 'once' and due_at is not null)
    or (frequency in ('daily', 'weekly') and time_of_day is not null)
    or (frequency = 'monthly' and time_of_day is not null and day_of_month is not null)
  )
);

-- Ocurrencias: cada vencimiento concreto de una obligación
create table public.occurrences (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.obligations (id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  done_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz,
  done_via text check (done_via in ('app', 'whatsapp')),
  unique (obligation_id, due_at)
);
create index occurrences_pending_due on public.occurrences (due_at) where status = 'pending';

-- Avisos enviados (evita duplicados: un slot por destinatario)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.occurrences (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  slot text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'simulated')),
  provider_message_id text,
  sent_at timestamptz not null default now(),
  unique (occurrence_id, slot, recipient_id)
);

-- Seguridad (RLS). El cron y el webhook usan la service role key y no pasan por RLS.
alter table public.profiles enable row level security;
alter table public.obligations enable row level security;
alter table public.occurrences enable row level security;
alter table public.notifications enable row level security;

create policy "perfiles visibles" on public.profiles for select to authenticated using (true);
create policy "editar perfiles (admin)" on public.profiles for update to authenticated using (public.is_admin());

create policy "ver obligaciones" on public.obligations for select to authenticated using (true);
create policy "crear obligaciones (admin)" on public.obligations for insert to authenticated with check (public.is_admin());
create policy "editar obligaciones (admin)" on public.obligations for update to authenticated using (public.is_admin());
create policy "borrar obligaciones (admin)" on public.obligations for delete to authenticated using (public.is_admin());

create policy "ver ocurrencias" on public.occurrences for select to authenticated using (true);
create policy "marcar ocurrencias" on public.occurrences for update to authenticated using (true);
create policy "crear ocurrencias (admin)" on public.occurrences for insert to authenticated with check (public.is_admin());
create policy "borrar ocurrencias (admin)" on public.occurrences for delete to authenticated using (public.is_admin());

create policy "ver avisos (admin)" on public.notifications for select to authenticated using (public.is_admin());

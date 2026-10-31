-- RNF-03: correo como alternativa a WhatsApp.
-- Se usa si la persona no tiene WhatsApp registrado o si el envío por WhatsApp falla.
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- Los usuarios nuevos copian su correo de inicio de sesión (editable en Equipo).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$;

-- Por qué canal salió cada aviso (para el panel).
alter table public.notifications add column channel text not null default 'whatsapp' check (channel in ('whatsapp', 'email'));

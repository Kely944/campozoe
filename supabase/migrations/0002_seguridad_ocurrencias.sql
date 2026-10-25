-- Seguridad: marcar "hecho" solo a través de funciones.
-- Antes cualquier usuario podía cambiar cualquier columna de una ocurrencia
-- (fecha, obligación, o poner a otra persona en done_by).
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

drop policy "marcar ocurrencias" on public.occurrences;

-- Marca la ocurrencia como hecha; done_by siempre es el usuario actual.
create function public.mark_done(occurrence_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  update occurrences
     set status = 'done', done_by = auth.uid(), done_at = now(), done_via = 'app'
   where id = occurrence_id and status = 'pending';
end;
$$;

-- Deshace "hecho": solo quien la marcó o una administradora.
create function public.undo_done(occurrence_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;
  update occurrences
     set status = 'pending', done_by = null, done_at = null, done_via = null
   where id = occurrence_id and status = 'done'
     and (done_by = auth.uid() or public.is_admin());
end;
$$;

revoke execute on function public.mark_done(uuid) from public, anon;
revoke execute on function public.undo_done(uuid) from public, anon;
grant execute on function public.mark_done(uuid) to authenticated;
grant execute on function public.undo_done(uuid) to authenticated;

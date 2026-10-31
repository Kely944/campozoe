#!/usr/bin/env bash
# RNF-06: respaldo diario de la base de datos, cifrado antes de salir del servidor.
# Uso: SUPABASE_DB_URL=... BACKUP_PASSPHRASE=... scripts/respaldo.sh [carpeta_salida]
# Genera respaldo-AAAA-MM-DD.sql.gz.gpg: usuarios (auth.users, auth.identities) y todo el esquema public
# (tablas, datos, funciones, políticas RLS y permisos).
# Restaurar en un proyecto de Supabase nuevo y vacío (sin correr las migraciones), con el usuario postgres:
#   gpg -d respaldo-AAAA-MM-DD.sql.gz.gpg | gunzip | psql "$URL_DESTINO"
set -euo pipefail

: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL (Supabase > Project Settings > Database > Connection string)}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE (clave para cifrar el respaldo)}"
out="${1:-.}"
mkdir -p "$out"
file="$out/respaldo-$(TZ=America/Guayaquil date +%F).sql.gz.gpg"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# pg_dump de la misma versión mayor que Supabase (17), desde la imagen oficial de Postgres.
dump() { docker run --rm --network host postgres:17 pg_dump "$SUPABASE_DB_URL" --no-owner "$@"; }

# Primero los usuarios (solo datos: el proyecto destino ya trae las tablas de auth),
# luego el esquema public completo con sus permisos (sin ellos la app no puede leer).
dump --data-only --column-inserts --table=auth.users --table=auth.identities > "$tmp"
dump --schema=public >> "$tmp"
# El trigger que crea el perfil de cada usuario nuevo vive en auth.users: se recrea al restaurar.
echo "create or replace trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();" >> "$tmp"

gzip -9 < "$tmp" | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" -o "$file"
echo "Respaldo listo: $file ($(du -h "$file" | cut -f1))"

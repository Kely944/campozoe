# PROGRESO

## Línea base (31-oct-2026, antes de cambios)

- `node_modules` estaba incompleto (sin `.bin`): se ejecutó `npm ci`.
- `npm test`: 4 archivos, **56 tests OK**.
- `npm run lint`: sin errores.
- `npm run build`: OK (11 rutas).
- No hay `.env.local`. Hay Docker: se usa **Supabase local** (`npx supabase start`) para probar migraciones, RLS y pantallas; nunca el proyecto de producción.
- El árbol tenía cambios sin commit (función "Recordar en 1 h", migración 0004, CLAUDE.md): se guardaron en el primer commit de la rama.

## Bitácora

- 09:25 Supabase local levantado (migraciones 0001–0005 + seed OK). Usuarios de prueba majo/beto/kelly `@prueba.local` creados por la API admin local. Verificación en navegador con Playwright + Chrome instalado (la extensión Claude in Chrome no estaba conectada).
- 09:30 **P0** RF-05 (hora de "hecho"), RF-06 verificado, RF-21 (segundo día del mes, migración 0005). Tests 58 OK, lint OK, build OK.

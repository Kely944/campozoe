# DECISIONES

Formato: decisión · alternativas · por qué.

1. **Trabajo previo sin commit se guardó en un commit propio al inicio de la rama.** Alternativas: descartarlo (pierde trabajo) o mezclarlo con el primer item (oculta autoría). Así queda separado y revisable.
2. **Probar con Supabase local (Docker) en vez de solo tests.** Alternativa: solo tests/lint/build. Docker estaba disponible; el stack local no toca producción y permite verificar migraciones, RLS y pantallas reales.
3. **RNF-07 (costo bajo) = No aplica en código.** Es una decisión de infraestructura ya cubierta en `Costos_app_Majo.xlsx` (Vercel/Supabase gratis o Pro, cron por `pg_cron`). Se mantiene: sin servicios pagos nuevos y sin dependencias de pago.
4. **CIE-2 (capacitación) = No aplica.** Es una actividad presencial; se deja el manual (CIE-1) para apoyarla.
5. **`supabase/config.toml`: `[auth.email] enable_signup = true`.** Con `false`, la CLI apaga el proveedor de correo y nadie puede iniciar sesión en local (`email_provider_disabled`). El registro público lo sigue bloqueando `[auth] enable_signup = false`; verificado: `POST /auth/v1/signup` → `signup_disabled`. En producción la opción del panel *Allow new users to sign up* debe seguir desactivada.
6. **`.env.local` solo con las claves demo públicas de `supabase start`** (no son credenciales reales) y `CRON_SECRET=local-pruebas`. Está en `.gitignore`. Se agregó la excepción `!.env.example`.
7. **RF-21 "1 o 2 veces por mes": columna `extra_day_of_month`** en vez de un arreglo de días. Alternativas: arreglo `days_of_month` (más general, formulario más complejo) o dos tareas separadas (duplica avisos y responsables). El requerimiento solo pide hasta 2 veces; un segundo campo opcional es lo más simple para Majo.
8. **Verificación visual con Playwright (Chrome instalado)**: la extensión de Chrome no estaba conectada. Scripts en el scratchpad de la sesión, no en el repo.

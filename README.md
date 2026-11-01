# Pendientes Majo

Aplicación web (PWA) para el negocio de Majo (Loja): avisa por WhatsApp los plazos (oferta a Corporación Favorita, pedidos de champiñón y etiquetas, cuotas de préstamos, cobros) y sigue avisando hasta que alguien marca la tarea como hecha; si sigue pendiente, avisa al respaldo. Además lleva pedidos, cobros, pagos, producción y reportes.

Stack: Next.js 15 + Supabase (PostgreSQL, Auth) + WhatsApp Business Cloud API (+ correo por Resend como alternativa). Hosting sugerido: Vercel.

Manual para usuarios: [`docs/manual-de-uso.md`](docs/manual-de-uso.md). Despliegue a producción paso a paso: [`docs/despliegue.md`](docs/despliegue.md). Estado de cada requerimiento: [`CHECKLIST.md`](CHECKLIST.md).

## Módulos

| Módulo | Requerimientos | Pantalla |
| --- | --- | --- |
| M1 Recordatorios y avisos | RF-01 a RF-07 | `/` (Hoy), `/obligaciones`, `/admin` |
| M2 Corporación Favorita | RF-08 a RF-14 | `/favorita`, `/favorita/productos`, `/favorita/ordenes/nueva` |
| M3 Pagos y préstamos | RF-15 a RF-18 | `/pagos` (solo administradora) |
| M4 Pedidos a proveedores | RF-19 a RF-22 | `/pedidos` |
| M5 Cuentas por cobrar | RF-23 a RF-27 | `/cobros`, `/cobros/favorita` |
| M6 Producción | RF-28 a RF-30 | `/produccion` |
| M7 Reportes | RF-31 a RF-33 | `/reportes` (importa .xlsx/.csv del facturador) |

Sin avisos entre 21:00 y 07:00 (hora de Ecuador). Si una tarea no tiene responsable, el aviso va a la administradora. Montos de préstamos, pagos, Favorita y reportes: solo la administradora (RLS).

## Puesta en marcha

1. **Supabase**: crear un proyecto en supabase.com. En *SQL Editor* ejecutar, **en orden**, todos los archivos de `supabase/migrations/` (`0001_…` a `0013_…`) y luego `supabase/seed.sql`.
   **Importante:** en *Authentication > Sign In / Providers* desactivar *Allow new users to sign up*. Si queda activo, cualquiera con la URL puede crearse una cuenta y ver las tareas. Los usuarios se crean solo desde el panel.
2. **Usuarios**: en *Authentication > Users* crear el usuario de Majo (correo y contraseña). Hacerla administradora:
   ```sql
   update profiles set role = 'admin', full_name = 'Majo', phone = '593XXXXXXXXX' where id = (select id from auth.users where email = 'correo-de-majo@ejemplo.com');
   ```
   Crear también a Beto y Kelly; sus teléfonos se cargan desde la pantalla *Equipo*.
3. **Variables**: copiar `.env.example` a `.env.local` y completar las claves de Supabase y `CRON_SECRET` (WhatsApp y correo son opcionales).
4. **Local**:
   ```bash
   npm install
   npm run dev      # http://localhost:3000
   npm test         # pruebas de la lógica de recordatorios
   ```
   Sin credenciales de WhatsApp los avisos se muestran en la consola como `[WhatsApp simulado]`. Para disparar el ciclo a mano:
   ```bash
   curl -H "Authorization: Bearer TU_CRON_SECRET" http://localhost:3000/api/cron/reminders
   ```
5. **Vercel**: importar el repositorio y cargar las mismas variables.
6. **Cron cada 5 minutos**: el plan gratis de Vercel solo permite cron diario, así que se usa Supabase. Activar las extensiones `pg_cron` y `pg_net` y ejecutar `supabase/cron.sql` con la URL y el secreto reales.

## WhatsApp (Meta)

1. Crear una app en developers.facebook.com con el producto WhatsApp y un número exclusivo para el sistema (no puede estar en uso en la app de WhatsApp).
2. Crear y hacer aprobar la plantilla `recordatorio_tarea` (categoría *Utility*, idioma español):
   - Cuerpo: `Recordatorio de Pendientes. {{1}}: {{2}}. Vence: {{3}}.`
   - Botones de respuesta rápida, en este orden: `Hecho` y `Recordar en 1 h`
   - Aprobar la plantilla con los dos botones **antes** de desplegar: el envío manda ambos y Meta rechaza el mensaje si la plantilla tiene uno solo.
3. Cargar `WHATSAPP_TOKEN` (token permanente de usuario del sistema), `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_APP_SECRET`.
4. Webhook: URL `https://TU-APP.vercel.app/api/whatsapp/webhook`, token de verificación = `WHATSAPP_VERIFY_TOKEN`, suscribirse a `messages`.

El botón "Hecho" solo marca la tarea si el número que responde es del responsable, del respaldo o de una administradora. "Recordar en 1 h" (mismos permisos) pausa los avisos al responsable durante una hora y avisa apenas termina; el aviso al respaldo y el de vencida no se pausan.

## Instalar en el celular

Abrir la URL en Chrome (Android) o Safari (iPhone) y elegir *Agregar a pantalla de inicio*.

## Correo alternativo (opcional)

Si una persona no tiene WhatsApp registrado o el envío por WhatsApp falla, el aviso sale por correo. Crear una cuenta en resend.com, verificar el dominio y cargar `RESEND_API_KEY` y `EMAIL_FROM` (ej. `Pendientes <avisos@tu-dominio.com>`). Sin esas variables el correo se simula en la consola (`[Correo simulado]`).

## Respaldo diario

`.github/workflows/respaldo-diario.yml` corre todos los días a las 03:00 (Ecuador) y guarda por 30 días un respaldo cifrado (AES-256) de la base. Secretos del repositorio: `SUPABASE_DB_URL` (Project Settings > Database > Connection string) y `BACKUP_PASSPHRASE` (guárdala también fuera de GitHub). Restaurar en un proyecto nuevo y vacío:

```bash
gpg -d respaldo-AAAA-MM-DD.sql.gz.gpg | gunzip | psql "URL_DEL_PROYECTO_NUEVO"
```

También se puede correr a mano: `SUPABASE_DB_URL=… BACKUP_PASSPHRASE=… bash scripts/respaldo.sh` (necesita Docker y gpg).

## Desarrollo local con Supabase en Docker

```bash
npx supabase start          # aplica migraciones y seed
npm run dev
```
Crear usuarios de prueba con la API admin local o el Studio; el registro público está desactivado también en local (`supabase/config.toml`).

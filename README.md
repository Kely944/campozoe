# Pendientes Majo – M1 Recordatorios

Aplicación web (PWA) que avisa por WhatsApp los plazos del negocio: oferta a Corporación Favorita, pedidos de champiñón y etiquetas, cuotas de préstamos. Los avisos se repiten hasta que alguien marca la tarea como hecha y, si sigue pendiente, se avisa al respaldo.

Stack: Next.js 15 + Supabase (PostgreSQL, Auth) + WhatsApp Business Cloud API. Hosting sugerido: Vercel.

## Qué incluye M1

| Requerimiento | Dónde |
| --- | --- |
| RF-01 Obligaciones con fecha, frecuencia y responsable | `/obligaciones`, tabla `obligations` |
| RF-02 Avisos por WhatsApp con anticipación configurable | `src/lib/reminders.ts`, `src/lib/whatsapp.ts` |
| RF-03 Repetir hasta marcar hecho | `planNotifications` en `src/lib/schedule.ts` |
| RF-04 Aviso al respaldo | ídem (`escalation`) |
| RF-05 Marcar hecho desde la app o el botón de WhatsApp | `/` y `/api/whatsapp/webhook` |
| RF-06 Pantalla "Hoy y esta semana" | `/` |
| RF-07 Obligaciones precargadas | `supabase/seed.sql` |

Sin avisos entre 21:00 y 07:00 (hora de Ecuador). Si una tarea no tiene responsable, el aviso va a la administradora.

## Puesta en marcha

1. **Supabase**: crear un proyecto en supabase.com. En *SQL Editor* ejecutar `supabase/migrations/0001_m1_recordatorios.sql` y luego `supabase/seed.sql`.
2. **Usuarios**: en *Authentication > Users* crear el usuario de Majo (correo y contraseña). Hacerla administradora:
   ```sql
   update profiles set role = 'admin', full_name = 'Majo', phone = '593XXXXXXXXX' where id = (select id from auth.users where email = 'correo-de-majo@ejemplo.com');
   ```
   Crear también a Beto y Kelly; sus teléfonos se cargan desde la pantalla *Equipo*.
3. **Variables**: copiar `.env.example` a `.env.local` y completar las claves de Supabase y `CRON_SECRET`.
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
   - Cuerpo: `{{1}}: {{2}}. Vence: {{3}}.`
   - Botón de respuesta rápida: `Hecho`
3. Cargar `WHATSAPP_TOKEN` (token permanente de usuario del sistema), `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_APP_SECRET`.
4. Webhook: URL `https://TU-APP.vercel.app/api/whatsapp/webhook`, token de verificación = `WHATSAPP_VERIFY_TOKEN`, suscribirse a `messages`.

El botón "Hecho" solo marca la tarea si el número que responde es del responsable, del respaldo o de una administradora.

## Instalar en el celular

Abrir la URL en Chrome (Android) o Safari (iPhone) y elegir *Agregar a pantalla de inicio*.

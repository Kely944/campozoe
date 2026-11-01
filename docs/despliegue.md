# Manual de despliegue a producción

Guía paso a paso para publicar **Pendientes** en internet: base de datos en Supabase, aplicación en Vercel, avisos por WhatsApp (Meta) y respaldo diario en GitHub. Todo cabe en los planes gratuitos.

Tiempo estimado: 1 a 2 horas (más la espera de aprobación de la plantilla de WhatsApp, que puede tardar de minutos a un día).

## Antes de empezar

Necesitas:

- Cuenta en [supabase.com](https://supabase.com) y en [vercel.com](https://vercel.com) (se puede entrar con GitHub).
- Acceso al repositorio en GitHub.
- Para WhatsApp: cuenta de Meta Business, una app en [developers.facebook.com](https://developers.facebook.com) y un **número exclusivo** para el sistema (no puede estar en uso en la app de WhatsApp).
- Correo y teléfono de Majo, Beto y Kelly.

Guarda cada clave que generes en un gestor de contraseñas. Ninguna va en el repositorio.

| Dato | Lo generas en | Se usa en |
| --- | --- | --- |
| URL y claves de Supabase | Paso 1 | Vercel |
| `CRON_SECRET` | Paso 3 | Vercel y `cron.sql` |
| `WHATSAPP_VERIFY_TOKEN` | Paso 3 | Vercel y Meta |
| Claves de WhatsApp | Paso 6 | Vercel |
| `BACKUP_PASSPHRASE` | Paso 8 | GitHub (y fuera de GitHub) |

---

## 1. Crear la base de datos (Supabase)

1. En supabase.com toca **New project**.
2. Nombre: `pendientes`. Contraseña de la base: genera una fuerte y guárdala.
3. Región: en *Specific regions* elige **East US (North Virginia) `us-east-1`**. Desde Ecuador el tráfico sale por Miami, así que es la de menor demora (São Paulo y Oregon quedan más lejos). Es además la región por defecto de Vercel.
4. Espera a que el proyecto termine de crearse.
5. Copia las claves:
   - **Integrations > Data API > API URL**, **sin** el `/rest/v1/` del final (queda `https://xxxx.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`. Deja *Enable Data API* encendido.
   - **Project Settings > API Keys > Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project Settings > API Keys > Secret keys** (`sb_secret_…`, toca el ojo para verla) → `SUPABASE_SERVICE_ROLE_KEY`. Es secreta: da acceso total a la base; pégala solo en Vercel.

   Las claves antiguas (pestaña *Legacy anon, service_role API keys*) también funcionan.

## 2. Preparar la base

### 2.1 Tablas y reglas

En **SQL Editor > New query**, abre cada archivo de `supabase/migrations/`, copia **todo su contenido** (no el nombre del archivo), pégalo y ejecútalo, **uno por uno y en orden**:

```
0001_m1_recordatorios.sql
0002_seguridad_ocurrencias.sql
0003_fallos_avisos.sql
0004_posponer_aviso.sql
0005_dos_dias_al_mes.sql
0006_pedidos_proveedores.sql
0007_pagos_prestamos.sql
0008_favorita.sql
0009_cobros.sql
0010_agenda_coccion.sql
0011_reportes_importacion.sql
0012_correo_alternativo.sql
0013_cobros_seguridad.sql
```

Cada uno debe terminar con *Success*. Si alguno falla, no sigas con el siguiente: revisa el error primero.

Después ejecuta `supabase/seed.sql`: carga las obligaciones del negocio (oferta a Favorita, pedido de champiñón, etiquetas, cuotas…). Los responsables se asignan después desde la app.

### 2.2 Cerrar el registro público

**Authentication > Sign In / Providers**: desactiva **Allow new users to sign up**.

> **Importante:** si queda activo, cualquiera con la dirección de la app puede crearse una cuenta y ver las tareas del negocio.

### 2.3 Crear los usuarios

Para cada persona (Majo, Beto, Kelly):

1. **Authentication > Users > Add user > Create new user**.
2. Correo real y una contraseña fuerte, distinta para cada uno.
3. Marca **Auto Confirm User**.

Al crearlo, la base le arma su perfil sola, con rol `operativo`.

Haz administradora a Majo en el **SQL Editor** (cambia el correo y el teléfono, con código de país y sin `+`):

```sql
update profiles
set role = 'admin', full_name = 'Majo', phone = '593XXXXXXXXX'
where id = (select id from auth.users where email = 'correo-de-majo@ejemplo.com');
```

Los nombres y teléfonos de Beto y Kelly los carga Majo después desde la pantalla **Equipo**.

Entrega a cada persona su contraseña por un canal privado. Si alguien la olvida, se cambia en **Authentication > Users**.

## 3. Generar los secretos propios

Son textos al azar que inventas tú. En una terminal:

```bash
openssl rand -hex 32   # → CRON_SECRET
openssl rand -hex 16   # → WHATSAPP_VERIFY_TOKEN
```

(Sin `openssl`, cualquier generador de contraseñas de 40 caracteres o más sirve.)

## 4. Publicar la aplicación (Vercel)

1. En vercel.com: **Add New > Project** e importa el repositorio de GitHub.
2. Framework: Next.js (lo detecta solo). No cambies los comandos de build.
3. En **Environment Variables** carga:

   | Variable | Valor | Type |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Paso 1 | **Config** |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Paso 1 | **Config** |
   | `SUPABASE_SERVICE_ROLE_KEY` | Paso 1 | Secret |
   | `CRON_SECRET` | Paso 3 | Secret |
   | `WHATSAPP_VERIFY_TOKEN` | Paso 3 | Secret |

   Marca cada una para **Production** y **Preview**. Las `NEXT_PUBLIC_*` van como **Config** porque viajan al navegador y no son secretas; si las guardas como Secret, Vercel no deja editarlas después ("Remove the public framework prefix…") y hay que borrarlas y crearlas de nuevo. Todas las demás, incluidas las de WhatsApp y correo, van como **Secret**.

   `NEXT_PUBLIC_SUPABASE_URL` es solo `https://xxxx.supabase.co`, sin `/rest/v1` ni barra al final. Si lleva `/rest/v1`, el login responde "Correo o contraseña incorrectos" aunque la contraseña esté bien (en los logs de Supabase se ven 404 en `/rest/v1/auth/v1/token`).

   Si cambias una `NEXT_PUBLIC_*` después del primer deploy, vuelve a desplegar (**Deployments > ⋯ > Redeploy**): se fijan al compilar.

   Las de WhatsApp y correo se agregan en los pasos 6 y 7. Sin ellas la app funciona, pero los avisos solo se simulan y no llega nada al celular.

4. Toca **Deploy**. Al terminar tendrás la dirección, por ejemplo `https://pendientes.vercel.app`.
5. **Settings > Functions > Function Region**: verifica que diga **Washington, D.C. (iad1)**, la misma zona que Supabase (`us-east-1`). Es el valor por defecto; si aparece otra, cámbiala y vuelve a desplegar (**Deployments > ⋯ > Redeploy**). Si quedan en regiones distintas, cada pantalla tarda más en cargar.
6. En Supabase, **Authentication > URL Configuration > Site URL**: pon la dirección de Vercel.

**Comprobar:** abre la dirección, entra con la cuenta de Majo y revisa que aparezcan las tareas del seed en **Tareas**.

## 5. Activar los avisos automáticos (cron)

El plan gratis de Vercel solo permite una tarea programada al día; por eso el ciclo de avisos lo dispara Supabase cada 5 minutos.

1. En Supabase, **Database > Extensions**: activa `pg_cron` y `pg_net`.
2. Abre `supabase/cron.sql`, reemplaza `TU-APP.vercel.app` por tu dirección y `TU_CRON_SECRET` por el del paso 3.
3. Ejecútalo en el **SQL Editor**.

**Comprobar** (después de 5 minutos):

```sql
select status_code, created from net._http_response order by created desc limit 5;
```

Debe mostrar `200`. Un `401` significa que el `CRON_SECRET` no coincide con el de Vercel.

Para quitarlo: `select cron.unschedule('m1-recordatorios');`

## 6. Conectar WhatsApp (Meta)

1. En developers.facebook.com crea una app de tipo **Business** y agrega el producto **WhatsApp**.
2. **Verifica el negocio** (Configuración del negocio > Centro de seguridad > Verificación del negocio). Meta no deja enviar ningún mensaje, ni siquiera desde el número de prueba, hasta que el negocio esté verificado: el envío falla con el error `131031 Business Account locked`. Ten listos el certificado del **RUC** y una factura de servicios o estado de cuenta con el **mismo nombre legal y dirección** que pongas en el formulario. Tarda de 1 a 14 días; mientras tanto puedes seguir con los pasos 5, 7 y 8.
3. Registra el número exclusivo del sistema.
4. Crea la plantilla en **WhatsApp Manager > Plantillas de mensajes**:
   - Nombre: `recordatorio_tarea`
   - Categoría: **Utility**, idioma: **Español**
   - Cuerpo: `Recordatorio de Pendientes. {{1}}: {{2}}. Vence: {{3}}.`
   - Botones de respuesta rápida, en este orden: `Hecho` y `Recordar en 1 h`

   Espera a que esté **aprobada** antes de seguir. La app envía los dos botones y Meta rechaza el mensaje si la plantilla tiene uno solo.
5. Crea un **usuario del sistema** en Meta Business (Configuración del negocio > Usuarios del sistema) con permiso `whatsapp_business_messaging` y genera un **token permanente**. El token temporal de la consola vence en 24 horas.
6. Carga en Vercel:

   | Variable | De dónde sale |
   | --- | --- |
   | `WHATSAPP_TOKEN` | Token permanente del punto 5 |
   | `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp > API Setup > *Phone number ID* |
   | `WHATSAPP_APP_SECRET` | App settings > Basic > *App secret* |

   `WHATSAPP_TEMPLATE` y `WHATSAPP_TEMPLATE_LANG` solo hacen falta si la plantilla tiene otro nombre o idioma (por defecto `recordatorio_tarea` y `es`).
7. Vuelve a desplegar en Vercel para que tome las variables.
8. En **WhatsApp > Configuration > Webhook**:
   - URL: `https://TU-APP.vercel.app/api/whatsapp/webhook`
   - Token de verificación: tu `WHATSAPP_VERIFY_TOKEN`
   - Suscríbete al campo `messages`.

**Comprobar:** asigna una tarea a Majo con vencimiento cercano, espera el aviso y toca **Hecho** en WhatsApp. La tarea debe aparecer como hecha en la app. Si el botón no hace nada, revisa `WHATSAPP_APP_SECRET`: sin él la app rechaza todas las respuestas.

El botón **Hecho** solo funciona si el número que responde es del responsable, del respaldo o de una administradora. Por eso los teléfonos en **Equipo** deben estar completos y correctos.

## 7. Correo alternativo (opcional)

Si una persona no tiene WhatsApp cargado o el envío falla, el aviso sale por correo.

1. Crea una cuenta en [resend.com](https://resend.com) y verifica tu dominio.
2. Carga en Vercel `RESEND_API_KEY` y `EMAIL_FROM` (ej. `Pendientes <avisos@tu-dominio.com>`) y vuelve a desplegar.

## 8. Respaldo diario (GitHub)

El workflow `.github/workflows/respaldo-diario.yml` respalda la base todos los días a las 03:00 (Ecuador), cifrada, y la guarda 30 días.

1. En Supabase, botón **Connect** (arriba): copia la cadena de **Session pooler** (no la *Direct connection*, que GitHub no alcanza) y pon tu contraseña de la base donde dice `[YOUR-PASSWORD]`.
2. En GitHub, **Settings > Secrets and variables > Actions > New repository secret**:
   - `SUPABASE_DB_URL`: la cadena anterior
   - `BACKUP_PASSPHRASE`: una frase larga que inventas tú

   > **Importante:** guarda `BACKUP_PASSPHRASE` también fuera de GitHub. Sin ella los respaldos no se pueden abrir.
3. **Actions > Respaldo diario > Run workflow** para probarlo una vez. Debe terminar en verde y dejar un archivo `respaldo-…` en la sección *Artifacts*.

Restaurar en un proyecto de Supabase **nuevo y vacío** (sin correr las migraciones):

```bash
gpg -d respaldo-AAAA-MM-DD.sql.gz.gpg | gunzip | psql "URL_DEL_PROYECTO_NUEVO"
```

## 9. Instalar en los celulares

Abrir la dirección en Chrome (Android) o Safari (iPhone) y elegir **Agregar a pantalla de inicio**.

---

## Lista final

- [ ] 13 migraciones y `seed.sql` ejecutados sin error
- [ ] Registro público **desactivado**
- [ ] Majo es `admin`; Beto y Kelly creados
- [ ] Variables cargadas en Vercel y app desplegada
- [ ] Supabase en `us-east-1` y Vercel en `iad1`
- [ ] Cron responde `200`
- [ ] Plantilla de WhatsApp aprobada y webhook verificado
- [ ] Botón **Hecho** probado desde WhatsApp
- [ ] Teléfonos cargados en **Equipo**
- [ ] Respaldo probado y `BACKUP_PASSPHRASE` guardada fuera de GitHub

## Actualizar la aplicación después

- **Cambios de código:** al subir a `main`, Vercel despliega solo.
- **Migración nueva** (`supabase/migrations/0014_…`): ejecútala en el SQL Editor de producción **antes** de subir el código que la usa.
- **Cambio de una variable:** edítala en Vercel y vuelve a desplegar.

## Problemas comunes

| Síntoma | Causa probable |
| --- | --- |
| Al entrar vuelve al login | Variables de Supabase mal copiadas en Vercel, o *Site URL* sin actualizar |
| Las pantallas tardan en cargar | Vercel y Supabase en regiones distintas (paso 4.5) |
| No llega ningún aviso | Cron sin activar o con `401` (paso 5); fuera de horario (no se avisa entre 21:00 y 07:00) |
| Los avisos dicen "simulado" en los registros de Vercel | Faltan variables de WhatsApp o no se volvió a desplegar |
| Error `131031 Business Account locked` | Falta verificar el negocio en Meta (paso 6.2) |
| Meta rechaza el mensaje | Plantilla no aprobada, con otro nombre o sin los dos botones |
| "Hecho" en WhatsApp no marca la tarea | Falta `WHATSAPP_APP_SECRET`, o el teléfono de quien responde no está en **Equipo** |
| El respaldo falla en GitHub | Se usó la cadena *Direct connection* en vez de *Session pooler* |

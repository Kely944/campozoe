# Manual de despliegue a producción

Guía paso a paso para publicar **Pendientes** en internet: base de datos en Supabase, aplicación en Vercel con dominio propio, avisos por WhatsApp (Meta) y respaldo diario en GitHub.

Tiempo estimado: 2 a 3 horas de trabajo. Aparte hay esperas de Meta: confirmar tu identidad (hasta 48 h), verificar el negocio (1 a 14 días) y aprobar la plantilla (minutos a horas). Mientras Meta revisa, la app ya funciona y puede avisar por correo.

Costos: Supabase y Vercel gratis; dominio `.com` unos $7 el primer año y ~$16 los siguientes; WhatsApp cobra cada aviso (plantillas de *Utilidad*, del orden de 1 a 2 centavos de dólar cada una en Ecuador).

## Antes de empezar

Necesitas:

- Cuenta en [supabase.com](https://supabase.com), [vercel.com](https://vercel.com) (se puede entrar con GitHub) y [namecheap.com](https://namecheap.com) (u otro registrador de dominios).
- Acceso al repositorio en GitHub.
- Cuenta de Facebook para Meta (developers.facebook.com y business.facebook.com).
- **Certificado del RUC** del negocio y una factura de servicios o estado de cuenta con el mismo nombre y dirección (los pide Meta).
- Correo y teléfono de Majo, Beto y Kelly.
- Para producción con WhatsApp: un **número exclusivo** para el sistema, que **no** esté en uso en la app de WhatsApp de ningún celular.

Guarda cada clave que generes en un gestor de contraseñas. Ninguna va en el repositorio ni en capturas de pantalla.

| Dato | Lo generas en | Se usa en |
| --- | --- | --- |
| URL y claves de Supabase | Paso 1 | Vercel |
| `CRON_SECRET` | Paso 3 | Vercel y `cron.sql` |
| `WHATSAPP_VERIFY_TOKEN` | Paso 3 | Vercel y Meta |
| Dominio propio | Paso 5 | Vercel, Supabase, cron, Meta |
| Claves de WhatsApp | Paso 7 | Vercel |
| `BACKUP_PASSPHRASE` | Paso 9 | GitHub (y fuera de GitHub) |

---

## 1. Crear la base de datos (Supabase)

1. En supabase.com toca **New project**.
2. Nombre: `pendientes`. Contraseña de la base: genera una fuerte y guárdala (la pide el respaldo del paso 9).
3. Región: en *Specific regions* elige **East US (North Virginia) `us-east-1`**. No elijas la que Supabase marca como *recommended* (Oregon) ni São Paulo: desde Ecuador el tráfico sale por Miami, así que Virginia es la de menor demora, y es también la región por defecto de Vercel. **La región no se puede cambiar después** sin crear otro proyecto.
4. Espera a que el proyecto termine de crearse.
5. Copia las claves:
   - **Integrations > Data API > API URL**, **sin** el `/rest/v1/` del final (queda `https://xxxx.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`. Deja *Enable Data API* encendido.
   - **Project Settings > API Keys > Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project Settings > API Keys > Secret keys** (`sb_secret_…`, toca el ojo para verla) → `SUPABASE_SERVICE_ROLE_KEY`. Es secreta: da acceso total a la base; pégala solo en Vercel.

   Las claves antiguas (pestaña *Legacy anon, service_role API keys*) también funcionan.

> **No pongas las claves de producción en `.env.local`.** Ese archivo es para el Supabase local (Docker); si le pones las de producción, `npm run dev` trabajará sobre los datos reales.

## 2. Preparar la base

### 2.1 Tablas y reglas

En **SQL Editor > New query** hay que pegar el **contenido** de cada archivo de `supabase/migrations/` (no su nombre: si pegas `0001_m1_recordatorios.sql`, Postgres responde `trailing junk after numeric literal`) y ejecutarlo, **uno por uno y en orden**:

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

Atajo: abre cada archivo en VS Code o el Bloc de notas, `Ctrl+A`, `Ctrl+C`, y en Supabase `Ctrl+A`, `Ctrl+V`, **Run**.

- Cada uno debe terminar con **Success. No rows returned**. Si alguno falla, no sigas con el siguiente: revisa el error primero.
- En **0002, 0003 y 0009** Supabase muestra *"Potential issue detected… destructive operations"*. Es esperado (quitan un permiso amplio y lo reemplazan por uno seguro; no borran datos): toca **Run query**.
- Ejecuta cada archivo **una sola vez**. Si lo repites falla con *already exists*.

Después ejecuta `supabase/seed.sql`, también una sola vez: carga las obligaciones del negocio (oferta a Favorita, pedido de champiñón, etiquetas, cuotas…). Los responsables se asignan después desde la app.

### 2.2 Cerrar el registro público

**Authentication > Sign In / Providers**: desactiva **Allow new users to sign up**.

> **Importante:** si queda activo, cualquiera con la dirección de la app puede crearse una cuenta y ver las tareas del negocio.

### 2.3 Crear los usuarios

La app no tiene pantalla para crear usuarios: se crean en el panel de Supabase.

Para cada persona:

1. **Authentication > Users > Add user > Create new user**.
2. Correo real y una contraseña fuerte, distinta para cada uno.
3. Marca **Auto Confirm User**.

Al crearlo, la base le arma su perfil sola, con rol `operativo`. Luego completa los perfiles en el **SQL Editor** (teléfono con código de país, **sin `+` ni espacios**: `593` + 9 dígitos):

```sql
-- Administradora
update profiles
set role = 'admin', full_name = 'Majo', phone = '5939XXXXXXXX'
where id = (select id from auth.users where lower(email) = 'correo-de-majo@ejemplo.com');

-- Operativos (uno por persona)
update profiles
set role = 'operativo', full_name = 'Kelly', phone = '5939XXXXXXXX'
where id = (select id from auth.users where lower(email) = 'correo-de-kelly@ejemplo.com');

-- Verificar: una fila por persona, con su rol y teléfono
select p.full_name, p.role, p.phone, u.email
from profiles p join auth.users u on u.id = p.id
order by p.full_name;
```

Si una persona no aparece en la verificación o le falta el teléfono, el correo del `update` no coincide con el de la cuenta. Los teléfonos también se pueden cargar después desde la pantalla **Equipo** de la app.

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

   Las de WhatsApp y correo se agregan en los pasos 7 y 8. Sin ellas la app funciona, pero los avisos solo se simulan y no llega nada al celular.

4. Toca **Deploy**. Al terminar tendrás una dirección `https://xxxx.vercel.app`.

   Si el build compila bien pero termina en **Build Failed: "Vulnerable version of Next.js detected"**, Vercel bloqueó el despliegue por seguridad: actualiza `next` (y `eslint-config-next`) a la última versión del mismo número mayor (`npm install --save-exact next@15.5.x`), corre `npm test` y `npm run build`, y sube el cambio a `main`.
5. **Settings > Functions > Function Region**: verifica que diga **Washington, D.C. (iad1)**, la misma zona que Supabase (`us-east-1`). Es el valor por defecto; si aparece otra, cámbiala y vuelve a desplegar. Si quedan en regiones distintas, cada pantalla tarda más en cargar.

**Comprobar:** abre la dirección, entra con la cuenta de Majo y revisa que aparezcan las tareas del seed en **Tareas**.

## 5. Dominio propio

Hace falta por dos motivos:

- **Meta no acepta `vercel.app`** como sitio web del negocio al verificarlo ("No puedes verificar tu negocio con un dominio de sitio web común"): es un dominio compartido.
- **Resend** (correo del paso 8) exige un dominio propio verificado para enviar desde `avisos@tu-dominio.com`.

### 5.1 Comprar

- Elige un **`.com`** con el nombre del negocio (el del RUC o el nombre comercial), por ejemplo `campozoe.com`. Evita `.online`, `.store`, `.xyz`, `.lat`: son baratos el primer año pero se renuevan a $30–45 y tienen peor reputación (Meta y los filtros de spam los miran con sospecha).
- En Namecheap: busca códigos de descuento para clientes nuevos, deja activado **Domain Privacy** (gratis) y **Auto-Renew** (si el dominio vence, la app y el correo dejan de funcionar).
- Idealmente, el dueño (*Registrant*) es el negocio o Majo; si lo compras a tu nombre, se puede transferir después.

### 5.2 Conectar a Vercel

1. Vercel, proyecto > **Settings > Domains > Add Domain**: escribe `tu-dominio.com`.
2. **Desmarca** *Redirect apex domains to www*. Deja **Connect to an environment: Production** y toca **Add Domain**.

   Por qué: el cron de Supabase y el webhook de Meta **no siguen redirecciones**. Si `tu-dominio.com` redirige a `www.tu-dominio.com`, los avisos y el botón "Hecho" fallan sin que se note. Toda la configuración usa `https://tu-dominio.com`, sin `www`.
3. Vercel muestra **Invalid Configuration**: es normal hasta configurar el DNS.
4. Namecheap > **Domain List > Manage > Advanced DNS**:
   - Borra los registros por defecto (`CNAME www → parkingpage.namecheap.com` y `URL Redirect @`).
   - **Add New Record**: tipo **A Record**, host `@`, valor el que muestre Vercel (hoy `216.198.79.1`; el anterior `76.76.21.21` sigue funcionando). TTL *Automatic*. Guarda con ✓.
   - En la pestaña **Domain**, *Nameservers* debe decir **Namecheap BasicDNS**.
   - El registro `TXT … spf.efwd.registrar-servers.com` de *Mail Settings* puede quedarse.
5. Espera 5 a 30 minutos y toca **Refresh** en Vercel: debe pasar a **Valid Configuration** y Vercel crea el certificado HTTPS solo.
6. Opcional: para que `www.tu-dominio.com` también abra, agrégalo como **Redirect to Another Domain → tu-dominio.com**.

**Comprobar:** `https://tu-dominio.com` abre el login con candado (HTTPS válido).

### 5.3 Usar el dominio en Supabase

**Authentication > URL Configuration > Site URL**: `https://tu-dominio.com` (sin barra final). No hace falta agregar *Redirect URLs*: la app entra con correo y contraseña.

## 6. Activar los avisos automáticos (cron)

El plan gratis de Vercel solo permite una tarea programada al día; por eso el ciclo de avisos lo dispara Supabase cada 5 minutos. Además mantiene activo el proyecto de Supabase, que en el plan gratis se pausa tras una semana sin uso.

1. En Supabase, **Database > Extensions**: activa `pg_cron` y `pg_net`.
2. Abre `supabase/cron.sql`, reemplaza `TU-APP.vercel.app` por **tu dominio** (`https://tu-dominio.com/api/cron/reminders`) y `TU_CRON_SECRET` por el del paso 3.
3. Ejecútalo en el **SQL Editor**.

Si ya lo habías programado con otra dirección (por ejemplo la de `vercel.app`), primero quítalo con `select cron.unschedule('m1-recordatorios');` y vuelve a ejecutar `cron.sql`.

**Comprobar** (después de 5 minutos):

```sql
select status_code, created from net._http_response order by created desc limit 5;
```

Debe mostrar `200`. Un `401` significa que el `CRON_SECRET` no coincide con el de Vercel; un `307`/`308`, que la URL redirige (revisa el `www` del paso 5.2).

## 7. Conectar WhatsApp (Meta)

### 7.1 Cuenta de desarrollador

En [developers.facebook.com](https://developers.facebook.com) regístrate como desarrollador. Para verificar la cuenta pide un celular: usa tu número **personal**, escrito **sin el 0 inicial** (el +593 ya lo pone). **No** uses el número que enviará los avisos.

### 7.2 Crear la app

**Mis apps > Crear app**:

1. **Detalles:** nombre `Pendientes`, correo de contacto.
2. **Caso de uso:** *Conectarte con los clientes a través de WhatsApp*.
3. **Negocio:** si no hay ninguno, toca **crea uno nuevo** y crea el **portfolio comercial** con el nombre real del negocio (es el nombre que verán como remitente) y un correo del negocio; confirma el correo que llega y vuelve a la pestaña.
4. **Resumen:** **Crear app**.

Después, en la app: **Casos de uso > Personalizar** (WhatsApp) > **Continuar** con el portfolio > elige **Integrar con la API** (no "Convertirte en socio").

Cuando todo funcione, agrega a Majo como administradora del portfolio (**business.facebook.com > Configuración > Personas > Invitar**) para que el negocio no dependa de una sola persona.

### 7.3 Número de prueba

En **Paso 1. Pruébalo**, Meta asigna un número de prueba gratuito (+1 555…) que puede enviar a un máximo de 5 destinatarios:

- Anota el **Phone Number ID** (≈16 dígitos): es `WHATSAPP_PHONE_NUMBER_ID` mientras uses el número de prueba.
- **Destinatario > Administrar lista**: agrega los celulares de quienes recibirán avisos; a cada uno le llega un código por WhatsApp para confirmar.
- **Generar token** da un token temporal (24 h) para el mensaje de prueba. No lo compartas en capturas: aparece en el `curl` de la derecha.
- **Enviar mensaje** y despliega el triángulo ▶ de *Revisa los webhooks de prueba* para ver el resultado: `"status": "sent"`/`"delivered"` funciona; `"failed"` trae un `code` que explica la causa (ver *Problemas comunes*).

### 7.4 Verificar el negocio (obligatorio)

Meta **no deja enviar ningún mensaje**, ni siquiera desde el número de prueba, hasta verificar el negocio: el envío falla con `131031 Business Account locked` y el Administrador de WhatsApp muestra *"Cuenta restringida: para poder empezar a enviar mensajes, tendrás que verificar tu negocio"*.

En **business.facebook.com > Configuración > Centro de seguridad > Verificación del negocio > Iniciar verificación**:

| Pide | Qué poner |
| --- | --- |
| Tipo de negocio | RUC de **persona natural** (termina en `001`, es la cédula + nombre comercial) → **Sociedad unipersonal**. Sociedad (*Cía. Ltda.*, *S.A.*, *S.A.S.*) → **Empresa privada**. |
| Nombre del negocio | **Literal del RUC** ("Apellidos y nombres" o "Razón social"), mismas letras y orden. Es lo que Meta compara con los documentos. |
| Nombre alternativo | El nombre comercial del RUC o el que usa el negocio ante el público. |
| Teléfono | El del negocio (Majo). Le llega un código por SMS: coordina para que te lo pase. |
| Sitio web | `https://tu-dominio.com` (paso 5). `vercel.app`, `gmail.com` y similares se rechazan. |
| Documentos | Certificado del RUC (descargable del SRI) y, si lo pide, factura de servicios o estado de cuenta con el **mismo nombre y dirección**. |

Primero Meta confirma tu identidad (*"Confirmación de identidad en curso"*, hasta 48 h) y luego revisa el negocio (1 a 14 días). Lo que más rechazos causa: nombre o dirección distintos entre el formulario y los documentos.

Los avisos de *Action needed* del Centro de seguridad (dominios de confianza, passkeys) son para anuncios y no bloquean WhatsApp.

Mientras Meta revisa puedes avanzar con 7.5, 7.6, 7.7 y 7.8, y con los pasos 8 y 9.

### 7.5 Crear la plantilla

Abre el **Administrador de WhatsApp** (no está en *Configuración*):

```
https://business.facebook.com/latest/whatsapp_manager/message_templates?business_id=ID_DEL_PORTFOLIO&asset_id=ID_DE_LA_CUENTA_DE_WHATSAPP
```

o desde la pantalla de la cuenta de WhatsApp: **Plantillas de mensajes > Administrar plantillas > Crear plantilla**.

1. **Configurar plantilla:** pestaña **Utilidad** (no *Marketing*: es más cara y se revisa más estricto), opción **Predeterminada** > **Siguiente**.
2. **Editar plantilla:**
   - Nombre: `recordatorio_tarea` · Idioma: **Spanish** (sin país; equivale al código `es`).
   - Tipo de variable: **Número**. Multimedia, encabezado y pie de página: ninguno.
   - Cuerpo (Meta rechaza variables al inicio o al final del texto, o con muy poco texto alrededor: *"demasiadas variables en relación con su longitud"*):
     ```
     Hola, tienes un recordatorio de Pendientes.

     {{1}}: {{2}}
     Vence: {{3}}

     Toca "Hecho" cuando la termines o "Recordar en 1 h" para posponer el aviso.
     ```
   - Muestras de variables: `{{1}}` → `Vence pronto` · `{{2}}` → `Pedido diario de champiñón` · `{{3}}` → `lunes 2 de noviembre, 09:00`.
   - **Botones > Agregar botón > Personalizado** (respuesta rápida), dos veces, **en este orden**: `Hecho` y `Recordar en 1 h`. El orden importa: la app asocia el primero a "marcar hecho" y el segundo a "posponer". No uses "Ir al sitio web" ni "Llamar".
   - *Período de validez:* déjalo apagado.
3. **Enviar para revisión** y espera a que vuelva a la lista. La plantilla debe aparecer con estado *En revisión* y luego **Activa**. Las plantillas `jaspers_market_…` y `hello_world` son ejemplos de Meta: ignóralas. Si la tuya no aparece tras recargar, el envío no se completó: créala de nuevo y fíjate en el mensaje que sale al enviar (si ya existía, Meta avisa que el nombre está en uso).

La app manda los dos botones en cada aviso: si la plantilla no está aprobada, tiene otro nombre o un solo botón, Meta rechaza el mensaje.

### 7.6 Token permanente y clave de la app

- **Clave secreta de la app:** developers.facebook.com > tu app > **Configuración de la app > Básica > Clave secreta de la app > Mostrar** → `WHATSAPP_APP_SECRET`.
- **Token permanente** (el de la consola vence en 24 h): business.facebook.com > **Configuración > Usuarios del sistema > Agregar**:
  1. Nombre `pendientes-api`, rol **Administrador**.
  2. **Asignar activos:** la app Pendientes y la cuenta de WhatsApp, con control total.
  3. **Generar token:** app Pendientes, caducidad **Nunca**, permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
  4. Cópialo en ese momento (no se vuelve a mostrar) → `WHATSAPP_TOKEN`.

### 7.7 Variables en Vercel

| Variable | De dónde sale |
| --- | --- |
| `WHATSAPP_TOKEN` | Token permanente (7.6) |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID (7.3 para el número de prueba; 7.9 para el real) |
| `WHATSAPP_APP_SECRET` | Clave secreta de la app (7.6) |
| `WHATSAPP_VERIFY_TOKEN` | Paso 3 (ya cargado) |

`WHATSAPP_TEMPLATE` y `WHATSAPP_TEMPLATE_LANG` solo hacen falta si la plantilla tiene otro nombre o idioma (por defecto `recordatorio_tarea` y `es`).

Vuelve a desplegar (**Deployments > ⋯ > Redeploy**) para que tome las variables.

### 7.8 Webhook

Después del redeploy, en developers.facebook.com > tu app > **WhatsApp > Configuración > Webhook > Editar**:

- URL de devolución: `https://tu-dominio.com/api/whatsapp/webhook`
- Token de verificación: tu `WHATSAPP_VERIFY_TOKEN`
- **Verificar y guardar**, y **Suscribirse** al campo `messages`.

### 7.9 Número real

Cuando el negocio esté verificado, en **Paso 2: Configuración de producción** agrega el número exclusivo del sistema y un **método de pago**. Si ese número tenía WhatsApp en un celular, borra antes esa cuenta: un número registrado en la API deja de funcionar en la app del celular. Cambia `WHATSAPP_PHONE_NUMBER_ID` en Vercel por el del número real y vuelve a desplegar.

**Comprobar:** asigna una tarea a Majo con vencimiento cercano, espera el aviso y toca **Hecho** en WhatsApp. La tarea debe aparecer como hecha en la app.

El botón **Hecho** solo funciona si el número que responde es del responsable, del respaldo o de una administradora. Por eso los teléfonos en **Equipo** deben estar completos y correctos.

## 8. Correo alternativo (recomendado)

Si una persona no tiene WhatsApp cargado o el envío falla (por ejemplo mientras Meta verifica el negocio), el aviso sale por correo.

1. Crea una cuenta en [resend.com](https://resend.com) y verifica tu dominio (paso 5): Resend te da registros DNS para agregar en Namecheap > Advanced DNS.
2. Carga en Vercel `RESEND_API_KEY` y `EMAIL_FROM` (ej. `Pendientes <avisos@tu-dominio.com>`) y vuelve a desplegar.

## 9. Respaldo diario (GitHub)

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

## 10. Instalar en los celulares

Abrir `https://tu-dominio.com` en Chrome (Android) o Safari (iPhone) y elegir **Agregar a pantalla de inicio**.

---

## Lista final

- [ ] Supabase en `us-east-1` y Vercel en `iad1`
- [ ] 13 migraciones y `seed.sql` ejecutados una vez, sin error
- [ ] Registro público **desactivado**
- [ ] Majo es `admin`; operativos creados con su teléfono
- [ ] Variables cargadas en Vercel y app desplegada
- [ ] Dominio propio con **Valid Configuration**, sin redirección a `www`, abriendo con HTTPS
- [ ] *Site URL* de Supabase = dominio propio
- [ ] Cron apuntando al dominio propio y respondiendo `200`
- [ ] Negocio verificado en Meta
- [ ] Plantilla `recordatorio_tarea` **Activa**, con los botones en orden
- [ ] Token permanente, clave de la app y Phone Number ID en Vercel; webhook verificado
- [ ] Botón **Hecho** probado desde WhatsApp
- [ ] Correo alternativo configurado
- [ ] Respaldo probado y `BACKUP_PASSPHRASE` guardada fuera de GitHub
- [ ] Majo agregada como administradora del portfolio de Meta

## Actualizar la aplicación después

- **Cambios de código:** al subir a `main`, Vercel despliega solo.
- **Migración nueva** (`supabase/migrations/0014_…`): ejecútala en el SQL Editor de producción **antes** de subir el código que la usa.
- **Cambio de una variable:** edítala en Vercel y vuelve a desplegar.

## Problemas comunes

| Síntoma | Causa probable |
| --- | --- |
| SQL Editor: `trailing junk after numeric literal … "0001_m1_recordatorios"` | Se pegó el nombre del archivo en vez de su contenido (2.1) |
| SQL Editor: *Potential issue detected* | Esperado en 0002, 0003 y 0009: **Run query** (2.1) |
| Vercel: *Build Failed — Vulnerable version of Next.js detected* | Actualizar `next` a la última versión parcheada (4.4) |
| Al entrar vuelve al login | Variables de Supabase mal copiadas en Vercel, o *Site URL* sin actualizar |
| Login dice "contraseña incorrecta" con la contraseña correcta | `NEXT_PUBLIC_SUPABASE_URL` con `/rest/v1` (paso 4) |
| Las pantallas tardan en cargar | Vercel y Supabase en regiones distintas (4.5) |
| Meta: *No puedes verificar tu negocio con un dominio de sitio web común* | Se puso `vercel.app`: usar dominio propio (paso 5) |
| Dominio en Vercel con *Invalid Configuration* | Falta el registro A en Namecheap o aún propaga (5.2) |
| Dominio con *DNS Change Recommended* | Funciona; Vercel sugiere la IP nueva del registro A (5.2) |
| No llega ningún aviso | Cron sin activar, con `401` o con redirección (paso 6); fuera de horario (no se avisa entre 21:00 y 07:00) |
| Los avisos dicen "simulado" en los registros de Vercel | Faltan variables de WhatsApp o no se volvió a desplegar |
| WhatsApp `131031 Business Account locked` / "Cuenta restringida" | Falta verificar el negocio (7.4) |
| WhatsApp `131030` | El destinatario no está verificado en la lista del número de prueba (7.3) |
| Plantilla: *demasiadas variables en relación con su longitud* | Cuerpo muy corto o variable al inicio/final: usar el texto de 7.5 |
| Meta rechaza el mensaje | Plantilla no aprobada, con otro nombre/idioma o sin los dos botones |
| "Hecho" en WhatsApp pospone en vez de marcar | Botones de la plantilla en orden invertido (7.5) |
| "Hecho" en WhatsApp no hace nada | Falta `WHATSAPP_APP_SECRET`, webhook sin suscribir a `messages`, o el teléfono de quien responde no está en **Equipo** |
| Los avisos dejan de salir al día siguiente | Se usó el token temporal de 24 h en vez del permanente (7.6) |
| El respaldo falla en GitHub | Se usó la cadena *Direct connection* en vez de *Session pooler* |

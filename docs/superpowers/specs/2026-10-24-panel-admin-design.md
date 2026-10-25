# Panel de administración con gráficas – Diseño

Fecha: 24 de octubre de 2026
Estado: aprobado en conversación; pendiente de revisión escrita.

## Objetivo

Que la administradora (Majo) pueda **verificar visualmente** dos cosas de M1:

1. **Avisos de WhatsApp**: que se envían, cuántos fallan o se simulan y quién no tiene teléfono.
2. **Cumplimiento del equipo**: tareas hechas a tiempo, tarde o sin hacer, por periodo y por persona.

Cada número de una gráfica debe poder comprobarse en una lista de detalle.

### Lo que dijo la usuaria

- Quiere ambas vistas (avisos y cumplimiento).
- Periodo con selector rápido de 7, 30 y 90 días.
- Gráficas con lista de detalle que se filtra al tocar una barra.
- Gráficas hechas a mano en SVG, sin librería.
- Acepta que el historial de una tarea reasignada aparezca bajo el responsable actual.

### Supuestos

- Solo las administradoras ven el panel (coherente con RNF-04 y con la RLS actual de `notifications`).
- Celular primero, español sin términos técnicos (RNF-01, RNF-02).

### Fuera de alcance

- Gráficas de pagos, ventas o Favorita (requieren M2, M3 o M7).
- Rango de fechas libre, exportar a Excel, gráficas en tiempo real.
- Guardar el responsable histórico por ocurrencia.

## Pantalla

Ruta `/admin`, botón **Panel** en el menú solo para administradoras (el menú pasa a 4 columnas para ellas). Un usuario operativo que abra `/admin` es redirigido a `/`.

De arriba a abajo:

1. **Selector de periodo**: botones `7 días | 30 días | 90 días`, como enlaces `/admin?p=7|30|90`. Valor inválido o ausente → 30.
2. **Cumplimiento del equipo**
   - Cifras: *A tiempo* (porcentaje y cantidad), *Tarde*, *Sin hacer*.
   - Barras apiladas por día (7 y 30 días) o por semana lunes–domingo (90 días): a tiempo / tarde / sin hacer.
   - Barras horizontales apiladas por responsable.
   - Lista de detalle: tarea, fecha límite, responsable, estado, quién y cuándo la marcó.
3. **Avisos de WhatsApp**
   - Cifras: *Enviados*, *Simulados*, *Fallidos*, *Personas sin WhatsApp*.
   - Barras apiladas por día o semana: enviado / simulado / fallido.
   - Barras horizontales apiladas por destinatario.
   - Lista de detalle: tarea, tipo de aviso, destinatario, fecha, estado y, si falló, último error e intentos.
   - Bloque "Sin WhatsApp": personas sin teléfono y tareas activas cuyo responsable (o la administradora, si no hay responsable) o respaldo no tiene teléfono.

### Colores

Paleta de estado fija, siempre acompañada de etiqueta y leyenda (nunca color solo):

| Estado | Color | Uso |
|---|---|---|
| Bien | `#0ca30c` | A tiempo, enviado |
| Advertencia | `#fab219` | Tarde |
| Crítico | `#d03b3b` | Sin hacer, fallido |
| Neutro | `#8a8984` | Simulado |

Los colores se definen como variables CSS con valores para modo claro y oscuro. Texto en tintas de texto, nunca en el color de la serie. Ámbar está por debajo de 3:1 sobre fondo claro: se compensa con leyenda y etiquetas visibles. Separación de 2 px entre segmentos apilados; extremos redondeados de 4 px; ejes y cuadrícula tenues.

## Datos

### Migración `supabase/migrations/0003_fallos_avisos.sql`

```sql
create table public.notification_failures (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.occurrences (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  slot text not null,
  error text not null,
  failed_at timestamptz not null default now()
);
create index notification_failures_failed_at on public.notification_failures (failed_at);
alter table public.notification_failures enable row level security;
create policy "ver fallos (admin)" on public.notification_failures
  for select to authenticated using (public.is_admin());
```

Solo escribe el cron (service role). Los usuarios no insertan.

### Cambio en `src/lib/reminders.ts`

En el `catch` del envío: insertar una fila en `notification_failures` (con `String(err)` como error) **antes** de borrar la reserva del slot. Si esa inserción falla, se registra con `console.error` y se sigue: la estadística nunca bloquea el reintento del aviso.

### Reglas de clasificación

**Cumplimiento** – ocurrencias con `due_at` dentro del periodo y `due_at < ahora`:

- *A tiempo*: `status = 'done'` y `done_at <= due_at`.
- *Tarde*: `status = 'done'` y `done_at > due_at`.
- *Sin hacer*: `status = 'pending'`.
- Se agrupa por la fecha local (Ecuador) de `due_at`.
- Responsable: `obligations.responsible_id` actual; si es nulo, "Administradora".

**Avisos** – un aviso es la combinación (`occurrence_id`, `slot`, `recipient_id`):

- *Enviado* / *Simulado*: existe en `notifications` con `status` `sent` / `simulated` (aunque tenga fallos previos). Fecha: `sent_at`.
- *Fallido*: no existe en `notifications` con estado `sent` o `simulated`, pero tiene fallos. Fecha: último `failed_at`. Se informan el último error y la cantidad de intentos.
- Filas de `notifications` en estado `sending` (envío en curso) no cuentan.
- Se agrupa por la fecha local de la fecha del aviso.

### Periodo y agrupación

- Periodo de *p* días: desde las 00:00 locales de hace *p − 1* días hasta ahora.
- 7 y 30 días → una barra por día (7 o 30 barras, incluidos días en cero).
- 90 días → una barra por semana lunes–domingo que toque el periodo.
- Fechas locales con `toLocal` / `fromLocal` de `src/lib/time.ts`.

## Arquitectura

| Unidad | Responsabilidad |
|---|---|
| `src/lib/dashboard.ts` | Funciones puras: `parsePeriod`, `buildBuckets`, `classifyCompliance`, `classifyNotifications`, `summarize`. Entrada: filas planas; salida: cifras, barras y filas de detalle serializables. Sin acceso a la base de datos. |
| `src/app/(app)/admin/page.tsx` | Server component. Verifica rol admin, lee datos con el cliente de sesión (RLS), pagina en bloques de 1000 filas, llama a `dashboard.ts` y pasa el resultado a los componentes. Cada bloque (cumplimiento, avisos) se carga por separado para que un error no tumbe el otro. |
| `src/components/dashboard/StackedBars.tsx` | Cliente. Barras apiladas verticales (por fecha) u horizontales (por persona) en SVG, con tooltip y selección. |
| `src/components/dashboard/DashboardSection.tsx` | Cliente. Cifras + leyenda + gráficas + lista; guarda el filtro seleccionado. |
| `src/app/(app)/layout.tsx` | Muestra el botón *Panel* solo a administradoras. |

Volumen esperado en 90 días: menos de 2000 ocurrencias y pocos miles de avisos; se agrega en el servidor sin vistas ni funciones SQL.

## Interacción

- Tocar o pasar el mouse sobre un segmento muestra un tooltip: "Lun 20 oct · Tarde · 2".
- Zona táctil de al menos 44 px por barra, aunque la barra se dibuje más delgada.
- Tocar un segmento filtra la lista de su bloque (por ejemplo "Tarde · Beto") y la desplaza a la vista. Tocar el mismo segmento o el botón **Ver todo** quita el filtro.
- Segmentos enfocables con teclado (Enter activa) y con `aria-label` descriptivo.
- Leyenda siempre visible arriba de cada gráfica.

## Estados vacíos y errores

- Sin datos en el periodo: "Sin tareas vencidas en este periodo" / "Sin avisos en este periodo", sin gráfica vacía.
- Error al consultar un bloque: "No se pudo cargar. Recarga la página." en ese bloque; el resto de la página funciona.
- `p` inválido → 30 días.

## Pruebas

`src/lib/dashboard.test.ts` (vitest):

- Clasificación a tiempo / tarde / sin hacer, incluido `done_at` igual a `due_at` (a tiempo).
- Ocurrencias futuras excluidas.
- Aviso con fallos y luego enviado → cuenta como enviado.
- Aviso solo con fallos → un fallido con último error y número de intentos.
- Filas `sending` excluidas.
- Agrupación diaria y semanal en hora de Ecuador (una ocurrencia a las 23:30 locales cae en su día local, no en el siguiente UTC).
- Días sin datos presentes con cero.
- Responsable nulo → "Administradora".
- `parsePeriod`: 7, 30, 90 válidos; otro valor → 30.

`src/lib/reminders.test.ts` (vitest, con `server-only` y `sendReminder` simulados): un envío que lanza error inserta una fila en `notification_failures` y borra la reserva del slot.

Verificación manual en Supabase local: sembrar 90 días de datos, abrir `/admin` en vista de celular y en modo oscuro, y comprobar que la lista filtrada suma lo mismo que la barra tocada.

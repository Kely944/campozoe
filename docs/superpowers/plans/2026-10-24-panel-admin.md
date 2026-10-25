# Panel de administración con gráficas – Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/admin`, solo para administradoras, con gráficas SVG de cumplimiento y de avisos de WhatsApp, y una lista de detalle que se filtra al tocar una barra.

**Architecture:** Primero, los fallos de envío se guardan en una tabla nueva, `notification_failures`. Después, funciones puras en `src/lib/dashboard.ts` convierten las filas de la base de datos en cifras, barras y listas, y se prueban con vitest. Por último, un server component lee los datos con RLS y se los pasa a componentes cliente que dibujan las gráficas en SVG a mano.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Tailwind 4 y vitest 3. **No se agregan dependencias.**

**Spec:** `docs/superpowers/specs/2026-10-24-panel-admin-design.md`

## Global Constraints

- Sin librerías nuevas. Las gráficas son SVG hecho a mano.
- Textos en español y sin términos técnicos. Los estados visibles son "A tiempo", "Tarde", "Sin hacer", "Enviado", "Simulado" y "Fallido".
- Hora de Ecuador: usar siempre `toLocal`, `fromLocal` y `DAY` de `src/lib/time.ts`, nunca la hora del navegador.
- Periodos válidos: `7`, `30` y `90`. Cualquier otro valor pasa a `30`.
- 7 y 30 días se agrupan por día; 90 días, por semana de lunes a domingo.
- Colores: bien `#0ca30c`, advertencia `#fab219`, crítico `#d03b3b`, neutro `#8a8984`, siempre con etiqueta y leyenda.
- Solo las administradoras ven `/admin`. Un operativo que la abra va a `/`.
- La lectura usa el cliente de sesión (RLS) y no la service role key.
- Guardar un fallo de envío nunca debe impedir que se reintente el aviso.
- Supabase devuelve como máximo 1000 filas por consulta, así que se lee por páginas.
- Mensajes de commit al estilo del repositorio (`feat:`, `fix:`, `docs:`), terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Responsable vacío y administradora sin teléfono.** La tarea debe aparecer en "Sin WhatsApp" bajo "Administradora". Prueba en la Task 5.
2. **Límite de día y de semana en hora local.** Una tarea del domingo a las 23:30 en Ecuador es lunes en UTC, pero debe caer en la semana que termina ese domingo. Prueba en la Task 2.
3. **Más de 1000 filas.** Sin paginar, las cifras salen recortadas sin aviso. Prueba de `fetchAll` en la Task 2.
4. **Tareas pausadas.** Su historial sigue contando: la consulta no filtra por `active`. Se comprueba en la Task 7, paso de verificación manual.
5. **Nombres o títulos largos en el celular.** Deben recortarse con `…` sin causar scroll horizontal. Se comprueba en la Task 7, paso de verificación manual a 360 px.

---

### Task 1: Registrar fallos de envío

**Files:**
- Create: `supabase/migrations/0003_fallos_avisos.sql`
- Modify: `src/lib/reminders.ts` (el `catch` dentro de `runReminders`, que hoy empieza en `} catch (err) {`)
- Test: `src/lib/reminders.test.ts`

**Interfaces:**
- Produces: la tabla `public.notification_failures (id, occurrence_id, recipient_id, slot, error, failed_at)`, que lee la Task 7.

- [ ] **Step 1: Escribir la migración.** Copiar exactamente el bloque SQL de la sección "Migración" de la especificación. Agregar como encabezado el mismo comentario que usa `0002` ("Ejecutar en Supabase: SQL Editor > New query > pegar y Run.").
- [ ] **Step 2: Aplicarla en el Supabase local.**
  Run: `docker exec -i supabase_db_04-majo-admin psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/0003_fallos_avisos.sql`
  Expected: termina sin `ERROR`.
- [ ] **Step 3: Escribir la prueba que falla.** En `src/lib/reminders.test.ts`, simular los módulos con `vi.mock("server-only", () => ({}))` y `vi.mock("./whatsapp", () => ({ sendReminder: vi.fn().mockRejectedValue(new Error("WhatsApp 400: número inválido")) }))`. Escribir un `db` falso que registre cada llamada `from(tabla).insert/delete/update` y devuelva datos fijos:
  - una obligación activa, diaria a las 09:00, con `reminder_offsets_min: [60]`, `responsible_id: "majo"` y `starts_on: "2026-01-01"`;
  - el perfil de `majo` con teléfono `593991234567`;
  - una ocurrencia pendiente que vence 30 min después de `now`;
  - `notifications` vacío;
  - el `insert` en `notifications` devuelve `{ id: "n1" }`.

  Prueba `it("un envío fallido se guarda en notification_failures y libera el slot")`, con estas aserciones:
  - hubo un `insert` en `notification_failures` con `{ occurrence_id: <id>, recipient_id: "majo", slot: "reminder:60", error: "Error: WhatsApp 400: número inválido" }`;
  - hubo un `delete` en `notifications` con `id = "n1"`;
  - `summary.failed` tiene longitud 1.

  Usar `now = fromLocal(2026, 10, 27, 8, 30)`.
- [ ] **Step 4: Ejecutarla y confirmar que falla.**
  Run: `npx vitest run src/lib/reminders.test.ts`
  Expected: FAIL, porque no hay `insert` en `notification_failures`.
- [ ] **Step 5: Implementar.** En el `catch`, antes del `delete`, hacer `insert` en `notification_failures` con `occurrence_id`, `recipient_id`, `slot` y `error: String(err)`. Si devuelve `error`, o si lanza una excepción, hacer `console.error("No se pudo guardar el fallo", ...)` y seguir con el `delete` de todas formas.
- [ ] **Step 6: Agregar la prueba `it("si guardar el fallo falla, igual libera el slot")`.** El `insert` en `notification_failures` devuelve `{ error: { message: "x" } }`. Aserción: igual hubo un `delete` en `notifications` con `id = "n1"`.
- [ ] **Step 7: Ejecutar todas las pruebas.**
  Run: `npx vitest run`
  Expected: todas pasan.
- [ ] **Step 8: Commit.** `feat: guardar fallos de envío de avisos`

### Task 2: Periodos, grupos de fechas y lectura paginada

**Files:**
- Create: `src/lib/dashboard.ts`, `src/lib/dashboard.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Period = 7 | 30 | 90;
  export function parsePeriod(raw: string | string[] | undefined): Period;
  export interface Bucket { key: string; label: string; start: Date; end: Date } // end exclusivo
  export function buildBuckets(period: Period, now: Date): Bucket[];
  export function bucketKeyFor(date: Date, buckets: Bucket[]): string | null; // null = fuera del periodo
  export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size?: number): Promise<T[]>; // size por defecto 1000
  ```

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - `parsePeriod`: `"7"→7`, `"30"→30`, `"90"→90`, `"15"→30`, `undefined→30`, `["90"]→90`.
  - `buildBuckets(7, fromLocal(2026,10,24,15))`:
    - devuelve 7 grupos;
    - el primero tiene `key` `"2026-10-18"` y `start = fromLocal(2026,10,18)`;
    - el último tiene `key` `"2026-10-24"` y `end = fromLocal(2026,10,25)`;
    - `label` del último es `"Sáb 24"`.
  - `buildBuckets(30, …)` devuelve 30 grupos.
  - `buildBuckets(90, fromLocal(2026,10,24,15))`:
    - el periodo empieza el `fromLocal(2026,7,27)` (lunes);
    - cada grupo dura 7 días y empieza en lunes;
    - el último grupo tiene `start = fromLocal(2026,10,19)`;
    - `label` tiene el formato `"19 oct"`;
    - el primer grupo empieza en el lunes de la semana del primer día del periodo.
  - `bucketKeyFor`:
    - `fromLocal(2026,10,18,23,30)` cae en `"2026-10-18"` aunque en UTC ya sea el 19;
    - en la vista de 90 días, `fromLocal(2026,10,18,23,30)` (domingo) cae en el grupo que empieza el 12 de octubre, no en el del 19;
    - una fecha anterior al periodo devuelve `null`.
  - `fetchAll`:
    - con una función `page` falsa que sirve 2500 filas en páginas de 1000, devuelve 2500 filas y llama `page(0,999)`, `page(1000,1999)` y `page(2000,2999)`;
    - si `page` devuelve `error`, `fetchAll` lanza ese error.
- [ ] **Step 2: Ejecutarlas y confirmar que fallan.**
  Run: `npx vitest run src/lib/dashboard.test.ts`
  Expected: FAIL, porque el módulo no existe.
- [ ] **Step 3: Implementar.**
  - Periodo diario: desde las 00:00 locales de hace `period-1` días.
  - Periodo de 90 días: desde el lunes de la semana de ese primer día.
  - `key` es la fecha local `YYYY-MM-DD` del `start`.
  - Días de la semana: `WEEKDAY_LABELS` de `src/lib/obligation-form.ts`.
  - Meses abreviados en minúscula: `ene feb mar abr may jun jul ago sep oct nov dic`.
  - `fetchAll` se detiene cuando una página trae menos de `size` filas.
- [ ] **Step 4: Ejecutar las pruebas.** `npx vitest run src/lib/dashboard.test.ts` debe pasar.
- [ ] **Step 5: Commit.** `feat: periodos y agrupación por día y semana del panel`

### Task 3: Clasificar el cumplimiento

**Files:**
- Modify: `src/lib/dashboard.ts`, `src/lib/dashboard.test.ts`

**Interfaces:**
- Consumes: `Bucket` y `bucketKeyFor` de la Task 2.
- Produces:
  ```ts
  export type ComplianceStatus = "a_tiempo" | "tarde" | "sin_hacer";
  export const COMPLIANCE_STATUSES: readonly ComplianceStatus[]; // ["a_tiempo","tarde","sin_hacer"]
  export interface OccurrenceRow { id: string; due_at: string; status: "pending" | "done"; done_at: string | null; done_by: string | null; title: string; responsible_id: string | null }
  export interface ComplianceItem { id: string; title: string; dueAt: string; personId: string | null; personName: string; status: ComplianceStatus; doneByName: string | null; doneAt: string | null; bucketKey: string }
  export function classifyCompliance(rows: OccurrenceRow[], names: Map<string, string>, buckets: Bucket[], now: Date): ComplianceItem[]; // ordenado por dueAt descendente
  ```

- [ ] **Step 1: Escribir las pruebas que fallan.** Usar `now = fromLocal(2026,10,24,15)` y el periodo de 7 días.
  - `done_at` igual a `due_at` → `"a_tiempo"`.
  - `done_at` un minuto después de `due_at` → `"tarde"`.
  - Pendiente con plazo pasado → `"sin_hacer"`.
  - Ocurrencia con `due_at > now` → excluida.
  - Ocurrencia anterior al periodo → excluida.
  - `responsible_id: null` → `personName: "Administradora"` y `personId: null`.
  - `doneByName` sale de `names`; si `done_by` no está en `names`, vale `"Alguien"`.
- [ ] **Step 2: Ejecutarlas y confirmar que fallan.** `npx vitest run src/lib/dashboard.test.ts`
- [ ] **Step 3: Implementar `classifyCompliance`** según las reglas de la sección "Cumplimiento" de la especificación.
- [ ] **Step 4: Ejecutar las pruebas.** Deben pasar.
- [ ] **Step 5: Commit.** `feat: clasificar cumplimiento a tiempo, tarde y sin hacer`

### Task 4: Clasificar los avisos

**Files:**
- Modify: `src/lib/dashboard.ts`, `src/lib/dashboard.test.ts`

**Interfaces:**
- Consumes: `Bucket` y `bucketKeyFor` de la Task 2, y `minutesLabel` de `src/lib/obligation-form.ts`.
- Produces:
  ```ts
  export type NoticeStatus = "enviado" | "simulado" | "fallido";
  export const NOTICE_STATUSES: readonly NoticeStatus[]; // ["enviado","simulado","fallido"]
  export interface NotificationRow { occurrence_id: string; recipient_id: string; slot: string; status: "sending" | "sent" | "simulated"; sent_at: string }
  export interface FailureRow { occurrence_id: string; recipient_id: string; slot: string; error: string; failed_at: string }
  export interface NoticeItem { key: string; occurrenceId: string; title: string; slotLabel: string; personId: string; personName: string; status: NoticeStatus; at: string; lastError: string | null; attempts: number; bucketKey: string }
  export function slotLabel(slot: string): string;
  export function classifyNotifications(sent: NotificationRow[], failures: FailureRow[], titles: Map<string, string>, names: Map<string, string>, buckets: Bucket[]): NoticeItem[]; // ordenado por at descendente
  ```

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - `slotLabel`:
    - `"reminder:1440"→"Aviso 1 día antes"`;
    - `"reminder:120"→"Aviso 2 h antes"`;
    - `"repeat:3"→"Repetición"`;
    - `"escalation"→"Aviso al respaldo"`;
    - `"overdue"→"Vencida"`.
  - Un aviso con 2 fallos y después un `sent` cuenta como un solo `"enviado"`, con `attempts: 0` y `lastError: null`. La fecha es la de `sent_at`.
  - Un aviso con 3 fallos y sin envío cuenta como un solo `"fallido"`, con `attempts: 3`. `lastError` y `at` salen del fallo más reciente.
  - Una fila `status: "sending"` sin fallos se excluye.
  - `"simulated"` → `"simulado"`.
  - Un aviso fuera del periodo se excluye.
  - Una ocurrencia que no está en `titles` → `title: "Tarea eliminada"`.
  - `key` es `` `${occurrence_id}|${slot}|${recipient_id}` ``.
- [ ] **Step 2: Ejecutarlas y confirmar que fallan.** `npx vitest run src/lib/dashboard.test.ts`
- [ ] **Step 3: Implementar.** Agrupar por `key` con un `Map`. Las reglas son las de la sección "Avisos" de la especificación.
- [ ] **Step 4: Ejecutar las pruebas.** Deben pasar.
- [ ] **Step 5: Commit.** `feat: clasificar avisos enviados, simulados y fallidos`

### Task 5: Totales por grupo y por persona, y lista "Sin WhatsApp"

**Files:**
- Modify: `src/lib/dashboard.ts`, `src/lib/dashboard.test.ts`

**Interfaces:**
- Consumes: `Bucket` de la Task 2 y los tipos de las Tasks 3 y 4.
- Produces:
  ```ts
  export interface Series<S extends string> { key: string; label: string; counts: Record<S, number>; total: number }
  export interface Summary<S extends string> { totals: Record<S, number>; byBucket: Series<S>[]; byPerson: Series<S>[] }
  export function summarize<S extends string>(items: { status: S; bucketKey: string; personId: string | null; personName: string }[], statuses: readonly S[], buckets: Bucket[]): Summary<S>;
  export interface MissingPhones { people: { id: string; name: string }[]; tasks: { id: string; title: string; who: string[] }[] }
  export function findMissingPhones(profiles: { id: string; full_name: string; phone: string | null; role: "admin" | "operativo" }[], obligations: { id: string; title: string; active: boolean; responsible_id: string | null; backup_id: string | null }[]): MissingPhones;
  ```

- [ ] **Step 1: Escribir las pruebas que fallan.**
  - `summarize`:
    - `byBucket` tiene un elemento por grupo, en orden y con ceros donde no hay datos;
    - `byPerson` va ordenado por `total` descendente;
    - la `key` de cada persona es `personId`, o `"admin"` si es `null`;
    - `totals` suma todos los estados.
  - `findMissingPhones`:
    - un perfil sin teléfono aparece en `people`;
    - una tarea activa cuyo responsable no tiene teléfono aparece con `who: ["Beto"]`;
    - una tarea con `responsible_id: null`, donde la primera administradora no tiene teléfono, aparece con `who: ["Administradora"]`;
    - si el respaldo tampoco tiene teléfono, aparece con `who: ["Beto", "Kelly (respaldo)"]`;
    - las tareas inactivas se excluyen.
- [ ] **Step 2: Ejecutarlas y confirmar que fallan.** `npx vitest run src/lib/dashboard.test.ts`
- [ ] **Step 3: Implementar.** El responsable de reserva se elige igual que en `runReminders`: la primera administradora de la lista de perfiles.
- [ ] **Step 4: Ejecutar las pruebas.** Deben pasar.
- [ ] **Step 5: Commit.** `feat: totales del panel y lista de personas sin WhatsApp`

### Task 6: Componentes de gráfica y sección

**Files:**
- Create: `src/components/dashboard/StackedBars.tsx`, `src/components/dashboard/DashboardSection.tsx`
- Modify: `src/app/globals.css` (las variables de color)

**Interfaces:**
- Consumes: `Series` y `Summary` de la Task 5.
- Produces:
  ```ts
  // StackedBars.tsx ("use client")
  export interface Selection { axis: "bucket" | "person"; key: string; status: string }
  export default function StackedBars<S extends string>(props: {
    series: Series<S>[]; statuses: readonly S[]; statusLabels: Record<S, string>; colors: Record<S, string>; // valores var(--...)
    orientation: "vertical" | "horizontal"; axis: Selection["axis"]; selected: Selection | null;
    onSelect: (s: Selection | null) => void; title: string;
  }): JSX.Element;
  // DashboardSection.tsx ("use client")
  export interface DetailRow { id: string; bucketKey: string; personKey: string; status: string; cells: string[] } // cells ya formateadas
  export default function DashboardSection(props: {
    title: string; emptyText: string; summary: Summary<string>; statuses: readonly string[];
    statusLabels: Record<string, string>; colors: Record<string, string>;
    columns: string[]; rows: DetailRow[]; extra?: React.ReactNode;
  }): JSX.Element;
  ```

- [ ] **Step 1: Agregar los colores a `globals.css`.**
  - Variables `--st-bien: #0ca30c`, `--st-adv: #fab219`, `--st-crit: #d03b3b` y `--st-neutro: #8a8984` en `:root`. En modo oscuro tienen el mismo valor (la paleta de estado es fija).
  - Variables de superficie y texto de gráfica: `--viz-surface`, `--viz-text`, `--viz-muted` y `--viz-grid`, con valores claros y oscuros en `@media (prefers-color-scheme: dark)`.
- [ ] **Step 2: Implementar `StackedBars`.**
  - SVG con `viewBox` y ancho 100 %.
  - Segmentos apilados en el orden de `statuses`, con 2 px de separación y radio de 4 px en el extremo.
  - Vertical: la etiqueta de grupo solo en algunos ticks (cada 5 en 30 días).
  - Horizontal: el nombre a la izquierda, recortado con `…`, y el total a la derecha.
  - Cada segmento lleva:
    - un `<rect>` transparente de al menos 44 px de lado como zona táctil;
    - `role="button"`, `tabIndex={0}` y un `aria-label` como "Lun 20 · Tarde · 2";
    - activación con Enter.
  - El tooltip es HTML en posición absoluta, con ese mismo texto.
  - Cuando hay selección, los segmentos no seleccionados quedan con opacidad 0.35.
  - Tocar el segmento seleccionado llama `onSelect(null)`.
- [ ] **Step 3: Implementar `DashboardSection`.**
  - Muestra cifras grandes a partir de `summary.totals` y una leyenda con muestra de color más etiqueta.
  - Muestra dos `StackedBars`: por grupo en vertical y por persona en horizontal.
  - La lista de `rows` se filtra según la selección: `bucketKey` o `personKey`, más `status`.
  - Muestra un chip "Tarde · Beto" con el botón **Ver todo**.
  - Al seleccionar, la lista se desplaza a la vista con `scrollIntoView({ behavior: "smooth" })`.
  - Si `summary` no tiene ítems, muestra `emptyText` en lugar de las gráficas.
  - Clases de la app: `card`, `btn-secondary`.
- [ ] **Step 4: Verificar tipos y lint.**
  Run: `npx tsc --noEmit && npx eslint`
  Expected: sin salida.
- [ ] **Step 5: Commit.** `feat: componentes de gráficas SVG del panel`

### Task 7: Página `/admin`, menú y verificación

**Files:**
- Create: `src/app/(app)/admin/page.tsx`
- Modify: `src/app/(app)/layout.tsx` (el `nav`), `README.md` (los pasos de puesta en marcha y la tabla de contenido)

**Interfaces:**
- Consumes: `requireProfile` de `src/lib/session.ts`, todo `src/lib/dashboard.ts` (Tasks 2 a 5) y los componentes de la Task 6.

- [ ] **Step 1: Agregar el botón al menú en `layout.tsx`.**
  - Usar `isAdmin` de `requireProfile()`.
  - Las administradoras ven 4 columnas (`grid-cols-4`) con el enlace `Panel` a `/admin`.
  - Los operativos siguen con 3 columnas.
- [ ] **Step 2: Implementar `page.tsx`.**
  - `export const dynamic = "force-dynamic"`.
  - Recibe `searchParams: Promise<{ p?: string }>` y pasa `p` por `parsePeriod`.
  - Si `!isAdmin`, hace `redirect("/")`.
  - Arma `buckets` con `buildBuckets`.
  - Con `fetchAll`, lee:
    - `occurrences` con `id, due_at, status, done_at, done_by, obligations(title, responsible_id)`, filtrando `due_at >= buckets[0].start` y `due_at < now`, sin filtrar por `active`;
    - `notifications` y `notification_failures` desde `buckets[0].start`.
  - Lee también `profiles` y `obligations`, que sirven para `titles` y `findMissingPhones`.
  - Cada bloque, cumplimiento y avisos, va en su propio `try/catch`. Si falla, el bloque muestra `"No se pudo cargar. Recarga la página."`.
  - Selector de periodo: tres `Link` a `/admin?p=7|30|90`, con el activo resaltado como en el selector de frecuencia de `ObligationForm`.
  - Las columnas de detalle se formatean con `formatDue`:
    - cumplimiento: Tarea, Vence, Responsable, Estado, Marcada por;
    - avisos: Tarea, Aviso, Para, Fecha, Estado, Error.
  - Debajo de avisos va la lista "Sin WhatsApp" como `extra`.
- [ ] **Step 3: Verificar tipos, lint, pruebas y build.**
  Run: `npx tsc --noEmit && npx eslint && npx vitest run && npm run build`
  Expected: todo pasa y `/admin` aparece en la salida del build.
- [ ] **Step 4: Verificación manual en el Supabase local.**
  - Crear en el scratchpad (no en el repositorio) un SQL que siembre 90 días de datos:
    - ocurrencias a tiempo, tarde y sin hacer de dos responsables;
    - una tarea **pausada** con historial;
    - avisos `sent` y `simulated`;
    - un aviso con 3 fallos sin envío;
    - un perfil sin teléfono;
    - un título de 80 caracteres.
  - Aplicarlo con `docker exec -i supabase_db_04-majo-admin psql …` y abrir `npm run dev`, entrando como administradora. Revisar:
    - (a) las cifras coinciden con un `count(*)` en SQL;
    - (b) tocar un segmento filtra la lista, y el número de filas es igual al del tooltip;
    - (c) a 360 px de ancho no hay scroll horizontal y el título largo se recorta;
    - (d) el modo oscuro se ve legible;
    - (e) la tarea pausada aparece en el historial;
    - (f) un operativo que abre `/admin` llega a `/`;
    - (g) `/admin?p=abc` muestra 30 días.
- [ ] **Step 5: Actualizar el README.**
  - En el paso 1 de puesta en marcha, agregar `0003_fallos_avisos.sql` después de `0002`.
  - Agregar la fila `Panel de administración | /admin` a la tabla.
- [ ] **Step 6: Commit.** `feat: panel de administración con gráficas de avisos y cumplimiento`

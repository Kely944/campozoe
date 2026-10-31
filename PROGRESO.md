# PROGRESO

## Línea base (31-oct-2026, antes de cambios)

- `node_modules` estaba incompleto (sin `.bin`): se ejecutó `npm ci`.
- `npm test`: 4 archivos, **56 tests OK**.
- `npm run lint`: sin errores.
- `npm run build`: OK (11 rutas).
- No hay `.env.local`. Hay Docker: se usa **Supabase local** (`npx supabase start`) para probar migraciones, RLS y pantallas; nunca el proyecto de producción.
- El árbol tenía cambios sin commit (función "Recordar en 1 h", migración 0004, CLAUDE.md): se guardaron en el primer commit de la rama.

## Bitácora

- Supabase local levantado (migraciones 0001–0005 + seed OK). Usuarios de prueba majo/beto/kelly `@prueba.local` creados por la API admin local. Verificación en navegador con Playwright + Chrome instalado (la extensión Claude in Chrome no estaba conectada).
- **P0** RF-05 (hora de "hecho"), RF-06 verificado, RF-21 (segundo día del mes, migración 0005). Tests 58 OK, lint OK, build OK.
- **M4** RF-19/20/21/22: `/pedidos`, migración 0006 con RLS (probada como Beto/Kelly/Majo), helpers de fecha local y USD (RNF-05). Tests 67 OK, lint OK, build OK.
  - Lección: no correr `next build` con `next dev` encendido (pisa `.next`, la página no hidrata y el formulario se reenvía). El script de verificación detiene el dev antes.
- **M3** RF-15/16/17/18 + RNF-04: `/pagos` (calendario mensual con totales por semana, préstamos y pagos fijos, cheques), migración 0007 (`payments`, `cheques`, `obligations.source`) con RLS solo admin. Helper `lib/obligations.ts` (`upsertObligation`, `completeObligation`) compartido con Tareas. Tests 76 OK, lint OK, build OK.
- **M2** RF-08…RF-13: `/favorita` (oferta semanal con enlace, javas por día con control de buseta, lista para copiar por producto, órdenes de compra con aviso de entrega y alerta de factura), `/favorita/productos`, migración 0008 con RLS solo admin. Componentes `ActionForm` y `CopyButton`. Tests 88 OK, lint OK, build OK.
- **M5** RF-23…RF-27 (09:45): `/cobros` (ventas fiadas, saldos por cliente, plazo de nota de crédito, días de aviso), `/cobros/favorita` (conciliación), migración 0009 con trigger `credit_sale_reminder` y RPC `mark_credit_paid`. Ciclo de cron local probado: avisos simulados de cobro vencido a Beto y Majo. Tests 96 OK, lint OK, build OK.
  - Nota: las horas de las entradas anteriores eran aproximadas y se quitaron; la sesión empezó 09:04.
- **M6** RF-28/29/30 + RF-07 (10:05): `/produccion` (grano a remojar desde la oferta, calculadoras de grano y bandejas de champiñón), migración 0010 con tareas de cocción. Se abrió BLOQUEOS.md (error de cuenta en el ejemplo de RF-28; días de cocción). Tests 101 OK, lint OK, build OK.
- **M7** RF-31/32/33 (10:20): `/reportes` (reporte por periodo/cliente/mes e importación .xlsx/.csv sin dependencias nuevas), sugerencia de corchos en Pedidos, CxC del facturador en Cobros, migración 0011. Límite de server actions a 10 MB. Tests 115 OK, lint OK, build OK.

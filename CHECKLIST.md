# CHECKLIST – Pendientes Majo

Fuentes: **REQ** = `documentación/Requerimientos_app_Majo.docx`, **TRA** = `Transcripcion_audios_elicitacion.docx`, **COS** = `Costos_app_Majo*.xlsx` (alcance acordado: fases 0–3 + cierre, RF-01…RF-33).
Estados: Hecho (verificado con test o ejecutándolo) · Parcial · Falta · No aplica (justificado en DECISIONES.md).

Auditoría inicial: 31-oct-2026, rama `noche-completar`. Prioridad: **P0** bloquea el uso diario · **P1** fase 1 acordada · **P2** fase 2 · **P3** fase 3 / no funcionales.

## M1 Recordatorios y avisos (REQ § M1, COS Elaboración fase 1)

| # | Requerimiento | Fuente | Estado | Dónde está en el código | Cómo se verificó |
|---|---|---|---|---|---|
| RF-01 | Registrar obligaciones con nombre, fecha/hora límite, frecuencia (diaria, semanal, mensual, única) y responsable | REQ M1 | Hecho | `obligations` (0001), `/obligaciones`, `lib/obligation-form.ts`, `lib/schedule.ts#generateOccurrences` | `obligation-form.test.ts`, `schedule.test.ts` (generateOccurrences) |
| RF-02 | Avisos por WhatsApp con anticipación configurable (2 días, 1 día, 2 h…) | REQ M1 | Hecho | `planNotifications` (`reminder:<offset>`), `lib/reminders.ts`, `lib/whatsapp.ts` | `schedule.test.ts` "envía el recordatorio al alcanzar el offset", `reminders.test.ts` |
| RF-03 | Repetir el aviso hasta que alguien marque hecha | REQ M1 | Hecho | `planNotifications` (`repeat:<n>`, `snooze:`) | `schedule.test.ts` "repite cada hora hasta que se marque hecha" |
| RF-04 | Avisar a respaldo (Beto/Kelly) si sigue pendiente cerca del plazo | REQ M1 | Hecho | `planNotifications` (`escalation`, `overdue`) | `schedule.test.ts` "escala al respaldo", "vencida" |
| RF-05 | Marcar "hecho" desde aviso o app, guardando quién y cuándo | REQ M1 | Hecho | RPC `mark_done`/`undo_done` (0002), webhook; Hoy muestra "Hecha por X · fecha y hora" | Playwright + Supabase local: Beto marcó → "Hecha por Beto · sábado, 31 de octubre, 09:13"; Majo marcó y deshizo |
| RF-06 | Pantalla "Hoy y esta semana" ordenada por urgencia | REQ M1 | Hecho | `src/app/(app)/page.tsx`: Vencidas → Hoy → Esta semana, cada grupo por hora límite | Captura en navegador (390 px) con datos del seed en Supabase local |
| RF-07 | Obligaciones precargadas: oferta Favorita, champiñón, etiquetas, cuotas | REQ M1 | Hecho | `supabase/seed.sql` (oferta, champiñón diario y de fin de semana, etiquetas, cuota) + migración 0010 (cocción) | Supabase local: seed aplicado y visible en Hoy/Tareas (captura) |
| M1-a | Panel de administración con gráficas de avisos y cumplimiento | COS fila "Panel de administración" | Hecho | `/admin`, `lib/dashboard.ts` | `dashboard.test.ts` (32 tests) |
| M1-b | Sin avisos en horario de descanso (21:00–07:00) | README/CLAUDE.md | Hecho | `DEFAULT_QUIET_HOURS` | `schedule.test.ts` "no envía en horario de descanso" |
| M1-c | "Recordar en 1 h" desde WhatsApp | trabajo previo (0004) | Hecho | webhook + `snoozedUntil` | `schedule.test.ts` "recordar en 1 h" |

## M2 Corporación Favorita (REQ § M2)

| # | Requerimiento | Fuente | Estado | Dónde está en el código | Cómo se verificó |
|---|---|---|---|---|---|
| RF-08 | Registrar enlace semanal de oferta (llega lunes) y avisar hasta miércoles 19:00 | REQ M2; TRA A1 02:00–04:00 | Hecho | `/favorita` (enlace por semana, `favorita_offers` 0008, botón "Abrir enlace", cierre y cuenta regresiva); aviso semanal miércoles 19:00 en `seed.sql`; `currentOfferWeek` muestra la oferta abierta | `favorita.test.ts` "la oferta cierra el miércoles a las 19:00", "la oferta que toca"; Playwright: enlace guardado y botón visible |
| RF-09 | Datos fijos por producto: código de proveedor, centro de acopio (CAF 400), código de barras | REQ M2; TRA A1 02:00 | Hecho | `/favorita/productos`: `app_settings` (código de proveedor, acopio, capacidad) + `favorita_products` (barras, código, unidades por java) | `favorita.test.ts` "parseProductForm"; Playwright: código PRV-123 y 2 productos guardados |
| RF-10 | Oferta de la semana por producto (javas y día miércoles/viernes) lista para copiar, un formulario por producto | REQ M2; TRA A1 03:00 | Hecho | `OfferForm` (javas por producto y día) + "Lista para copiar" con botón Copiar y "Enviado" por producto (`offerCopyText`) | `favorita.test.ts` "texto listo para copiar"; Playwright: 3 bloques, 1/3 marcado enviado |
| RF-11 | Avisar si la oferta supera la capacidad de la buseta (100 javas) | REQ M2; TRA A1 08:00–09:00 | Hecho | `capacityByDay`: total en vivo por día de entrega y aviso al guardar (capacidad editable) | `favorita.test.ts` "avisa si pasan de 100"; Playwright: 105 javas → "No entra en la buseta: sobran 5" |
| RF-12 | Registrar orden de compra (semana, productos, unidades) y hora de entrega, con aviso previo | REQ M2; TRA A1 05:00, 09:00 | Hecho | `/favorita/ordenes/nueva`, `purchase_orders` + items (0008); `deliveryObligation` (aviso 1 día, 2 h y 1 h antes a quien entrega) | `favorita.test.ts` "órdenes de compra"; Playwright: orden semana 44 con Kelly; obligación `orden` creada y cerrada al entregar |
| RF-13 | Alertar si una orden entregada no tiene factura | REQ M2; TRA A1 10:00 | Hecho | "Ya se entregó" crea la tarea `factura` (vence 18:00 del día, repite cada hora) y alerta roja en `/favorita`; registrar la factura la cierra (`completeObligation`) | `favorita.test.ts` "factura pendiente vence a las 18:00"; Playwright: alerta visible tras entregar y desaparece al registrar factura; en BD la ocurrencia quedó `done` |
| RF-14 | (Fase posterior) Llenar formulario de oferta automáticamente si el formato lo permite | REQ M2; COS fase 3 | Hecho | `lib/formulario.ts`: si el enlace es un Formulario de Google, lee sus preguntas y arma un enlace prellenado por producto ("Abrir formulario lleno"); si no, quedan los bloques para copiar | `formulario.test.ts` (hosts permitidos, lectura de preguntas, enlace con opciones exactas); Playwright: enlace no reconocido → modo copiar. Sin un enlace real de Favorita para probar (BLOQUEOS.md) |

## M3 Pagos y préstamos (REQ § M3)

| # | Requerimiento | Fuente | Estado | Dónde está en el código | Cómo se verificó |
|---|---|---|---|---|---|
| RF-15 | Registrar préstamos (banco, cuota fija, día de pago, cuenta de débito) y pagos recurrentes a proveedores y trabajadores | REQ M3; TRA A1 13:00–14:00 | Hecho | `/pagos`, `/pagos/nuevo`, `/pagos/[id]`; migración 0007 `payments`; `lib/pagos.ts#parsePaymentForm` | `pagos.test.ts`; Playwright: Majo registró préstamo (Banco Pichincha, $850,50, día 5) y sueldo |
| RF-16 | Avisar con días de anticipación para transferir a la cuenta de débito correcta | REQ M3 | Hecho | `paymentObligation`: obligación mensual vinculada (`obligations.source='pago'`), avisos N días/1 día/2 h antes, título con banco y cuenta enmascarada | `pagos.test.ts` "avisa con días de anticipación…"; en Tareas aparece "Transferir para cuota: Préstamo equipos (Banco Pichincha cta. …3456)" |
| RF-17 | Calendario mensual de pagos y total por semana | REQ M3; TRA A1 13:00 | Hecho | `/pagos?mes=AAAA-MM`, `monthCalendar` (semanas lunes–domingo, cheques emitidos incluidos) | `pagos.test.ts` "agrupa por semana…"; captura noviembre 2026: total $2.520,50 |
| RF-18 | Cheques emitidos con fecha posfechada y estado | REQ M3; TRA A1 14:00–15:00 | Hecho | `cheques` (0007), `/pagos` sección Cheques (emitido/cobrado/anulado) | `pagos.test.ts` "parseChequeForm"; Playwright: cheque 001234 registrado y visible en el calendario |

## M4 Pedidos a proveedores (REQ § M4)

| # | Requerimiento | Fuente | Estado | Dónde está en el código | Cómo se verificó |
|---|---|---|---|---|---|
| RF-19 | Registrar pedido diario de champiñón en corchos de 14 kg, con aviso antes del corte 9:00 | REQ M4; TRA A1 00:00–01:00, 06:00 | Hecho | `/pedidos` (migración 0006 `supplier_orders`, `lib/pedidos.ts`); aviso 9:00 en `seed.sql`; el pedido puede marcar hecha la tarea de hoy | `pedidos.test.ts`; Playwright: Beto registró 6 corchos y la tarea "Pedido diario de champiñón" quedó hecha (done_via app); RLS probada en BD local |
| RF-20 | Destacar el pedido que cubre fin de semana y lunes | REQ M4; TRA A1 01:00 | Hecho | `coversWeekend` (entregas sáb/dom/lun): aviso ámbar en el formulario y etiqueta "FIN DE SEMANA"; obligación "alta" en `seed.sql` | `pedidos.test.ts` "coversWeekend"; captura 390 px |
| RF-21 | Pedido de etiquetas con corte 11:00 y frecuencia 1 o 2 veces por mes | REQ M4; TRA A1 11:00 | Hecho | Aviso mensual con segundo día opcional (migración 0005); registro en `/pedidos` (proveedor "Etiquetas") | `schedule.test.ts` "mensual dos veces", `obligation-form.test.ts`, `pedidos.test.ts` |
| RF-22 | Historial de pedidos por proveedor | REQ M4 | Hecho | `/pedidos` sección "Historial por proveedor" (`historyBySupplier`) | `pedidos.test.ts` "historyBySupplier"; captura con 2 proveedores |

## M5 Cuentas por cobrar informales (REQ § M5)

| # | Requerimiento | Fuente | Estado | Dónde está en el código | Cómo se verificó |
|---|---|---|---|---|---|
| RF-23 | Ventas a crédito sin datos tributarios: cliente (nombre o puesto), monto, fecha, vendedor | REQ M5; TRA A2 | Hecho | `/cobros` (todo el equipo), `credit_sales` (0009; vendedor = usuario de la sesión por RLS) | `cobros.test.ts` "cliente sin datos tributarios"; Playwright: Beto registró 3 ventas |
| RF-24 | Avisar al vendedor y a Majo cuando un cobro pase de X días | REQ M5; TRA A2 00:00 ("pasado dos semanas") | Hecho | Trigger `credit_sale_reminder` crea la tarea `cobro` (vence a los X días, X editable, 14 por defecto; respaldo = administradora); RPC `mark_credit_paid` la cierra | psql: tarea "Cobrar a Doña Rosa: $25.50" vence 13-nov 10:00, resp. Beto, respaldo Majo; Kelly no puede marcar cobrado; cron local: "VENCIDA: Cobrar a Doña Rosa" simulado a Beto y a Majo |
| RF-25 | Saldos por cliente, de mayor a menor | REQ M5; TRA A3 14:00 | Hecho | `/cobros` "Saldos por cliente" (`balancesByCustomer`, une mayúsculas/espacios) | `cobros.test.ts` "saldos por cliente"; Playwright: total $85,50 → $35,50 tras "Cobrado" |
| RF-26 | Alerta de plazo de nota de crédito (8 días laborables desde la factura) para facturas marcadas | REQ M5; TRA A2 01:00 | Hecho | `/cobros` (admin) "Plazo de nota de crédito", `credit_note_watch` (0009), `creditNoteDeadline` + tarea `nota_credito` (avisos 2 días, 1 día y 4 h antes de las 17:00) | `cobros.test.ts` "8 días laborables"; Playwright: factura del 22-oct → "Último día: martes, 3 de noviembre" |
| RF-27 | Registrar pagos de Favorita y conciliarlos contra facturas del reporte | REQ M5; TRA A3 14:00 | Hecho | `/cobros/favorita`: `favorita_payments` + `purchase_orders.payment_id` (0009), `ReconcileForm` con diferencia en vivo y sugerencia de facturas más antiguas | `cobros.test.ts` "conciliación"; Playwright: pago $960 sugerido, "cuadra ✓" y "Cuadra exacto" |

## M6 Producción (REQ § M6)

| # | Requerimiento | Fuente | Estado | Dónde está en el código | Cómo se verificó |
|---|---|---|---|---|---|
| RF-28 | Grano seco a remojar según unidades ofertadas (800 × 300 g = 24 kg cocido; rendimiento 2× → 12 kg seco) | REQ M6; TRA A1 07:00–08:00 | Hecho | `/produccion`: plan por día de entrega desde la oferta de la semana (`grainPlan`, gramos y rendimiento por producto) + calculadora (`dryGrainKg`) | `produccion.test.ts`; captura: oferta 50 javas → "remojar 120 kg". El ejemplo del documento tiene un error de cuenta (ver BLOQUEOS.md #1) |
| RF-29 | Agendar cocción: lunes para martes, jueves para viernes | REQ M6; TRA A1 07:00 | Hecho | Migración 0010: tareas semanales "Cocinar granos para el martes/viernes" (lun/jue 08:00, aviso 16 h antes para remojar), idempotente | psql: aplicada dos veces → 2 filas y luego 0. Hora a confirmar (BLOQUEOS.md #2) |
| RF-30 | Rendimiento de champiñón: de 14 kg cuántas bandejas de 150 g, 90 g y 1 kg | REQ M6; TRA A3 10:00 | Hecho | `/produccion` calculadora (`mushroomTrays`: corchos, merma, reserva de 1 kg y 90 g) | `produccion.test.ts`; Playwright: 2 de 1 kg + 20 de 90 g → 68 de 150 g; 20 de 1 kg → "No alcanza" |

## M7 Reportes (REQ § M7)

| # | Requerimiento | Fuente | Estado | Dónde está en el código | Cómo se verificó |
|---|---|---|---|---|---|
| RF-31 | Ventas de champiñón por periodo y cliente | REQ M7; TRA A3 15:00–17:00 | Hecho | `/reportes` (periodo, filtro de producto sin tildes, por mes y por cliente; `salesReport`) | `reportes.test.ts`; captura con 122 ventas importadas: 8.073 u., $11.355,50, por mes y por cliente |
| RF-32 | Importar Excel del facturador (ventas, productos, cuentas por cobrar) e historial 2019–2023 | REQ M7; TRA A3 06:00–08:00 | Hecho | `/reportes` "Importar": `lib/hoja.ts` (lector .xlsx propio con `node:zlib` + CSV), `lib/importacion.ts` (columnas por nombre), tablas `sales`, `catalog_products`, `receivables` (0011); CxC se ven en Cobros | `importacion.test.ts` (xlsx real de prueba en `src/lib/fixtures`); Playwright: xlsx 2 filas, CSV 120 filas, reimportar → 0 nuevas, CxC 3 filas visibles en Cobros. Formato real del facturador sin confirmar (BLOQUEOS.md) |
| RF-33 | Sugerir cantidad de pedido según historial de ventas | REQ M7; TRA A3 20:00–21:00 | Hecho | `/pedidos` (admin): `suggestCorchos` promedia kg vendidos el mismo día de la semana (8 semanas) y redondea a corchos de 14 kg | `reportes.test.ts` "sugerencia de pedido"; Playwright: "Sugerido para mañana: 2 corchos (22,4 kg…)" |

## No funcionales (REQ § Requerimientos no funcionales)

| # | Requerimiento | Fuente | Estado | Dónde está en el código | Cómo se verificó |
|---|---|---|---|---|---|
| RNF-01 | Celular primero; usable en computadora | REQ | Parcial | Tailwind, `max-w-2xl`; nav de 4 botones no escala a más módulos | Fase 3 (UI) |
| RNF-02 | Uso simple: botones grandes, pocos pasos, español, sin términos técnicos | REQ | Parcial | `.btn` min-h-12; algunos textos técnicos ("Supabase (Authentication > Users)" en Equipo) | Fase 3 (UI) |
| RNF-03 | WhatsApp como canal principal; correo como alternativa | REQ; COS "Integración WhatsApp Cloud API y correo alternativo" | Hecho | `lib/email.ts` (API de Resend por `fetch`, simulado sin credenciales); `runReminders` usa correo si no hay teléfono o si WhatsApp falla; migración 0012 (`profiles.email`, `notifications.channel`); correo editable en Equipo | `reminders.test.ts` "correo como alternativa" (2 tests); cron local con Majo sin teléfono → `[Correo simulado] a majo@prueba.local: Recordatorio: Prueba correo`, aviso guardado con `channel=email` |
| RNF-04 | Inicio de sesión por usuario; solo Majo ve montos de préstamos y pagos | REQ | Hecho | Login Supabase; RLS `payments`/`cheques` solo admin (0007); `/pagos` usa `requireAdmin`; los avisos no llevan monto | psql como Beto: `select count(*) from payments` = 0 e insert en cheques rechazado por RLS; Playwright: Beto en `/pagos` → redirigido a `/` |
| RNF-05 | Zona horaria America/Guayaquil y montos en USD | REQ | Hecho | `lib/time.ts` (UTC-5 fijo, `localDate`, `formatUSD`) | `time.test.ts`, `obligation-form.test.ts` "convierte la hora local de Ecuador" |
| RNF-06 | Respaldo diario de los datos; no compartir datos financieros con terceros | REQ; COS Mantenimiento "Script en GitHub Actions" | Hecho | `scripts/respaldo.sh` (pg_dump de usuarios + esquema public, gzip, cifrado AES-256 con gpg) y `.github/workflows/respaldo-diario.yml` (03:00 Ecuador, artefacto 30 días) | Local: respaldo generado y cifrado; clave incorrecta rechazada; BD local vaciada y restaurada desde el respaldo → app y RLS funcionando (Beto ve 0 pagos, Majo ve todo). El workflow en GitHub no se ejecutó (sin push; BLOQUEOS.md) |
| RNF-07 | Costo mensual bajo | REQ | No aplica | Decisión de infraestructura (ver DECISIONES.md) | — |
| RNF-08 | Avisos puntuales | REQ | Hecho | `cron.sql` cada 5 min (pg_cron) + reserva de slot antes de enviar + reintento si falla | Cron local (`/api/cron/reminders`): recordatorios y "VENCIDA" simulados en el minuto; tests de `planNotifications` y `runReminders`. pg_cron de producción sin probar (BLOQUEOS.md) |
| SEC-1 | Registro público deshabilitado | CLAUDE.md | Hecho | `supabase/config.toml` `enable_signup = false` | Revisado en config |

## Cierre (COS filas "Cierre")

| # | Requerimiento | Fuente | Estado | Dónde está en el código | Cómo se verificó |
|---|---|---|---|---|---|
| CIE-1 | Manual de uso sencillo | COS Cierre | Falta | — | — |
| CIE-2 | Capacitación a Majo, Beto y Kelly | COS Cierre | No aplica | Actividad presencial | — |

## Orden de trabajo (pendientes por prioridad)

1. **P0** RF-05/RF-06 (Hoy: hora de "hecho", urgencia), RF-21 (etiquetas 2 veces/mes) — uso diario de M1.
2. **P1** M4: RF-19, RF-20, RF-22 (pedido diario de champiñón).
3. **P1** M3: RF-15, RF-16, RF-17, RF-18 + RNF-04 (montos solo admin).
4. **P1** M2: RF-08…RF-13.
5. **P2** M5: RF-23…RF-27.
6. **P2** M6: RF-28…RF-30 (+ RF-07 cocción).
7. **P3** M7: RF-31…RF-33; RNF-03 correo; RNF-06 respaldo; RF-14; manual.

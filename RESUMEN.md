# RESUMEN – noche del 31-oct-2026 (rama `noche-completar`)

Todo está en la rama `noche-completar` (sin push, sin despliegue, sin tocar Supabase de producción, WhatsApp solo simulado). Cada requerimiento tiene su fila en **CHECKLIST.md**: 33 RF + 8 RNF + cierre, todo en **Hecho** salvo 2 **No aplica** justificados (RNF-07 costo, CIE-2 capacitación presencial).

Estado final: **`npm test` 120 tests OK · `npm run lint` sin errores · `npm run build` OK.** Línea base al empezar: 56 tests.

## Qué se completó

| Módulo | Qué hace ahora | Pantalla |
| --- | --- | --- |
| M1 Recordatorios | Ya existía. Se agregó: hora en "Hecha por", tareas mensuales 2 veces al mes (etiquetas), tareas de cocción precargadas, correo como canal alternativo | Hoy, Tareas |
| M2 Favorita | Enlace semanal con cierre miércoles 19:00, javas por producto y día con control de la buseta (100), datos listos para copiar o **formulario prellenado** si el enlace es de Google Forms, órdenes de compra con aviso de entrega y alerta "entregada sin factura" | Favorita, Productos, Nueva orden |
| M3 Pagos | Préstamos y pagos fijos con aviso para transferir a la cuenta correcta (sin monto, cuenta enmascarada), calendario mensual con total por semana, cheques posfechados | Pagos (solo Majo) |
| M4 Pedidos | Registro de pedidos (corchos de 14 kg), aviso de pedido de fin de semana, marcar la tarea del día al registrar, historial por proveedor, cantidad sugerida | Pedidos |
| M5 Cobros | Ventas fiadas con aviso automático al vendedor y a Majo a los X días, saldos por cliente, plazo de nota de crédito (8 días laborables), conciliación de pagos de Favorita | Cobros, Pagos de Favorita |
| M6 Producción | Grano a remojar desde la oferta de la semana, calculadoras de grano y de bandejas de champiñón | Producción |
| M7 Reportes | Importar Excel/CSV del facturador (ventas, productos, cuentas por cobrar; sin duplicar), ventas por periodo, mes y cliente | Reportes |
| RNF-03 | Correo (Resend) si no hay WhatsApp o si falla | — |
| RNF-06 | Respaldo diario cifrado con GitHub Actions; restauración probada | `scripts/respaldo.sh` |
| Cierre | Manual de uso para Majo, Beto y Kelly | `docs/manual-de-uso.md` |

Migraciones nuevas: **0005 a 0012** (todas con RLS). Se probó `supabase db reset` aplicando 0001→0012 + seed desde cero.

## Mejoras de interfaz

- Sistema visual propio ("cuaderno de campo"): papel cálido, tierra y verde musgo, con contraste AA comprobado en claro y oscuro. Títulos en Fraunces, texto en Lexend (pensada para leer con poco esfuerzo).
- **Celular**: barra inferior fija (Hoy, Pedidos, Cobros, Tareas, Más). **Computadora**: menú lateral.
- Hoy: saludo con fecha, resumen (vencidas / para hoy / hechas), franja de color por urgencia, botón "Hecho" grande.
- Estados claros: "Guardando…" en cada botón, mensajes de confirmación y de error, estados vacíos con qué hacer, pantalla de carga y de error con "Intentar otra vez".
- Eliminar pide un segundo toque (sin ventanas del navegador).
- Accesibilidad: "Saltar al contenido", foco visible, etiquetas en todos los campos, botones de 48 px; auditoría automática sin problemas en 16 pantallas.
- Se revisaron las 14 pantallas principales en 390 px y 1280 px, claro y oscuro, más login y la vista de un operativo.

## Decisiones clave (detalle en DECISIONES.md)

- Los avisos de cada módulo son **obligaciones derivadas**: un solo motor de avisos (repetición, respaldo, "Recordar en 1 h", panel) para todo.
- Beto registra ventas fiadas pero no puede crear tareas: un **trigger de BD** crea el aviso de cobro.
- Montos de préstamos, pagos, Favorita y reportes: **solo la administradora** (RLS). Los avisos que ve el equipo no llevan montos.
- Lector de Excel propio (sin librería: `xlsx` en npm está desactualizado).
- RF-28: la app usa la cuenta correcta (800 × 300 g = 240 kg); el ejemplo del documento dice 24 kg.
- Sin librerías de UI nuevas; la única "dependencia" agregada son las fuentes de Google vía `next/font` (incluido en Next).

## Bloqueos / pendiente de datos reales (detalle en BLOQUEOS.md)

1. Confirmar con Majo: gramaje real por unidad (RF-28), días y hora de cocción (RF-29), día del pedido de fin de semana, días para avisar cobros (14 por defecto).
2. Formato real del Excel del facturador (RF-32) y del historial 2019–2023.
3. Enlace real del formulario de Favorita (RF-14).
4. WhatsApp, correo, cron y respaldo en GitHub no se probaron contra servicios reales.

## Qué debes probar tú con Supabase y WhatsApp reales

1. **Migraciones**: en el SQL Editor de producción ejecuta, en orden, `0005` a `0012`. Revisa que *Allow new users to sign up* siga desactivado.
2. **Variables en Vercel**: las de `.env.example`. Opcional: `RESEND_API_KEY` y `EMAIL_FROM`.
3. **Equipo**: completa WhatsApp y correo de Majo, Beto y Kelly.
4. **WhatsApp**: plantilla `recordatorio_tarea` aprobada con botones "Hecho" y "Recordar en 1 h". Crea una tarea "Una sola vez" para dentro de 70 min con aviso "1 hora antes", espera el aviso, prueba ambos botones desde el celular y mira que en Hoy quede "Hecha por … · hora".
5. **Cobros**: como Beto, registra una venta fiada con fecha de hace 20 días → en ~10 min debe llegar "VENCIDA: Cobrar a …" a Beto y a Majo. Toca "Cobrado" y verifica que no lleguen más avisos.
6. **Favorita**: el lunes, pega el enlace real. Si aparece "Abrir formulario lleno", revisa cada campo antes de enviar.
7. **Reportes**: importa un Excel real de ventas del facturador y el historial; si dice "No se encontraron las columnas", mándame la primera fila del archivo.
8. **Respaldo**: agrega los secretos `SUPABASE_DB_URL` y `BACKUP_PASSPHRASE` en GitHub y lanza "Respaldo diario" a mano; descarga el artefacto y prueba `gpg -d … | gunzip | head`.
9. **Correo**: quita temporalmente el WhatsApp de alguien y confirma que el aviso le llega por correo.

## Cómo probar en local (como lo hice)

```bash
npx supabase start            # Docker; aplica migraciones y seed
# .env.local con las claves locales que imprime el comando
npm run dev
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```
Usuarios de prueba creados en local: majo / beto / kelly `@prueba.local` (solo existen en tu Docker).

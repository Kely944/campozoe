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
9. **RF-20 "pedido que cubre fin de semana": se destaca toda entrega de champiñón para sábado, domingo o lunes.** Alternativa: un solo día fijo. El día exacto es pregunta abierta (el audio dice "lo pido hoy [sábado] para el lunes"; el seed usa viernes). Destacar los tres días no deja pasar ninguno.
10. **Registrar un pedido puede marcar hecha la tarea de hoy** (selector preseleccionado si el título coincide con el proveedor). Menos toques para Majo (RNF-02); usa la RPC `mark_done`, no actualiza `occurrences` directo.
11. **Pedidos: todo el equipo ve y registra; borra quien lo hizo o la administradora; no hay edición** (se borra y se vuelve a registrar). Menos superficie de RLS.
12. **Avisos de módulos = obligaciones vinculadas** (`obligations.source` + `obligation_id` en la tabla del módulo). Alternativa: un segundo motor de avisos por módulo. Reusar obligaciones mantiene un solo cron, repetición, respaldo, "Recordar en 1 h", botón "Hecho" y el panel de cumplimiento.
13. **RNF-04 con avisos visibles para el equipo**: la tarea de transferencia no lleva monto y la cuenta va enmascarada (…3456); montos y cuenta completa solo en `/pagos` (RLS admin). Alternativa: ocultar las tareas de pago a los operativos, pero las obligaciones ya son visibles para todos por diseño (M1).
14. **Calendario de pagos: semanas de lunes a domingo recortadas al mes**; los cheques "emitidos" cuentan en la semana de su fecha posfechada. Los cobrados/anulados no suman.
15. **Código de proveedor y centro de acopio son datos del negocio (`app_settings`, una fila), el código de barras es por producto.** El requerimiento los llama "datos fijos de cada producto", pero en el audio el código de proveedor y el CAF 400 son los mismos para todos; guardarlos una vez evita errores. Se muestran en el bloque de cada producto.
16. **Capacidad de la buseta por día de entrega** (miércoles y viernes son viajes distintos) y editable (100 por defecto). Superarla avisa pero no impide guardar: puede haber dos viajes.
17. **M2 es solo para la administradora** (RLS `is_admin()` en todas sus tablas). Quien entrega recibe el aviso como tarea, sin ver montos de factura.
18. **"Factura pendiente" vence a las 18:00 del día de entrega** porque el facturador y el SRI solo autorizan facturas con fecha de hoy (audio 3, 03:00). Si se entrega después de las 16:00, vence 2 h después.
19. **RF-24 con trigger de BD**: los operativos (Beto) registran ventas pero RLS no les deja crear obligaciones; un trigger `security definer` crea el aviso de cobro y la RPC `mark_credit_paid` lo cierra. La seguridad sigue en la BD; nadie edita montos salvo la administradora.
20. **X días = 14 por defecto, editable por la administradora** (pregunta abierta; el audio 2 dice "pasado dos semanas"). Aplica a ventas nuevas.
21. **Nota de crédito: 8 días laborables lunes–viernes sin feriados.** Ignorar feriados adelanta el plazo, nunca lo atrasa (más conservador). Vence a las 17:00.
22. **Conciliación de Favorita: la sugerencia toma las facturas más antiguas que suman exacto**, porque Favorita paga por antigüedad (audio 3, 13:00–14:00); si no cuadra, Majo elige a mano y se guarda con la diferencia visible. Alternativa (subconjunto cualquiera que sume) es costosa y puede elegir facturas equivocadas.
23. **Formulario de venta fiada siempre visible** (no plegado): es la acción principal de Beto en esa pantalla.

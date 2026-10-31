# BLOQUEOS y pendientes de validar con datos reales

Nada de esto impide usar la app; son puntos que no se pueden cerrar sin Majo, Supabase de producción o WhatsApp real.

## Preguntas abiertas que afectan cálculos o avisos

1. **RF-28: el ejemplo del requerimiento no cuadra.** Dice "800 unidades × 300 g = 24 kg cocido". 800 × 300 g = 240 000 g = **240 kg** (en el audio 1, 08:00, también se dice "24.000 gramos"). La app calcula con la cuenta correcta: con 300 g por unidad salen 240 kg cocido y 120 kg de grano seco con rendimiento 2. Confirmar con Majo el gramaje real por unidad (¿30 g de grano seco por unidad?) y cargarlo en Favorita > Productos.
2. **RF-29: días de cocción.** El requerimiento dice "lunes para el martes y jueves para el viernes", pero Favorita recibe miércoles y viernes. Se crearon las tareas tal como dice el requerimiento (lunes y jueves, 08:00, "a confirmar") y el plan de grano se muestra por día de entrega (miércoles/viernes). Ajustar la hora y los días en Tareas cuando Majo confirme.
3. **RF-32: formato real del facturador.** No se tuvo un Excel exportado de "Visual Fact" (nombre a confirmar). El importador reconoce las columnas por el título (Fecha/Fecha emisión, Cliente/Razón social, Producto/Descripción/Ítem, Cantidad, Total/Valor, Factura/Número/Recibo; para cuentas por cobrar: Cliente y Saldo). Solo lee .xlsx y .csv: si el facturador exporta .xls antiguo, hay que abrirlo en Excel y "Guardar como" .xlsx. **Probar con un archivo real** de ventas, productos y cuentas por cobrar, y con el Excel del historial 2019–2023.
4. **RF-33: la sugerencia de pedido supone** que la entrega del sábado cubre sábado y domingo y que el peso de la bandeja está en el nombre del producto ("150 G", "90 g", "1 kg"). Revisar con el historial real.

## Requiere servicios reales (no se tocaron en esta rama)

5. **WhatsApp real:** todo se probó en modo simulado (`[WhatsApp simulado]`). Falta: plantilla `recordatorio_tarea` aprobada con los botones "Hecho" y "Recordar en 1 h", webhook con firma real y prueba de los dos botones desde un celular.
6. **Correo real (RNF-03):** probado en modo simulado (`[Correo simulado]`). Para activarlo: cuenta en resend.com, dominio verificado, `RESEND_API_KEY` y `EMAIL_FROM` en Vercel.
7. **Cron en producción (RNF-08):** `supabase/cron.sql` con `pg_cron` + `pg_net` cada 5 minutos no se probó contra Vercel. Revisar que lleguen los avisos y que no se dupliquen.
8. **Migraciones 0005 a 0012** solo se aplicaron en Supabase local. En producción se ejecutan en orden en el SQL Editor (ver README).
9. **Respaldo diario (RNF-06):** el script se probó en local (respaldo, cifrado y restauración completa). El workflow `.github/workflows/respaldo-diario.yml` no se ejecutó en GitHub porque no se hizo push. Para activarlo: agregar los secretos `SUPABASE_DB_URL` y `BACKUP_PASSPHRASE` y lanzarlo a mano una vez (Actions > Respaldo diario > Run workflow). Guardar la clave fuera de GitHub. Si el plan pasa a Supabase Pro, ya incluye respaldo diario.
10. **RF-14 formulario prellenado:** probado con la estructura conocida de Formularios de Google, no con un enlace real de Favorita (pregunta abierta: "¿el enlace es siempre un formulario de Google con los mismos campos?"). Probar el lunes con el enlace de la semana: si aparece "Abrir formulario lleno", revisar que cada campo quede bien antes de enviar. Si no aparece, la app sigue con los datos para copiar.

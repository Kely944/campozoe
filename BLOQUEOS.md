# BLOQUEOS y pendientes de validar con datos reales

Nada de esto impide usar la app; son puntos que no se pueden cerrar sin Majo, Supabase de producción o WhatsApp real.

## Preguntas abiertas que afectan cálculos o avisos

1. **RF-28: el ejemplo del requerimiento no cuadra.** Dice "800 unidades × 300 g = 24 kg cocido". 800 × 300 g = 240 000 g = **240 kg** (en el audio 1, 08:00, también se dice "24.000 gramos"). La app calcula con la cuenta correcta: con 300 g por unidad salen 240 kg cocido y 120 kg de grano seco con rendimiento 2. Confirmar con Majo el gramaje real por unidad (¿30 g de grano seco por unidad?) y cargarlo en Favorita > Productos.
2. **RF-29: días de cocción.** El requerimiento dice "lunes para el martes y jueves para el viernes", pero Favorita recibe miércoles y viernes. Se crearon las tareas tal como dice el requerimiento (lunes y jueves, 08:00, "a confirmar") y el plan de grano se muestra por día de entrega (miércoles/viernes). Ajustar la hora y los días en Tareas cuando Majo confirme.

-- Obligaciones precargadas (RF-07). Valores tomados de los audios; los marcados
-- "a confirmar" están en las preguntas abiertas del documento de requerimientos.
-- Ejecutar después de la migración. Asignar responsables desde la app.

insert into public.obligations
  (title, description, frequency, time_of_day, weekdays, day_of_month, reminder_offsets_min, repeat_every_min, escalate_before_min, priority)
values
  ('Enviar oferta semanal a Corporación Favorita',
   'Abrir el enlace de la semana (llega el lunes por WhatsApp) y llenar un formulario por producto: código de proveedor, CAF 400, código de barras, javas y día de entrega. Fuera de plazo descuentan el 10%.',
   'weekly', '19:00', '{3}', null, '{2880,1440,240,60}', 120, 240, 'alta'),

  ('Pedido diario de champiñón',
   'Pedir en el grupo de WhatsApp del proveedor, en corchos de 14 kg. Hora de corte 9:00 (a confirmar si es 9:00 o 10:00).',
   'daily', '09:00', '{1,2,3,4,6}', null, '{960,60}', 30, 45, 'normal'),

  ('Pedido de champiñón para sábado a lunes',
   'Si se olvida, quedan 3 días sin champiñón para vender. Día exacto a confirmar.',
   'weekly', '09:00', '{5}', null, '{960,120,60}', 20, 60, 'alta'),

  ('Pedido de etiquetas',
   'Enviar el pedido antes de las 11:00; si no, una semana sin etiquetas. Frecuencia y día a confirmar.',
   'monthly', '11:00', null, 1, '{1440,120}', 60, null, 'normal'),

  ('Transferir para cuota de préstamo',
   'Pasar el dinero a la cuenta de débito antes del cobro de la cuota. Ejemplo: crear una por cada préstamo con su banco y día.',
   'monthly', '10:00', null, 5, '{4320,1440,240}', 240, 240, 'alta');

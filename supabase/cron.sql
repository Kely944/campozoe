-- Llama al endpoint de recordatorios cada 5 minutos desde Supabase.
-- (El plan gratis de Vercel solo permite cron una vez al día; por eso se usa pg_cron.)
-- 1. Database > Extensions: activar "pg_cron" y "pg_net".
-- 2. Reemplazar TU-APP y TU_CRON_SECRET, y ejecutar.

select cron.schedule(
  'm1-recordatorios',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://TU-APP.vercel.app/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET')
  );
  $$
);

-- Para quitarlo: select cron.unschedule('m1-recordatorios');

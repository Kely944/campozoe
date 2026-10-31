# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Pendientes Majo" — PWA that reminds a small business (Ecuador) of deadlines via WhatsApp and keeps repeating until someone marks the task done, escalating to a backup person. Next.js 15 (App Router) + React 19 + Tailwind 4, Supabase (Postgres + Auth), WhatsApp Business Cloud API, hosted on Vercel. UI text, comments, commit messages and docs are in **Spanish**; keep that convention.

## Commands

```bash
npm run dev                     # http://localhost:3000
npm run build
npm run lint                    # eslint (flat config, next/core-web-vitals)
npm test                        # vitest run (all *.test.ts in src/lib)
npx vitest run src/lib/schedule.test.ts      # single file
npx vitest run -t "diaria"                   # single test by name
```

Trigger one reminder cycle locally:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

Env vars (`.env.local`, gitignored; README mentions a `.env.example` that is not in the repo): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and optionally `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG`. Without WhatsApp credentials, sends are simulated and logged as `[WhatsApp simulado]`.

## Architecture

**Data model** (`supabase/migrations/`, applied manually in order via the Supabase SQL Editor — no migration runner; `seed.sql` preloads obligations; `cron.sql` schedules the cron via `pg_cron` + `pg_net` every 5 min because Vercel free tier only allows daily cron):
- `obligations` — recurring rule (`once|daily|weekly|monthly`, `time_of_day`, `weekdays`, `day_of_month`, `starts_on`), reminder offsets, repeat interval, escalation threshold, `responsible_id`, `backup_id`.
- `occurrences` — concrete due dates per obligation (unique on `obligation_id,due_at`), `status pending|done`.
- `notifications` — one row per sent notice, keyed by `(occurrence, recipient, slot)`; `notification_failures` logs failed sends (via `log_notification_failure` RPC).
- `profiles` — `role` (`admin` or not) and `phone`. `is_admin()` drives RLS.

**Security lives in the DB.** RLS: everyone authenticated can read obligations/occurrences; only admins write obligations or read notifications. Marking done/undo goes only through `mark_done` / `undo_done` security-definer RPCs (migration 0002) — never update `occurrences` directly from the app. Server actions (`src/app/actions.ts`) use the user-session client (`lib/supabase/server.ts`, respects RLS); only the cron and WhatsApp webhook use the service-role client (`lib/supabase/admin.ts`). Public sign-up must stay disabled in Supabase.

**Reminder pipeline:**
1. `api/cron/reminders` (Bearer `CRON_SECRET`) → `runReminders` in `lib/reminders.ts`.
2. `ensureOccurrences` materializes occurrences for the next 14 days from `generateOccurrences` (`lib/schedule.ts`). `saveObligation` also calls it after deleting future pending occurrences when a rule changes.
3. For each pending occurrence, pure function `planNotifications` decides which slots to send now: `reminder:<offset>` (only the nearest reached offset), `repeat:<n>` (only inside the action window, i.e. from the smallest offset to the deadline), `snooze:<untilMs>` (one notice when a "Recordar en 1 h" pause ends; the pause mutes reminders/repeats to the responsible only), `escalation` (to backup), `overdue` (to both). Quiet hours 21:00–07:00 local. No responsible → falls back to first admin.
4. Slot is **claimed by inserting the `notifications` row before sending** (unique constraint prevents duplicates across concurrent runs); on send failure the row is deleted so the next run retries.
5. `lib/whatsapp.ts` sends the approved template `recordatorio_tarea` with two quick-reply buttons, payloads `done:<occurrenceId>` and `snooze:<occurrenceId>` (sets `occurrences.snoozed_until` = now + 1 h, migration 0004); `api/whatsapp/webhook` verifies `x-hub-signature-256` and acts only if the sender phone belongs to the responsible, backup, or an admin.

**Time handling:** all scheduling uses `lib/time.ts` — Ecuador is fixed UTC-5 (no DST), implemented with a constant offset, not `Intl`. Use `toLocal`/`fromLocal`/`parseLocalDateTime` rather than `Date` local methods (server runs in UTC).

**Pure logic vs. I/O:** testable logic sits in `lib/schedule.ts`, `lib/obligation-form.ts` (FormData parsing/validation), and `lib/dashboard.ts` (admin panel bucketing/classification), each with a co-located `*.test.ts`. DB/network code (`reminders.ts`, `whatsapp.ts`, `session.ts`) is `server-only`. Put new business rules in the pure modules and test there.

**App routes:** `src/app/(app)/` is the authenticated shell (layout calls `requireProfile()`); `/` = "Hoy y esta semana", `/obligaciones` CRUD, `/equipo` phones, `/admin` charts (admins only). `middleware.ts` redirects unauthenticated users to `/login` and excludes `/api` (cron and webhook authenticate themselves).

**Dark mode:** class-based (`.dark` on `<html>`, `@custom-variant dark` in `globals.css`), set pre-hydration by an inline script in `app/layout.tsx` from `localStorage.theme`. Shared component classes (`.input`, `.btn-primary`, `.card`, …) are defined with `@apply` in `globals.css`.

## Docs

`docs/superpowers/` holds design spec and plan for the admin panel; `documentación/` holds requirements, elicitation transcripts and cost sheets (docx/xlsx).

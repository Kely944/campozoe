import { NextResponse, type NextRequest } from "next/server";
import { runReminders } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const summary = await runReminders(createAdminClient());
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;

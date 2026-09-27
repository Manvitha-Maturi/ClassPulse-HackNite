// app/api/sessions/[id]/dashboard/route.ts — one endpoint returns everything the dashboard renders
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadSessionData } from "@/lib/data";
import { buildTimeline, computeStats, detectAlerts, sessionEndMin } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await loadSessionData(supabase, id);
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const now = new Date();
  const timeline = buildTimeline(data.session, data.students, data.logs, data.events, now);
  return NextResponse.json({
    session: data.session,
    elapsedMin: sessionEndMin(data.session, now),
    stats: computeStats(data.session, timeline),
    alerts: detectAlerts(data.session, data.logs),
    timeline,
    generatedAt: now.toISOString(),
  });
}

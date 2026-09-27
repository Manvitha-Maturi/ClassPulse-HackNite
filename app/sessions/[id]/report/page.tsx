// app/sessions/[id]/report/page.tsx — frozen, printable post-session report.
// Server-rendered from the same metrics as the dashboard; no realtime, no simulator, no now line.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AlertBar from "@/components/AlertBar";
import BriefingPanel from "@/components/BriefingPanel";
import ParticipationPanel from "@/components/ParticipationPanel";
import PrintButton from "@/components/PrintButton";
import StatCards from "@/components/StatCards";
import Timeline from "@/components/Timeline";
import { loadSessionData } from "@/lib/data";
import { formatUtc } from "@/lib/format";
import { buildTimeline, computeStats, detectAlerts, sessionEndMin } from "@/lib/metrics";
import { createClient } from "@/lib/supabase/server";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes this to the instructor's own sessions.
  const data = await loadSessionData(supabase, id);
  if (!data) notFound();

  const now = new Date();
  const { session } = data;
  const ended = session.status === "ended";
  const timeline = buildTimeline(session, data.students, data.logs, data.events, now);
  const stats = computeStats(session, timeline);
  const alerts = detectAlerts(session, data.logs);
  const elapsedMin = sessionEndMin(session, now);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 print:max-w-none print:px-0 print:py-0">
      <Link href={`/sessions/${session.id}`} className="text-sm text-slate-500 hover:text-slate-700 print:hidden">
        ← Back to dashboard
      </Link>

      <div className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
        {ended ? "Session ended — report" : `Session in progress — snapshot at minute ${Math.floor(elapsedMin)}`}
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            <span className="font-mono text-slate-500">{session.course_code}</span>
            {session.course_name && <span className="ml-2">{session.course_name}</span>}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatUtc(session.started_at)} · {session.duration_minutes} min · {session.polls_launched} poll
            {session.polls_launched === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-slate-400">Generated {formatUtc(now.toISOString())}</p>
        </div>
        <PrintButton />
      </header>

      <StatCards stats={stats} />
      <AlertBar alerts={alerts} />
      <BriefingPanel sessionId={session.id} alertSignature="" refreshable={false} />
      <Timeline timeline={timeline} durationMin={session.duration_minutes} elapsedMin={elapsedMin} live={false} />
      <ParticipationPanel timeline={timeline} pollsLaunched={session.polls_launched} />

      <p className="text-xs text-slate-400">
        ClassPulse uses join/leave events and event kinds only. No video, audio, or chat text is collected, and
        live interaction is shown for context, never scored.
      </p>
    </main>
  );
}

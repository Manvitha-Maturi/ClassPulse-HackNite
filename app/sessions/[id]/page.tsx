"use client";

// app/sessions/[id]/page.tsx — live dashboard for one session, rendered from GET /api/sessions/[id]/dashboard.
// Data changes arrive via Supabase Realtime (no polling); a 15s clock only moves the "now" line on live sessions.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import AlertBar from "@/components/AlertBar";
import LiveBadge from "@/components/LiveBadge";
import ParticipationPanel from "@/components/ParticipationPanel";
import SimulatorPanel, { DEMO_MODE } from "@/components/SimulatorPanel";
import StatCards from "@/components/StatCards";
import Timeline from "@/components/Timeline";
import UpdatedAgo from "@/components/UpdatedAgo";
import { useSessionRealtime, type RealtimeStatus } from "@/components/useSessionRealtime";
import { formatUtc } from "@/lib/format";
import type { DashboardResponse } from "@/lib/types";

const CLOCK_TICK_MS = 15_000;

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: DashboardResponse; receivedAt: number };

async function fetchDashboard(id: string): Promise<LoadState | "unauthorized"> {
  try {
    const res = await fetch(`/api/sessions/${id}/dashboard`, { cache: "no-store" });
    if (res.status === 401) return "unauthorized";
    if (res.status === 404) return { kind: "error", message: "Session not found." };
    if (!res.ok) return { kind: "error", message: `Dashboard request failed (${res.status}).` };
    return { kind: "ready", data: (await res.json()) as DashboardResponse, receivedAt: Date.now() };
  } catch {
    return { kind: "error", message: "Could not reach the server." };
  }
}

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  // Bumping this refetches the dashboard; realtime changes do it.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const realtime = useSessionRealtime(id, reload);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard(id).then((result) => {
      if (cancelled) return;
      if (result === "unauthorized") router.replace("/login");
      // Keep showing the last good data if a background refetch fails.
      else setState((prev) => (result.kind === "error" && prev.kind === "ready" ? prev : result));
    });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey, router]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <Link href="/sessions" className="text-sm text-slate-500 hover:text-slate-700">
        ← All sessions
      </Link>

      {state.kind === "loading" && <p className="text-slate-500">Loading dashboard…</p>}

      {state.kind === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      {state.kind === "ready" && <Dashboard data={state.data} receivedAt={state.receivedAt} realtime={realtime} />}
    </main>
  );
}

function Dashboard({
  data,
  receivedAt,
  realtime,
}: {
  data: DashboardResponse;
  receivedAt: number;
  realtime: RealtimeStatus;
}) {
  const { session, stats, alerts, timeline, elapsedMin } = data;
  const live = session.status === "live";

  // Advance the "now" line between data updates without refetching.
  const [clock, setClock] = useState(receivedAt);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setClock(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, [live]);
  const sinceFetchMin = Math.max(0, (clock - receivedAt) / 60000);
  const nowMin = live ? Math.min(session.duration_minutes, elapsedMin + sinceFetchMin) : elapsedMin;

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              <span className="font-mono text-slate-500">{session.course_code}</span>
              {session.course_name && <span className="ml-2">{session.course_name}</span>}
            </h1>
            {live ? (
              <LiveBadge />
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Ended</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {formatUtc(session.started_at)} · {session.duration_minutes} min
            {live && ` · ${Math.floor(nowMin)} min elapsed`}
          </p>
          <div className="mt-1">
            <UpdatedAgo receivedAt={receivedAt} status={realtime} />
          </div>
        </div>
        <Link
          href={`/sessions/${session.id}/report`}
          className="w-fit rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Report
        </Link>
      </header>

      {live && DEMO_MODE && <SimulatorPanel sessionId={session.id} />}
      <StatCards stats={stats} />
      <AlertBar alerts={alerts} />
      <Timeline
        timeline={timeline}
        durationMin={session.duration_minutes}
        elapsedMin={elapsedMin}
        nowMin={nowMin}
        live={live}
      />
      <ParticipationPanel timeline={timeline} pollsLaunched={session.polls_launched} />
    </>
  );
}

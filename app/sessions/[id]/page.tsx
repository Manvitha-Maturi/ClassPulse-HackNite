"use client";

// app/sessions/[id]/page.tsx — live dashboard for one session, rendered from GET /api/sessions/[id]/dashboard.
// Data changes arrive via Supabase Realtime (no polling); a 15s clock only moves the "now" line on live sessions.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import AlertBar from "@/components/AlertBar";
import AskPanel from "@/components/AskPanel";
import BriefingPanel from "@/components/BriefingPanel";
import { ArrowLeftIcon, ReportIcon } from "@/components/icons";
import ParticipationPanel from "@/components/ParticipationPanel";
import SessionHeader from "@/components/SessionHeader";
import SimulatorPanel, { DEMO_MODE } from "@/components/SimulatorPanel";
import StatCards from "@/components/StatCards";
import Timeline from "@/components/Timeline";
import UpdatedAgo from "@/components/UpdatedAgo";
import { useSessionRealtime, type RealtimeStatus } from "@/components/useSessionRealtime";
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
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        All sessions
      </Link>

      {state.kind === "loading" && <DashboardSkeleton />}

      {state.kind === "error" && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.message}
        </p>
      )}

      {state.kind === "ready" && <Dashboard data={state.data} receivedAt={state.receivedAt} realtime={realtime} />}
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <div className="h-36 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/80" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/80" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/80" />
    </div>
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
      <SessionHeader
        session={session}
        nowMin={nowMin}
        status={<UpdatedAgo receivedAt={receivedAt} status={realtime} />}
        actions={
          <Link
            href={`/sessions/${session.id}/report`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
          >
            <ReportIcon className="h-4 w-4" />
            Report
          </Link>
        }
      />

      {live && DEMO_MODE && <SimulatorPanel sessionId={session.id} />}
      <StatCards stats={stats} />
      <AlertBar alerts={alerts} />
      <BriefingPanel
        sessionId={session.id}
        alertSignature={
          live
            ? [
                alerts.map((a) => `${a.startMin}:${a.affectedCount}`).join("|"),
                `polls:${session.polls_launched}`,
                `connected:${stats.connectedNow}`,
              ].join(";")
            : ""
        }
      />
      <AskPanel sessionId={session.id} />
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

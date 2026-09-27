// components/SessionHeader.tsx — hero card for a session (dashboard and report).
import type { ReactNode } from "react";
import type { SessionData } from "@/lib/data";
import { formatUtc } from "@/lib/format";
import LiveBadge from "./LiveBadge";
import { CalendarIcon, ClockIcon, PollIcon } from "./icons";

type Props = {
  session: SessionData["session"];
  /** Minutes elapsed; shows a progress bar on live sessions. */
  nowMin?: number;
  /** Extra line under the meta row (e.g. "Updated Xs ago"). */
  status?: ReactNode;
  /** Right-hand actions (Report / Export PDF). */
  actions?: ReactNode;
};

export default function SessionHeader({ session, nowMin, status, actions }: Props) {
  const live = session.status === "live";
  const progress = live && nowMin !== undefined ? Math.min(100, (nowMin / session.duration_minutes) * 100) : null;

  return (
    <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-200/50 to-violet-200/40 blur-3xl print:hidden"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-lg bg-indigo-50 px-2 py-1 font-mono text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
              {session.course_code}
            </span>
            {live ? (
              <LiveBadge />
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Ended</span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {session.course_name ?? session.course_code}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              {formatUtc(session.started_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" />
              {live && nowMin !== undefined
                ? `${Math.floor(nowMin)} of ${session.duration_minutes} min`
                : `${session.duration_minutes} min`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PollIcon className="h-4 w-4" />
              {session.polls_launched} poll{session.polls_launched === 1 ? "" : "s"}
            </span>
          </p>
          {status && <div className="mt-2">{status}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {progress !== null && (
        <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-[width] duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </header>
  );
}

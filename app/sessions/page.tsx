// app/sessions/page.tsx — session picker: the instructor's sessions, newest first (RLS scopes the query).
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatUtc } from "@/lib/format";
import LiveBadge from "@/components/LiveBadge";
import StartLiveDemoButton from "@/components/StartLiveDemoButton";
import { CalendarIcon, ChevronRightIcon, ClockIcon, PulseIcon } from "@/components/icons";

type SessionRow = {
  id: string;
  course_code: string;
  course_name: string | null;
  started_at: string;
  duration_minutes: number;
  status: "live" | "ended";
};

export default async function SessionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, course_code, course_name, started_at, duration_minutes, status")
    .order("started_at", { ascending: false })
    .returns<SessionRow[]>();

  const liveCount = sessions?.filter((s) => s.status === "live").length ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your sessions</h1>
          <p className="mt-1.5 text-slate-500">
            {sessions?.length ?? 0} session{sessions?.length === 1 ? "" : "s"}
            {liveCount > 0 && <span className="text-emerald-600"> · {liveCount} live now</span>}
          </p>
        </div>
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && <StartLiveDemoButton />}
      </div>

      {error ? (
        <p role="alert" className="mt-8 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Could not load sessions: {error.message}
        </p>
      ) : !sessions?.length ? (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <PulseIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 font-medium text-slate-900">No sessions yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Run <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">npm run seed</code> or start a
            live demo.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {sessions.map((s) => {
            const live = s.status === "live";
            return (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100 sm:p-5"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-mono text-[11px] font-bold ${
                      live ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-indigo-50 text-indigo-700"
                    }`}
                  >
                    {s.course_code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{s.course_name ?? s.course_code}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {formatUtc(s.started_at)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {s.duration_minutes} min
                      </span>
                    </p>
                  </div>
                  {live ? (
                    <LiveBadge />
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      Ended
                    </span>
                  )}
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

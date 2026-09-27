// app/sessions/page.tsx — session picker: the instructor's sessions, newest first (RLS scopes the query).
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatUtc } from "@/lib/format";
import SignOutButton from "@/components/SignOutButton";

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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Your sessions</h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user.email}</p>
        </div>
        <SignOutButton />
      </div>

      {error ? (
        <p role="alert" className="mt-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load sessions: {error.message}
        </p>
      ) : !sessions?.length ? (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-slate-500">
          No sessions yet. Run <code className="font-mono">npm run seed</code> to create the demo session.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/sessions/${s.id}`}
                className="flex flex-col gap-1 px-5 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    <span className="font-mono text-slate-500">{s.course_code}</span>
                    {s.course_name && <span className="ml-2">{s.course_name}</span>}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatUtc(s.started_at)} · {s.duration_minutes} min
                  </p>
                </div>
                {s.status === "live" ? (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Live
                  </span>
                ) : (
                  <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    Ended
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

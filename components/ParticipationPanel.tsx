// components/ParticipationPanel.tsx — polls are the only scored participation signal.
// Live interactions (chat, hand raise) are neutral context: roster order, grey, never ranked or coloured.
import type { StudentTimeline } from "@/lib/metrics";
import { ChatIcon, PollIcon } from "./icons";

type Props = { timeline: StudentTimeline[]; pollsLaunched: number };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
      {initials(name)}
    </span>
  );
}

export default function ParticipationPanel({ timeline, pollsLaunched }: Props) {
  const attended = timeline.filter((s) => s.firstJoinMin !== null);
  const byPolls = [...attended].sort((a, b) => b.pollResponses - a.pollResponses);

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
            <PollIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Poll responses</h2>
            <p className="text-xs text-slate-500">
              {pollsLaunched === 0
                ? "No polls launched yet."
                : `${pollsLaunched} poll${pollsLaunched === 1 ? "" : "s"} launched · the only scored signal`}
            </p>
          </div>
        </div>
        {pollsLaunched > 0 && (
          <ul className="mt-5 space-y-2.5">
            {byPolls.map((s) => (
              <li key={s.studentId} className="grid grid-cols-[150px_1fr_40px] items-center gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={s.name} />
                  <span className="truncate text-slate-700" title={s.name}>
                    {s.name}
                  </span>
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${(Math.min(s.pollResponses, pollsLaunched) / pollsLaunched) * 100}%` }}
                  />
                </div>
                <span className="text-right text-xs font-medium tabular-nums text-slate-500">
                  {s.pollResponses}/{pollsLaunched}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200">
            <ChatIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Live interaction</h2>
            <p className="text-xs text-slate-500">Chats and hand raises. Shown for context, not scored.</p>
          </div>
        </div>
        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {attended.map((s) => (
            <li
              key={s.studentId}
              className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm text-slate-600"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={s.name} />
                <span className="truncate" title={s.name}>
                  {s.name}
                </span>
              </span>
              <span className="tabular-nums text-slate-500">{s.liveInteractions}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

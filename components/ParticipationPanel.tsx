// components/ParticipationPanel.tsx — polls are the only scored participation signal.
// Live interactions (chat, hand raise) are neutral context: roster order, grey, never ranked or coloured.
import type { StudentTimeline } from "@/lib/metrics";

type Props = { timeline: StudentTimeline[]; pollsLaunched: number };

export default function ParticipationPanel({ timeline, pollsLaunched }: Props) {
  const attended = timeline.filter((s) => s.firstJoinMin !== null);
  const byPolls = [...attended].sort((a, b) => b.pollResponses - a.pollResponses);

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Poll responses</h2>
        <p className="mt-1 text-sm text-slate-500">
          {pollsLaunched === 0 ? "No polls launched yet." : `${pollsLaunched} poll${pollsLaunched === 1 ? "" : "s"} launched`}
        </p>
        {pollsLaunched > 0 && (
          <ul className="mt-4 space-y-2">
            {byPolls.map((s) => (
              <li key={s.studentId} className="grid grid-cols-[120px_1fr_40px] items-center gap-3 text-sm">
                <span className="truncate text-slate-700" title={s.name}>
                  {s.name}
                </span>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(Math.min(s.pollResponses, pollsLaunched) / pollsLaunched) * 100}%` }}
                  />
                </div>
                <span className="text-right tabular-nums text-slate-600">
                  {s.pollResponses}/{pollsLaunched}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Live interaction</h2>
        <p className="mt-1 text-sm text-slate-500">Chats and hand raises. Shown for context, not scored.</p>
        <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {attended.map((s) => (
            <li key={s.studentId} className="flex justify-between gap-3 text-slate-600">
              <span className="truncate" title={s.name}>
                {s.name}
              </span>
              <span className="tabular-nums">{s.liveInteractions}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

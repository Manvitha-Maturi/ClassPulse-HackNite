// components/Timeline.tsx — one row per enrolled student; plain positioned divs, no chart library.
import type { SegmentType, StudentStatus, StudentTimeline } from "@/lib/metrics";
import { PulseIcon } from "./icons";

const SEGMENT_CLASS: Record<SegmentType, string> = {
  connected: "bg-emerald-500",
  gap: "bg-rose-500",
  late: "bg-amber-400",
  left: "bg-slate-300",
  absent: "bg-slate-200",
};

const SEGMENT_LABEL: Record<SegmentType, string> = {
  connected: "Connected",
  gap: "Gap",
  late: "Late",
  left: "Left",
  absent: "Absent",
};

const ABSENT_STRIPES = {
  backgroundImage: "repeating-linear-gradient(45deg, #e2e8f0 0 6px, #f8fafc 6px 12px)",
};

const STATUS_CHIP: Partial<Record<StudentStatus, { label: string; className: string }>> = {
  unstable: { label: "unstable", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  late: { label: "late", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  left_early: { label: "left early", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  disconnected: { label: "disconnected", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  absent: { label: "absent", className: "bg-slate-100 text-slate-500 ring-slate-200" },
};

const ROW_GRID = "grid grid-cols-[160px_1fr_104px] items-center gap-3";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

type Props = {
  timeline: StudentTimeline[];
  durationMin: number;
  /** Right edge the server computed segments against. */
  elapsedMin: number;
  /** Client-side "now" (≥ elapsedMin) so the now line moves between data updates on live sessions. */
  nowMin?: number;
  live: boolean;
};

export default function Timeline({ timeline, durationMin, elapsedMin, nowMin = elapsedMin, live }: Props) {
  const pct = (min: number) => `${(Math.max(0, Math.min(durationMin, min)) / durationMin) * 100}%`;
  // On live sessions, segments still open at the server's edge (connected or gap) extend to the moving now line.
  const segEnd = (endMin: number) => (live && endMin >= elapsedMin ? nowMin : endMin);
  const ticks: number[] = [];
  for (let m = 0; m <= durationMin; m += 15) ticks.push(m);
  const innerTicks = ticks.filter((m) => m > 0 && m < durationMin);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <PulseIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Connection timeline</h2>
            <p className="text-xs text-slate-500">Drops are shown as reliability, not behaviour.</p>
          </div>
        </div>
        <Legend />
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[680px] space-y-1">
          {timeline.map((s) => {
            const chip = STATUS_CHIP[s.status];
            return (
              <div key={s.studentId} className={`${ROW_GRID} rounded-lg px-1.5 py-1 hover:bg-slate-50`} data-print-avoid-break>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                    {initials(s.name)}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-700" title={s.name}>
                    {s.name}
                  </span>
                </span>
                <div className="relative h-6 overflow-hidden rounded-md bg-slate-100">
                  {s.segments.map((seg, i) => (
                    <div
                      key={i}
                      className={`absolute inset-y-0 ${SEGMENT_CLASS[seg.type]}`}
                      style={{
                        left: pct(seg.startMin),
                        width: `calc(${pct(segEnd(seg.endMin))} - ${pct(seg.startMin)})`,
                        ...(seg.type === "absent" ? ABSENT_STRIPES : {}),
                      }}
                      title={`${SEGMENT_LABEL[seg.type]} · min ${seg.startMin}–${seg.endMin}`}
                    />
                  ))}
                  {innerTicks.map((m) => (
                    <div key={m} className="pointer-events-none absolute inset-y-0 w-px bg-white/60" style={{ left: pct(m) }} />
                  ))}
                  {live && (
                    <div
                      className="absolute inset-y-0 w-0.5 bg-indigo-600 shadow-[0_0_0_2px_rgba(255,255,255,0.7)]"
                      style={{ left: pct(nowMin) }}
                    />
                  )}
                </div>
                <span>
                  {chip && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${chip.className}`}>
                      {chip.label}
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          <div className={`${ROW_GRID} px-1.5 pt-1`}>
            <span />
            <div className="relative h-5 text-xs text-slate-400">
              {ticks.map((m) => (
                <span key={m} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(m) }}>
                  {m}
                </span>
              ))}
              {live && (
                <span
                  className="absolute -top-0.5 -translate-x-1/2 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  style={{ left: pct(nowMin) }}
                >
                  now
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">minutes</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Legend() {
  const items: SegmentType[] = ["connected", "gap", "late", "left", "absent"];
  return (
    <ul className="flex flex-wrap gap-1.5 text-xs text-slate-600">
      {items.map((t) => (
        <li key={t} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200/70">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-sm ${SEGMENT_CLASS[t]}`}
            style={t === "absent" ? ABSENT_STRIPES : undefined}
          />
          {SEGMENT_LABEL[t]}
        </li>
      ))}
    </ul>
  );
}

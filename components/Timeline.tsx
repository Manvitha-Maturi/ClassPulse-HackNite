// components/Timeline.tsx — one row per enrolled student; plain positioned divs, no chart library.
import type { SegmentType, StudentStatus, StudentTimeline } from "@/lib/metrics";

const SEGMENT_CLASS: Record<SegmentType, string> = {
  connected: "bg-green-500",
  gap: "bg-red-500",
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
  unstable: { label: "unstable", className: "bg-red-50 text-red-700" },
  late: { label: "late", className: "bg-amber-50 text-amber-800" },
  left_early: { label: "left early", className: "bg-slate-100 text-slate-600" },
  disconnected: { label: "disconnected", className: "bg-red-50 text-red-700" },
  absent: { label: "absent", className: "bg-slate-100 text-slate-500" },
};

const ROW_GRID = "grid grid-cols-[140px_1fr_96px] items-center gap-3";

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

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">Connection timeline</h2>
        <Legend />
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[640px] space-y-1.5">
          {timeline.map((s) => {
            const chip = STATUS_CHIP[s.status];
            return (
              <div key={s.studentId} className={ROW_GRID} data-print-avoid-break>
                <span className="truncate text-sm text-slate-700" title={s.name}>
                  {s.name}
                </span>
                <div className="relative h-5 overflow-hidden rounded bg-slate-100">
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
                  {live && (
                    <div className="absolute inset-y-0 w-0.5 bg-slate-900" style={{ left: pct(nowMin) }} />
                  )}
                </div>
                <span>
                  {chip && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chip.className}`}>
                      {chip.label}
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          <div className={ROW_GRID}>
            <span />
            <div className="relative h-5 text-xs text-slate-400">
              {ticks.map((m) => (
                <span key={m} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(m) }}>
                  {m}
                </span>
              ))}
              {live && (
                <span
                  className="absolute top-0 -translate-x-1/2 font-medium text-slate-900"
                  style={{ left: pct(nowMin) }}
                >
                  ▲ now
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
    <ul className="flex flex-wrap gap-3 text-xs text-slate-600">
      {items.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <span
            className={`inline-block h-3 w-3 rounded-sm ${SEGMENT_CLASS[t]}`}
            style={t === "absent" ? ABSENT_STRIPES : undefined}
          />
          {SEGMENT_LABEL[t]}
        </li>
      ))}
    </ul>
  );
}

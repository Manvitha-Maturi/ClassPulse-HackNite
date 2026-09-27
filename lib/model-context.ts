// lib/model-context.ts — the privacy boundary between ClassPulse data and the LLM.
// Everything sent to Gemini is built here: students become S-labels (S1, S2, …), only aggregates and
// event kinds go in, and names are restored server-side with unmask(). Pure: no I/O.
import type { SessionData } from "./data";
import {
  buildTimeline,
  computeStats,
  detectAlerts,
  minutesSince,
  pollContext,
  sessionEndMin,
  type Alert,
  type PollContext,
  type Stats,
  type StudentStatus,
  type StudentTimeline,
} from "./metrics";

/** Join/leave events within this many minutes of "now" are included as recent activity. */
export const RECENT_WINDOW_MIN = 5;

export type ModelPayload = {
  sessionStatus: "live" | "ended";
  elapsedMinutes: number;
  durationMinutes: number;
  pollsLaunched: number;
  stats: Stats;
  alerts: { startMin: number; endMin: number; affectedCount: number }[];
  polls: PollContext[];
  recentConnectionEvents: { label: string; type: "join" | "leave"; minute: number }[];
  students: {
    label: string;
    status: StudentStatus;
    dropCount: number;
    firstJoinMin: number | null;
    // null = not applicable: absent students can't be poll non-responders (Silent requires attendance).
    pollResponses: number | null;
  }[];
};

export type ModelContext = {
  payload: ModelPayload;
  timeline: StudentTimeline[];
  stats: Stats;
  alerts: Alert[];
  /** Replace roster names (full, and first names when unambiguous) with S-labels. */
  mask: (text: string) => string;
  /** Replace S-labels with roster names. */
  unmask: (text: string) => string;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Name boundaries that work for names ending in "." or containing "-" (e.g. "Soo-Jin L.").
const bounded = (pattern: string, flags: string) => new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, flags);

export function buildModelContext(data: SessionData, now: Date): ModelContext {
  const { session } = data;
  const timeline = buildTimeline(session, data.students, data.logs, data.events, now);
  const stats = computeStats(session, timeline);
  const alerts = detectAlerts(session, data.logs);
  const elapsedMinutes = sessionEndMin(session, now);

  const labelOf = new Map(timeline.map((s, i) => [s.studentId, `S${i + 1}`]));
  const nameOf = new Map(timeline.map((s, i) => [`S${i + 1}`, s.name]));

  const payload: ModelPayload = {
    sessionStatus: session.status,
    elapsedMinutes,
    durationMinutes: session.duration_minutes,
    pollsLaunched: session.polls_launched,
    stats,
    alerts: alerts.map(({ startMin, endMin, affectedCount }) => ({ startMin, endMin, affectedCount })),
    polls: pollContext(session, timeline, data.events),
    recentConnectionEvents: data.logs
      .map((l) => ({ label: labelOf.get(l.student_id), type: l.event_type, minute: minutesSince(session.started_at, l.occurred_at) }))
      .filter((e): e is ModelPayload["recentConnectionEvents"][number] => e.label !== undefined)
      .filter((e) => e.minute >= elapsedMinutes - RECENT_WINDOW_MIN && e.minute <= elapsedMinutes)
      .sort((a, b) => a.minute - b.minute),
    students: timeline.map((s) => ({
      label: labelOf.get(s.studentId)!,
      status: s.status,
      dropCount: s.dropCount,
      firstJoinMin: s.firstJoinMin,
      pollResponses: s.firstJoinMin === null ? null : s.pollResponses,
    })),
  };

  // Mask patterns, longest first so "Priya S." wins over "Priya".
  const patterns: { re: RegExp; label: string; length: number }[] = [];
  const firstNameCount = new Map<string, number>();
  for (const s of timeline) {
    const first = s.name.split(/\s+/)[0];
    if (first) firstNameCount.set(first, (firstNameCount.get(first) ?? 0) + 1);
  }
  for (const s of timeline) {
    const label = labelOf.get(s.studentId)!;
    const full = s.name.trim();
    // Full name, also without a trailing period ("Priya S" as well as "Priya S."). Case-insensitive.
    const fullNoDot = full.replace(/\.$/, "");
    patterns.push({ re: bounded(`${escapeRegExp(full)}|${escapeRegExp(fullNoDot)}`, "giu"), label, length: full.length });
    // First name only when it identifies exactly one student. Case-sensitive, to avoid masking ordinary words.
    const first = full.split(/\s+/)[0];
    if (first && first !== full && firstNameCount.get(first) === 1) {
      patterns.push({ re: bounded(escapeRegExp(first), "gu"), label, length: first.length });
    }
  }
  patterns.sort((a, b) => b.length - a.length);

  const mask = (text: string) => patterns.reduce((out, p) => out.replace(p.re, p.label), text);
  const unmask = (text: string) => text.replace(/\bS(\d+)\b/g, (m) => nameOf.get(m) ?? m);

  return { payload, timeline, stats, alerts, mask, unmask };
}

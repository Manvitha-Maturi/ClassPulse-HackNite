// lib/metrics.ts
// Pure functions: raw events in, dashboard numbers out. No database, no network.
// All times are minutes from session start. This file is the product's core logic.

export const RULES = {
  LATE_AFTER_MIN: 3,
  UNSTABLE_AT_DROPS: 2,
  ALERT_WINDOW_MIN: 10,
  ALERT_MIN_STUDENTS: 3,
} as const;

export type Student = { id: string; display_name: string };
export type Session = {
  id: string;
  started_at: string; // ISO timestamptz (UTC)
  duration_minutes: number;
  polls_launched: number;
  status: "live" | "ended";
};
export type ConnectionLog = { student_id: string; event_type: "join" | "leave"; occurred_at: string };
export type ParticipationEvent = {
  student_id: string;
  kind: "chat" | "poll_response" | "hand_raise";
  poll_id?: string | null; // set for poll_response
  occurred_at: string;
};

export type SegmentType = "connected" | "gap" | "late" | "left" | "absent";
export type Segment = { type: SegmentType; startMin: number; endMin: number };
export type StudentStatus = "stable" | "late" | "unstable" | "left_early" | "disconnected" | "absent";

export type StudentTimeline = {
  studentId: string;
  name: string;
  segments: Segment[];
  dropCount: number;
  firstJoinMin: number | null;
  connected: boolean;
  status: StudentStatus;
  pollResponses: number;
  liveInteractions: number;
};

export type Stats = {
  enrolled: number;
  connectedNow: number;
  unstable: number;
  absent: number;
  late: number;
  pollResponseRate: number | null;
  silent: number;
  liveInteractions: number;
};

export type Alert = { startMin: number; endMin: number; affectedCount: number; message: string };

/** Connection state around one poll: separates "didn't answer" from "wasn't connected to answer". */
export type PollContext = {
  pollId: string;
  /** Minute of the earliest response (the poll's open time as far as the data shows). */
  openedAtMin: number;
  respondents: number;
  /** Students who had joined by the time the poll opened. */
  attendeesAtOpen: number;
  /** Attendees who were not connected when the poll opened. */
  disconnectedAtOpen: number;
  /** Responses from students connected at open ÷ students connected at open × 100; null if none were connected. */
  connectedResponseRate: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function minutesSince(startIso: string, iso: string): number {
  return round1((Date.parse(iso) - Date.parse(startIso)) / 60000);
}

/** Right edge of the timeline: full duration if ended, elapsed time if live. */
export function sessionEndMin(session: Session, now: Date = new Date()): number {
  if (session.status === "ended") return session.duration_minutes;
  const elapsed = (now.getTime() - Date.parse(session.started_at)) / 60000;
  return round1(Math.max(0, Math.min(session.duration_minutes, elapsed)));
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function buildTimeline(
  session: Session,
  students: Student[],
  logs: ConnectionLog[],
  events: ParticipationEvent[],
  now: Date = new Date(),
): StudentTimeline[] {
  const endMin = sessionEndMin(session, now);
  const clamp = (m: number) => Math.max(0, Math.min(endMin, m));
  const logsByStudent = groupBy(logs, (l) => l.student_id);
  const eventsByStudent = groupBy(events, (e) => e.student_id);

  return students.map((st) => {
    const evs = (logsByStudent.get(st.id) ?? [])
      .slice()
      .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));

    const segments: Segment[] = [];
    let openAt: number | null = null;
    let lastLeave: number | null = null;
    let firstJoin: number | null = null;
    let drops = 0;

    for (const e of evs) {
      const t = clamp(minutesSince(session.started_at, e.occurred_at));
      if (e.event_type === "join") {
        if (openAt !== null) continue; // duplicate join
        if (firstJoin === null) {
          firstJoin = t;
          if (t > RULES.LATE_AFTER_MIN) segments.push({ type: "late", startMin: 0, endMin: t });
        } else if (lastLeave !== null) {
          segments.push({ type: "gap", startMin: lastLeave, endMin: t });
          drops++;
        }
        openAt = t;
      } else {
        if (openAt === null) continue; // orphan leave
        segments.push({ type: "connected", startMin: openAt, endMin: t });
        openAt = null;
        lastLeave = t;
      }
    }

    const connected = openAt !== null;
    if (openAt !== null) {
      segments.push({ type: "connected", startMin: openAt, endMin });
    } else if (firstJoin !== null && lastLeave !== null && lastLeave < endMin) {
      segments.push({ type: session.status === "live" ? "gap" : "left", startMin: lastLeave, endMin });
    }
    if (firstJoin === null) segments.push({ type: "absent", startMin: 0, endMin });

    const status: StudentStatus =
      firstJoin === null
        ? "absent"
        : drops >= RULES.UNSTABLE_AT_DROPS
          ? "unstable"
          : !connected
            ? session.status === "live" ? "disconnected" : "left_early"
            : firstJoin > RULES.LATE_AFTER_MIN
              ? "late"
              : "stable";

    const pe = eventsByStudent.get(st.id) ?? [];
    return {
      studentId: st.id,
      name: st.display_name,
      segments,
      dropCount: drops,
      firstJoinMin: firstJoin,
      connected,
      status,
      pollResponses: pe.filter((e) => e.kind === "poll_response").length,
      liveInteractions: pe.filter((e) => e.kind !== "poll_response").length,
    };
  });
}

export function computeStats(session: Session, timeline: StudentTimeline[]): Stats {
  const attended = timeline.filter((s) => s.firstJoinMin !== null);
  const totalPoll = attended.reduce((n, s) => n + s.pollResponses, 0);
  const possible = session.polls_launched * attended.length;
  return {
    enrolled: timeline.length,
    connectedNow: timeline.filter((s) => s.connected).length,
    unstable: timeline.filter((s) => s.dropCount >= RULES.UNSTABLE_AT_DROPS).length,
    absent: timeline.length - attended.length,
    late: attended.filter((s) => (s.firstJoinMin ?? 0) > RULES.LATE_AFTER_MIN).length,
    pollResponseRate: possible > 0 ? Math.round((totalPoll / possible) * 100) : null,
    silent: session.polls_launched > 0 ? attended.filter((s) => s.pollResponses === 0).length : 0,
    liveInteractions: timeline.reduce((n, s) => n + s.liveInteractions, 0),
  };
}

export function detectAlerts(session: Session, logs: ConnectionLog[]): Alert[] {
  const leaves = logs
    .filter((l) => l.event_type === "leave")
    .map((l) => ({ id: l.student_id, t: minutesSince(session.started_at, l.occurred_at) }))
    .sort((a, b) => a.t - b.t);

  const clusters: { startMin: number; endMin: number; ids: Set<string> }[] = [];
  for (const { t: start } of leaves) {
    const inWindow = leaves.filter((l) => l.t >= start && l.t <= start + RULES.ALERT_WINDOW_MIN);
    const ids = new Set(inWindow.map((l) => l.id));
    if (ids.size < RULES.ALERT_MIN_STUDENTS) continue;
    const lastLeaveT = Math.max(...inWindow.map((l) => l.t));
    const prev = clusters[clusters.length - 1];
    if (prev && start <= prev.endMin) {
      prev.endMin = Math.max(prev.endMin, lastLeaveT);
      ids.forEach((id) => prev.ids.add(id));
    } else {
      clusters.push({ startMin: start, endMin: lastLeaveT, ids });
    }
  }

  return clusters.map((c) => ({
    startMin: c.startMin,
    endMin: c.endMin,
    affectedCount: c.ids.size,
    message: `${c.ids.size} students disconnected between minute ${Math.floor(c.startMin)} and ${Math.ceil(
      c.endMin,
    )}. This pattern suggests a possible shared connectivity issue, not disengagement.`,
  }));
}

/** Was the student in a connected segment at minute t? */
function connectedAt(s: StudentTimeline, t: number): boolean {
  return s.segments.some(
    (seg, i) =>
      seg.type === "connected" &&
      seg.startMin <= t &&
      // A segment ending exactly at t only counts if it's the still-open one. A leave at the live edge
      // produces no trailing gap yet, so its closed segment can also be the last one.
      (t < seg.endMin || (t === seg.endMin && s.connected && i === s.segments.length - 1)),
  );
}

/** Per-poll context, ordered by open time. Responses without a poll_id are ignored. */
export function pollContext(
  session: Session,
  timeline: StudentTimeline[],
  events: ParticipationEvent[],
): PollContext[] {
  const byPoll = groupBy(
    events.filter((e) => e.kind === "poll_response" && e.poll_id),
    (e) => e.poll_id!,
  );

  return [...byPoll.entries()]
    .map(([pollId, responses]) => {
      const openedAtMin = Math.min(...responses.map((e) => minutesSince(session.started_at, e.occurred_at)));
      const responderIds = new Set(responses.map((e) => e.student_id));
      const attendees = timeline.filter((s) => s.firstJoinMin !== null && s.firstJoinMin <= openedAtMin);
      const connected = attendees.filter((s) => connectedAt(s, openedAtMin));
      const connectedResponders = connected.filter((s) => responderIds.has(s.studentId)).length;
      return {
        pollId,
        openedAtMin,
        respondents: responderIds.size,
        attendeesAtOpen: attendees.length,
        disconnectedAtOpen: attendees.length - connected.length,
        connectedResponseRate: connected.length ? Math.round((connectedResponders / connected.length) * 100) : null,
      };
    })
    .sort((a, b) => a.openedAtMin - b.openedAtMin);
}

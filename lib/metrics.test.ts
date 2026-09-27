// lib/metrics.test.ts
// The seed scenario from docs/BLUEPRINT.md §4.2, built in memory. The expected values are the spec.
import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  computeStats,
  detectAlerts,
  pollContext,
  type ConnectionLog,
  type ParticipationEvent,
  type Session,
  type Student,
  type StudentTimeline,
} from "./metrics";

const START = "2026-10-05T18:00:00Z";
const at = (min: number, start = START) => new Date(Date.parse(start) + min * 60000).toISOString();

type Row = {
  id: string;
  name: string;
  conn: [ConnectionLog["event_type"], number][];
  polls: number[];
  chats: number[];
  hands: number[];
};

const ROSTER: Row[] = [
  { id: "priya", name: "Priya S.", conn: [["join", 0.2]], polls: [11, 31, 56], chats: [12, 40], hands: [45] },
  { id: "james", name: "James T.", conn: [["join", 1], ["leave", 22], ["join", 25]], polls: [11, 31], chats: [31], hands: [] },
  { id: "aisha", name: "Aisha M.", conn: [["join", 15], ["leave", 20], ["join", 23]], polls: [31], chats: [40], hands: [] },
  {
    id: "ravi",
    name: "Ravi K.",
    conn: [["join", 0.75], ["leave", 18], ["join", 21], ["leave", 35], ["join", 39]],
    polls: [],
    chats: [50],
    hands: [],
  },
  { id: "soojin", name: "Soo-Jin L.", conn: [["join", 0.5], ["leave", 19], ["join", 26]], polls: [11, 31, 56], chats: [12, 28], hands: [] },
  { id: "marcus", name: "Marcus D.", conn: [["join", 0]], polls: [11, 31, 56], chats: [], hands: [] },
  { id: "elena", name: "Elena R.", conn: [["join", 2]], polls: [11, 56], chats: [], hands: [33] },
  {
    id: "omar",
    name: "Omar F.",
    conn: [["join", 1], ["leave", 50], ["join", 52], ["leave", 60], ["join", 61], ["leave", 68], ["join", 69]],
    polls: [56],
    chats: [],
    hands: [],
  },
  { id: "hannah", name: "Hannah B.", conn: [["join", 5]], polls: [], chats: [], hands: [] },
  { id: "diego", name: "Diego P.", conn: [["join", 0], ["leave", 70]], polls: [11, 31, 56], chats: [], hands: [] },
  { id: "tom", name: "Tom K.", conn: [["join", 0]], polls: [31, 56], chats: [], hands: [] },
  { id: "mei", name: "Mei W.", conn: [], polls: [], chats: [], hands: [] },
];

const session: Session = {
  id: "seed-session",
  started_at: START,
  duration_minutes: 75,
  polls_launched: 3,
  status: "ended",
};
const students: Student[] = ROSTER.map((r) => ({ id: r.id, display_name: r.name }));
const logs: ConnectionLog[] = ROSTER.flatMap((r) =>
  r.conn.map(([event_type, min]) => ({ student_id: r.id, event_type, occurred_at: at(min) })),
);
const events: ParticipationEvent[] = ROSTER.flatMap((r) => [
  ...r.polls.map((m) => ({ student_id: r.id, kind: "poll_response" as const, occurred_at: at(m) })),
  ...r.chats.map((m) => ({ student_id: r.id, kind: "chat" as const, occurred_at: at(m) })),
  ...r.hands.map((m) => ({ student_id: r.id, kind: "hand_raise" as const, occurred_at: at(m) })),
]);

const timeline = buildTimeline(session, students, logs, events);
const byId = (id: string): StudentTimeline => {
  const s = timeline.find((t) => t.studentId === id);
  if (!s) throw new Error(`no timeline for ${id}`);
  return s;
};

describe("seed scenario (BLUEPRINT §4.2)", () => {
  it("computes the expected stats", () => {
    expect(computeStats(session, timeline)).toEqual({
      enrolled: 12,
      connectedNow: 10,
      unstable: 2,
      absent: 1,
      late: 2,
      pollResponseRate: 61,
      silent: 2,
      liveInteractions: 9,
    });
  });

  it("counts drops per student", () => {
    const drops = Object.fromEntries(timeline.map((t) => [t.studentId, t.dropCount]));
    expect(drops).toEqual({
      priya: 0,
      james: 1,
      aisha: 1,
      ravi: 2,
      soojin: 1,
      marcus: 0,
      elena: 0,
      omar: 3,
      hannah: 0,
      diego: 0,
      tom: 0,
      mei: 0,
    });
  });

  it("gives Ravi 5 segments: connected, gap, connected, gap, connected", () => {
    expect(byId("ravi").segments.map((s) => s.type)).toEqual(["connected", "gap", "connected", "gap", "connected"]);
  });

  it("gives Aisha late → connected → gap → connected", () => {
    expect(byId("aisha").segments).toEqual([
      { type: "late", startMin: 0, endMin: 15 },
      { type: "connected", startMin: 15, endMin: 20 },
      { type: "gap", startMin: 20, endMin: 23 },
      { type: "connected", startMin: 23, endMin: 75 },
    ]);
  });

  it("ends Diego with a left segment from 70 to 75", () => {
    expect(byId("diego").segments.at(-1)).toEqual({ type: "left", startMin: 70, endMin: 75 });
  });

  it("marks Mei as a single absent segment", () => {
    expect(byId("mei").segments).toEqual([{ type: "absent", startMin: 0, endMin: 75 }]);
  });

  it("assigns the expected statuses", () => {
    const statuses = Object.fromEntries(timeline.map((t) => [t.studentId, t.status]));
    expect(statuses).toEqual({
      priya: "stable",
      james: "stable",
      aisha: "late",
      ravi: "unstable",
      soojin: "stable",
      marcus: "stable",
      elena: "stable",
      omar: "unstable",
      hannah: "late",
      diego: "left_early",
      tom: "stable",
      mei: "absent",
    });
  });

  it("raises exactly one reliability alert: minutes 18–22, 4 students", () => {
    const alerts = detectAlerts(session, logs);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ startMin: 18, endMin: 22, affectedCount: 4 });
    expect(alerts[0].message).toContain("possible shared connectivity issue");
  });
});

describe("live session", () => {
  it("marks a student whose last event is a leave as disconnected with a trailing gap", () => {
    const liveStart = "2026-10-05T18:00:00Z";
    const now = new Date(at(30, liveStart));
    const live: Session = { id: "live", started_at: liveStart, duration_minutes: 75, polls_launched: 0, status: "live" };
    const [t] = buildTimeline(
      live,
      [{ id: "s1", display_name: "Test Student" }],
      [
        { student_id: "s1", event_type: "join", occurred_at: at(1, liveStart) },
        { student_id: "s1", event_type: "leave", occurred_at: at(20, liveStart) },
      ],
      [],
      now,
    );
    expect(t.status).toBe("disconnected");
    expect(t.connected).toBe(false);
    expect(t.segments.at(-1)).toEqual({ type: "gap", startMin: 20, endMin: 30 });
  });
});

describe("poll context", () => {
  it("separates non-response from disconnection: 3 of 5 drop at min 20, poll opens at 20.1, 2 respond", () => {
    const liveStart = "2026-10-05T18:00:00Z";
    const session: Session = { id: "p", started_at: liveStart, duration_minutes: 75, polls_launched: 1, status: "live" };
    const ids = ["a", "b", "c", "d", "e"];
    const students: Student[] = ids.map((id) => ({ id, display_name: `Student ${id}` }));
    const logs: ConnectionLog[] = [
      ...ids.map((id) => ({ student_id: id, event_type: "join" as const, occurred_at: at(0, liveStart) })),
      ...["c", "d", "e"].map((id) => ({ student_id: id, event_type: "leave" as const, occurred_at: at(20, liveStart) })),
    ];
    const events: ParticipationEvent[] = ["a", "b"].map((id) => ({
      student_id: id,
      kind: "poll_response",
      poll_id: "poll-1",
      occurred_at: at(20.1, liveStart),
    }));

    const tl = buildTimeline(session, students, logs, events, new Date(at(25, liveStart)));
    expect(pollContext(session, tl, events)).toEqual([
      {
        pollId: "poll-1",
        openedAtMin: 20.1,
        respondents: 2,
        attendeesAtOpen: 5,
        disconnectedAtOpen: 3,
        connectedResponseRate: 100,
      },
    ]);
    expect(computeStats(session, tl).pollResponseRate).toBe(40);
  });

  it("counts a leave in the same minute as the poll, at the live edge, as disconnected", () => {
    const liveStart = "2026-10-05T18:00:00Z";
    const session: Session = { id: "p", started_at: liveStart, duration_minutes: 75, polls_launched: 1, status: "live" };
    const ids = ["a", "b", "c", "d", "e"];
    const students: Student[] = ids.map((id) => ({ id, display_name: `Student ${id}` }));
    const logs: ConnectionLog[] = [
      ...ids.map((id) => ({ student_id: id, event_type: "join" as const, occurred_at: at(0, liveStart) })),
      ...["c", "d", "e"].map((id) => ({ student_id: id, event_type: "leave" as const, occurred_at: at(20.1, liveStart) })),
    ];
    const events: ParticipationEvent[] = ["a", "b"].map((id) => ({
      student_id: id,
      kind: "poll_response",
      poll_id: "poll-1",
      occurred_at: at(20.1, liveStart),
    }));
    // "Now" is the same minute as the leaves, so the timeline has no trailing gap segments yet.
    const tl = buildTimeline(session, students, logs, events, new Date(at(20.1, liveStart)));
    expect(pollContext(session, tl, events)[0]).toMatchObject({ disconnectedAtOpen: 3, connectedResponseRate: 100 });
  });

  it("ignores responses without a poll_id", () => {
    const tl = buildTimeline(session, students, logs, events);
    const withoutIds = events.map((e) => ({ ...e, poll_id: undefined }));
    expect(pollContext(session, tl, withoutIds)).toEqual([]);
  });
});

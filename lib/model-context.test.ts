// lib/model-context.test.ts — the LLM privacy boundary: no names or ids leave the server.
import { describe, expect, it } from "vitest";
import type { SessionData } from "./data";
import { buildModelContext } from "./model-context";

const START = "2026-10-05T18:00:00Z";
const at = (min: number) => new Date(Date.parse(START) + min * 60000).toISOString();

const ROSTER = [
  { id: "7f3c2a10-0000-4000-8000-000000000001", display_name: "Priya S." },
  { id: "7f3c2a10-0000-4000-8000-000000000002", display_name: "Ravi K." },
  { id: "7f3c2a10-0000-4000-8000-000000000003", display_name: "Soo-Jin L." },
  { id: "7f3c2a10-0000-4000-8000-000000000004", display_name: "Sam A." },
  { id: "7f3c2a10-0000-4000-8000-000000000005", display_name: "Sam B." },
  { id: "7f3c2a10-0000-4000-8000-000000000006", display_name: "Mei W." },
];
const [priya, ravi, soojin, samA, samB] = ROSTER;

const data: SessionData = {
  session: {
    id: "session-1",
    course_code: "CS3003",
    course_name: "Software Engineering",
    started_at: START,
    duration_minutes: 75,
    polls_launched: 1,
    status: "live",
  },
  students: ROSTER,
  logs: [
    ...[priya, ravi, soojin, samA, samB].map((s) => ({ student_id: s.id, event_type: "join" as const, occurred_at: at(0) })),
    { student_id: ravi.id, event_type: "leave", occurred_at: at(22) },
    { student_id: soojin.id, event_type: "leave", occurred_at: at(23) },
    { student_id: samA.id, event_type: "leave", occurred_at: at(24) },
  ],
  events: [
    { student_id: priya.id, kind: "poll_response", poll_id: "poll-1", occurred_at: at(11) },
    { student_id: ravi.id, kind: "chat", occurred_at: at(12) },
  ],
};
const ctx = buildModelContext(data, new Date(at(25)));

describe("model payload", () => {
  it("contains no roster name, first name or student id", () => {
    const json = JSON.stringify(ctx.payload);
    for (const s of ROSTER) {
      expect(json).not.toContain(s.display_name);
      expect(json).not.toContain(s.display_name.split(" ")[0]);
      expect(json).not.toContain(s.id);
    }
    expect(json).not.toContain(data.session.id);
  });

  it("labels students S1..Sn and includes poll context and recent join/leave events", () => {
    expect(ctx.payload.students.map((s) => s.label)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6"]);
    expect(ctx.payload.polls).toHaveLength(1);
    // Only events in the last 5 minutes (min 20–25): the three leaves.
    expect(ctx.payload.recentConnectionEvents.map((e) => [e.type, e.minute])).toEqual([
      ["leave", 22],
      ["leave", 23],
      ["leave", 24],
    ]);
    // Absent students are "not applicable", not zero responses.
    expect(ctx.payload.students.find((s) => s.status === "absent")?.pollResponses).toBeNull();
  });
});

describe("mask / unmask", () => {
  const label = (id: string) => `S${ctx.timeline.findIndex((s) => s.studentId === id) + 1}`;

  it("round-trips full names", () => {
    const text = "Priya S. and Soo-Jin L. answered; Ravi K. dropped twice.";
    const masked = ctx.mask(text);
    expect(masked).toBe(`${label(priya.id)} and ${label(soojin.id)} answered; ${label(ravi.id)} dropped twice.`);
    for (const s of ROSTER) expect(masked).not.toContain(s.display_name);
    expect(ctx.unmask(masked)).toBe(text);
  });

  it("masks an unambiguous first name and restores the full name", () => {
    expect(ctx.mask("Should I check on Ravi?")).toBe(`Should I check on ${label(ravi.id)}?`);
    expect(ctx.unmask(ctx.mask("Should I check on Ravi?"))).toBe("Should I check on Ravi K.?");
  });

  it("leaves ambiguous first names alone but still masks the full names", () => {
    expect(ctx.mask("Sam missed it")).toBe("Sam missed it");
    expect(ctx.mask("Sam A. missed it")).toBe(`${label(samA.id)} missed it`);
  });

  it("doesn't mask first names inside other words or lowercase words", () => {
    expect(ctx.mask("Priyanka and mei are not on the roster")).toBe("Priyanka and mei are not on the roster");
  });
});

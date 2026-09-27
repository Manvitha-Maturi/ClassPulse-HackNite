// app/api/sessions/[id]/simulate/route.ts — Live Class Simulator (demo mode only).
// POST { action } → writes realistic events through lib/ingest.ts, which the dashboard picks up via Realtime.
// Ownership is checked with the instructor's RLS-scoped client before any service-role write.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSessionData, type SessionData } from "@/lib/data";
import { ingestConnection, ingestParticipation, type ParticipationInput } from "@/lib/ingest";
import { buildTimeline, sessionEndMin, type StudentTimeline } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const DEMO_COURSE_CODE = "CS3003";
const DEMO_COURSE_NAME = "Software Engineering";
const DEMO_DURATION_MIN = 75;
const DEMO_ELAPSED_MIN = 25;
/**
 * Tags sessions created by start_live_demo so only they are ever auto-deleted (never the seed session).
 * Stored in external_meeting_id, which is otherwise a platform meeting id; Zoom ids are numeric, so this
 * can't collide with a real meeting in the Zoom webhook's lookup.
 */
const DEMO_SESSION_TAG = "simulator-demo";
/** A live demo runs out ~50 real minutes after creation (starts 25 min into a 75-min class); older ones are abandoned. */
const DEMO_STALE_AFTER_MIN = 90;
const STORM_SIZE = 4;

const ACTIONS = ["start_live_demo", "tick", "network_storm", "recover", "launch_poll", "end_session"] as const;
type Action = (typeof ACTIONS)[number];

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

// ---------- small random helpers ----------
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const isoAt = (startMs: number, min: number) => new Date(startMs + min * 60000).toISOString();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return json({ error: "Simulator is disabled" }, 403);

  let action: unknown;
  try {
    ({ action } = await req.json());
  } catch {
    /* handled below */
  }
  if (typeof action !== "string" || !ACTIONS.includes(action as Action)) {
    return json({ error: `Body must be { action: ${ACTIONS.join(" | ")} }` }, 400);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  try {
    if (action === "start_live_demo") return await startLiveDemo(user.id);

    const { id } = await params;
    // RLS guarantees this only returns a session the logged-in instructor owns.
    const data = await loadSessionData(supabase, id);
    if (!data) return json({ error: "Session not found" }, 404);
    if (data.session.status !== "live") return json({ error: "Session has ended" }, 409);

    const now = new Date();
    const timeline = buildTimeline(data.session, data.students, data.logs, data.events, now);

    switch (action as Exclude<Action, "start_live_demo">) {
      case "tick":
        return json(await tick(data, timeline, now));
      case "network_storm":
        return json(await networkStorm(data, timeline, now));
      case "recover":
        return json(await recover(data, timeline, now));
      case "launch_poll":
        return json(await launchPoll(data, timeline, now));
      case "end_session":
        return json(await endSession(data, now));
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error(`Simulator action "${action}" failed:`, err);
    return json({ error: "Simulator action failed" }, 500);
  }
}

// ---------- actions ----------

/** New live CS3003 session that started 25 min ago, with plausible history for minutes 0–25. */
async function startLiveDemo(instructorId: string) {
  const admin = createAdminClient();
  const { data: roster, error: rosterErr } = await admin
    .from("students")
    .select("id")
    .eq("course_code", DEMO_COURSE_CODE);
  if (rosterErr) throw rosterErr;
  if (!roster?.length) return json({ error: `No ${DEMO_COURSE_CODE} roster. Run npm run seed first.` }, 400);

  // Housekeeping for the shared demo account: drop this instructor's abandoned demo sessions (cascades to
  // their events). Only tagged sessions older than DEMO_STALE_AFTER_MIN, so anyone mid-demo keeps theirs.
  const staleBefore = new Date(Date.now() - DEMO_STALE_AFTER_MIN * 60000).toISOString();
  const { error: cleanupErr } = await admin
    .from("sessions")
    .delete()
    .eq("instructor_id", instructorId)
    .eq("external_meeting_id", DEMO_SESSION_TAG)
    .lt("created_at", staleBefore);
  if (cleanupErr) throw cleanupErr;

  const startMs = Date.now() - DEMO_ELAPSED_MIN * 60000;
  const { data: session, error: sessErr } = await admin
    .from("sessions")
    .insert({
      instructor_id: instructorId,
      course_code: DEMO_COURSE_CODE,
      course_name: DEMO_COURSE_NAME,
      external_meeting_id: DEMO_SESSION_TAG,
      started_at: new Date(startMs).toISOString(),
      duration_minutes: DEMO_DURATION_MIN,
      polls_launched: 1,
      status: "live",
    })
    .select("id")
    .single();
  if (sessErr) throw sessErr;
  const sessionId = session.id as string;

  // 1 absent, 1 late (minute 9), everyone else joins within the first 3 minutes (the late threshold).
  const [, late, ...onTime] = shuffle(roster.map((s) => s.id as string));
  const joins = [
    ...onTime.map((studentId) => ({ studentId, min: rand(0, 3) })),
    ...(late ? [{ studentId: late, min: 9 }] : []),
  ];
  await ingestConnection(
    joins.map((j) => ({
      sessionId,
      studentId: j.studentId,
      type: "join" as const,
      occurredAt: isoAt(startMs, j.min),
      source: "simulator" as const,
    })),
  );

  // Poll 1 at minute 10: ~70% of attendees respond within two minutes. A few chats and a hand raise.
  const attendees = joins.map((j) => j.studentId);
  const responders = shuffle(attendees).slice(0, Math.round(attendees.length * 0.7));
  const participation: ParticipationInput[] = [
    ...responders.map((studentId) => ({
      sessionId,
      studentId,
      kind: "poll_response" as const,
      pollId: "poll-1",
      occurredAt: isoAt(startMs, rand(10.3, 12)),
      source: "simulator" as const,
    })),
    ...shuffle(attendees)
      .slice(0, 4)
      .map((studentId) => ({
        sessionId,
        studentId,
        kind: "chat" as const,
        occurredAt: isoAt(startMs, rand(13, 24)),
        source: "simulator" as const,
      })),
    {
      sessionId,
      studentId: pick(attendees),
      kind: "hand_raise",
      occurredAt: isoAt(startMs, rand(15, 24)),
      source: "simulator",
    },
  ];
  await ingestParticipation(participation);

  return json({ action: "start_live_demo", sessionId, message: "Live demo started 25 minutes in." });
}

const connectedOf = (timeline: StudentTimeline[]) => timeline.filter((s) => s.connected);
const disconnectedOf = (timeline: StudentTimeline[]) => timeline.filter((s) => s.firstJoinMin !== null && !s.connected);

/** One random event: 50% chat/hand raise, 30% brief drop-and-rejoin, 20% nothing. */
async function tick(data: SessionData, timeline: StudentTimeline[], now: Date) {
  const sessionId = data.session.id;
  const connected = connectedOf(timeline);
  if (!connected.length) return { action: "tick", message: "Nobody connected; nothing happened." };

  const roll = Math.random();
  const student = pick(connected);
  if (roll < 0.5) {
    const kind = Math.random() < 0.7 ? "chat" : "hand_raise";
    await ingestParticipation({ sessionId, studentId: student.studentId, kind, occurredAt: now.toISOString(), source: "simulator" });
    return { action: "tick", message: `${student.name}: ${kind === "chat" ? "chat message" : "hand raise"}` };
  }
  if (roll < 0.8) {
    // A short blip: left a few seconds ago, already back. Timestamps are never in the future.
    const leftAt = new Date(now.getTime() - rand(3, 8) * 1000).toISOString();
    await ingestConnection([
      { sessionId, studentId: student.studentId, type: "leave", occurredAt: leftAt, source: "simulator" },
      { sessionId, studentId: student.studentId, type: "join", occurredAt: now.toISOString(), source: "simulator" },
    ]);
    return { action: "tick", message: `${student.name}: brief connection drop` };
  }
  return { action: "tick", message: "Quiet moment; no event." };
}

/** 4 different connected students drop within ~3 seconds. The client calls "recover" ~20s later. */
async function networkStorm(data: SessionData, timeline: StudentTimeline[], now: Date) {
  const victims = shuffle(connectedOf(timeline)).slice(0, STORM_SIZE);
  if (!victims.length) return { action: "network_storm", affected: 0, message: "Nobody connected to drop." };
  await ingestConnection(
    victims.map((s, i) => ({
      sessionId: data.session.id,
      studentId: s.studentId,
      type: "leave" as const,
      occurredAt: new Date(now.getTime() - (victims.length - 1 - i) * rand(500, 1000)).toISOString(),
      source: "simulator" as const,
    })),
  );
  return { action: "network_storm", affected: victims.length, message: `${victims.length} students dropped.` };
}

/** Rejoin every currently disconnected student. */
async function recover(data: SessionData, timeline: StudentTimeline[], now: Date) {
  const gone = disconnectedOf(timeline);
  await ingestConnection(
    gone.map((s) => ({
      sessionId: data.session.id,
      studentId: s.studentId,
      type: "join" as const,
      occurredAt: now.toISOString(),
      source: "simulator" as const,
    })),
  );
  return { action: "recover", rejoined: gone.length, message: `${gone.length} students rejoined.` };
}

/** Increment polls_launched and record responses from ~65% of connected students. */
async function launchPoll(data: SessionData, timeline: StudentTimeline[], now: Date) {
  const pollNumber = data.session.polls_launched + 1;
  const { error } = await createAdminClient()
    .from("sessions")
    .update({ polls_launched: pollNumber })
    .eq("id", data.session.id);
  if (error) throw error;

  const connected = connectedOf(timeline);
  const responders = shuffle(connected).slice(0, Math.round(connected.length * 0.65));
  await ingestParticipation(
    responders.map((s) => ({
      sessionId: data.session.id,
      studentId: s.studentId,
      kind: "poll_response" as const,
      pollId: `poll-${pollNumber}`,
      occurredAt: now.toISOString(),
      source: "simulator" as const,
    })),
  );
  return {
    action: "launch_poll",
    pollNumber,
    responses: responders.length,
    message: `Poll ${pollNumber}: ${responders.length} of ${connected.length} connected responded.`,
  };
}

/** Mark the session ended; trim its duration to the time actually elapsed so the report timeline is accurate. */
async function endSession(data: SessionData, now: Date) {
  const elapsed = Math.ceil(sessionEndMin(data.session, now));
  const duration = Math.max(5, Math.min(data.session.duration_minutes, elapsed));
  const { error } = await createAdminClient()
    .from("sessions")
    .update({ status: "ended", duration_minutes: duration })
    .eq("id", data.session.id);
  if (error) throw error;
  return { action: "end_session", durationMinutes: duration, message: `Session ended after ${duration} min.` };
}

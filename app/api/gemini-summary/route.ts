// app/api/gemini-summary/route.ts
// POST { sessionId, previous? } → structured instructor briefing.
// Detection is deterministic (lib/metrics.ts); Gemini's job is judgement across signals. Only the pseudonymised
// payload from lib/model-context.ts goes to Gemini; names are restored here, server-side.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadSessionData } from "@/lib/data";
import { GEMINI_MODEL, generateStructured } from "@/lib/gemini";
import { buildModelContext, type ModelContext } from "@/lib/model-context";
import {
  PRIORITIES,
  mapBriefingText,
  parseBriefing,
  type BriefingContent,
  type BriefingResponse,
  type Priority,
} from "@/lib/model-output";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** An alert ending within this many minutes of now counts as current on a live session. */
const CURRENT_ALERT_MIN = 10;

// Gemini native structured output. Property order is deliberate: the model states what changed and reasons
// (insights, actions) before committing to a priority and headline.
const BRIEFING_SCHEMA = {
  type: "object",
  properties: {
    whatChanged: {
      type: "string",
      description:
        "One sentence on what changed since previousBriefing (new alert, poll, drops, recoveries). If previousBriefing is null, say this is the first briefing.",
    },
    insights: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "Observations that connect signals, e.g. poll context vs the overall poll response rate.",
    },
    suggestedActions: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "Actions ordered by urgency; the first must be doable in the next 60 seconds.",
    },
    priority: {
      type: "string",
      enum: [...PRIORITIES],
      description: "act_now: needs attention right now. monitor: worth watching. all_clear: nothing needed.",
    },
    headline: { type: "string", description: "One-line briefing for the instructor, max 15 words." },
  },
  required: ["whatChanged", "insights", "suggestedActions", "priority", "headline"],
};

const SYSTEM_INSTRUCTION = `You are ClassPulse, an assistant that helps an instructor decide what to do during a live online class.
Detection is already done by deterministic code (stats, alerts, poll context). Your job is judgement: connect the signals, explain what they mean together, and prioritise.
You receive ONLY pseudonymised, aggregated data (students are labelled S1, S2, ...): stats, alerts, per-poll context, recent join/leave events, per-student status, and previousBriefing (your last briefing, or null).
How to reason:
- Lead with what changed since previousBriefing. If previousBriefing is null, say this is the first briefing.
- Reason across signals. Compare each poll's connectedResponseRate with stats.pollResponseRate: if students were disconnected when a poll opened (disconnectedAtOpen > 0), the overall rate understates responses from students who could answer, so say which number is the fair picture.
- Relate recentConnectionEvents to alerts and polls (e.g. drops just before a poll opened).
- Order suggestedActions by urgency. The first must be something the instructor can do in the next 60 seconds.
- priority: act_now only if something needs the instructor right now; monitor if worth watching; all_clear otherwise. An ended session is never act_now.
Hard rules:
- Never infer attention, emotion, intent, motivation, or character. You have no video, audio or message content.
- Never assert why students disconnected. Call a cluster of disconnects a "possible shared connectivity issue", never behaviour.
- Participation is measured ONLY by poll responses. Chat and hand raises are neutral "live interaction" counts; never praise or criticise a student for them.
- Students with status "absent" never joined: mention them only as absent, never as non-responders to polls.
- Be concrete, brief, and kind. Suggest actions an instructor can take (pause, repost a poll, check in privately, share the slides link).
- Refer to students only by their S-labels.`;

function ruleBasedBriefing(ctx: ModelContext, live: boolean, hadPrevious: boolean): BriefingContent {
  const { stats, alerts, timeline, payload } = ctx;
  const unstable = timeline.filter((s) => s.status === "unstable").map((s) => s.name);
  const silent = timeline.filter((s) => s.firstJoinMin !== null && s.pollResponses === 0).map((s) => s.name);
  const currentAlert = live && alerts.some((a) => a.endMin >= payload.elapsedMinutes - CURRENT_ALERT_MIN);
  const priority: Priority = currentAlert
    ? "act_now"
    : alerts.length || unstable.length || silent.length
      ? "monitor"
      : "all_clear";

  const insights: string[] = [];
  if (alerts.length) insights.push(alerts[alerts.length - 1].message);
  if (unstable.length) insights.push(`Unstable connections: ${unstable.join(", ")}.`);
  if (stats.pollResponseRate !== null) insights.push(`Poll response rate is ${stats.pollResponseRate}%.`);
  return {
    whatChanged: hadPrevious
      ? "Rules fallback: Gemini is unavailable, so changes since the last briefing aren't summarised."
      : "First briefing for this session (rules fallback).",
    insights: insights.slice(0, 3),
    suggestedActions: [
      ...(alerts.length ? ["Pause briefly and ask if anyone lost audio or video."] : []),
      ...(silent.length ? [`Repost the last poll; ${silent.length} student(s) haven't responded yet.`] : []),
      ...(unstable.length ? ["Share the slides link so students with unstable connections can follow along."] : []),
    ].slice(0, 3),
    priority,
    headline: alerts.length
      ? "Possible shared connectivity issue in this session"
      : `${stats.connectedNow} of ${stats.enrolled} students connected`,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    /* handled below */
  }
  const { sessionId, previous } = (body ?? {}) as { sessionId?: unknown; previous?: unknown };
  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "Body must be { sessionId: string, previous?: briefing }" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS guarantees this only returns a session the logged-in instructor owns.
  const data = await loadSessionData(supabase, sessionId);
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const ctx = buildModelContext(data, new Date());
  // `previous` comes from the client: re-validate it and re-mask it so no name can reach the model through it.
  const parsedPrevious = previous == null ? null : parseBriefing(previous);
  const previousBriefing = parsedPrevious ? mapBriefingText(parsedPrevious, ctx.mask) : null;
  const modelInput = { ...ctx.payload, previousBriefing };

  const t0 = Date.now();
  try {
    const raw = await generateStructured({
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: JSON.stringify(modelInput),
      schema: BRIEFING_SCHEMA,
    });
    const modelOutput = parseBriefing(raw);
    if (!modelOutput) throw new Error("Model output failed validation");
    const res: BriefingResponse = {
      source: "gemini",
      model: GEMINI_MODEL,
      latencyMs: Date.now() - t0,
      ...mapBriefingText(modelOutput, ctx.unmask),
      modelInput,
      modelOutput,
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error("Gemini briefing failed, using rules fallback:", err);
    const res: BriefingResponse = {
      source: "rules",
      model: null,
      latencyMs: Date.now() - t0,
      ...ruleBasedBriefing(ctx, data.session.status === "live", previousBriefing !== null),
      modelInput,
      modelOutput: null,
    };
    return NextResponse.json(res);
  }
}

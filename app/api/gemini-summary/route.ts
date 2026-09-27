// app/api/gemini-summary/route.ts
// POST { sessionId } → structured instructor briefing.
// Metrics are computed server-side; ONLY pseudonymised aggregates go to Gemini; names are mapped back here.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadSessionData } from "@/lib/data";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini";
import {
  buildTimeline, computeStats, detectAlerts, sessionEndMin,
  type Alert, type Stats, type StudentTimeline,
} from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Briefing = { headline: string; insights: string[]; suggestedActions: string[] };

// Gemini native structured output: the model must return an object matching this JSON Schema.
const BRIEFING_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One-line briefing for the instructor, max 15 words." },
    insights: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "Observations about connection reliability and poll responses.",
    },
    suggestedActions: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "Concrete actions the instructor can take right now.",
    },
  },
  required: ["headline", "insights", "suggestedActions"],
};

const SYSTEM_INSTRUCTION = `You are ClassPulse, an assistant that briefs an instructor on live online class reliability.
You receive ONLY aggregated, pseudonymised metrics (students are labelled S1, S2, ...).
Hard rules:
- Never infer attention, emotion, intent, motivation, or character. You have no video or message content.
- Disconnection clusters are reliability issues (network/platform), not behaviour.
- Participation is measured ONLY by poll responses. Chat and hand raises are neutral "live interaction" counts; never praise or criticise a student for them.
- Students with status "absent" never joined: mention them only as absent, never as non-responders to polls.
- Be concrete, brief, and kind. Suggest actions an instructor can take right now (pause, repost a poll, check in privately, share the slides link).
- Refer to students only by their S-labels.`;

function ruleBasedBriefing(stats: Stats, alerts: Alert[], timeline: StudentTimeline[]): Briefing {
  const unstable = timeline.filter((s) => s.status === "unstable").map((s) => s.name);
  const silent = timeline.filter((s) => s.firstJoinMin !== null && s.pollResponses === 0).map((s) => s.name);
  const insights: string[] = [];
  if (alerts.length) insights.push(alerts[alerts.length - 1].message);
  if (unstable.length) insights.push(`Unstable connections: ${unstable.join(", ")}.`);
  if (stats.pollResponseRate !== null) insights.push(`Poll response rate is ${stats.pollResponseRate}%.`);
  return {
    headline: alerts.length
      ? "Connection issue detected in this session"
      : `${stats.connectedNow} of ${stats.enrolled} students connected`,
    insights,
    suggestedActions: [
      ...(alerts.length ? ["Pause briefly and ask if anyone lost audio or video."] : []),
      ...(silent.length ? [`Repost the last poll; ${silent.length} student(s) haven't responded yet.`] : []),
      ...(unstable.length ? ["Share the slides link so students with unstable connections can follow along."] : []),
    ].slice(0, 3),
  };
}

export async function POST(req: Request) {
  let sessionId: unknown;
  try {
    ({ sessionId } = await req.json());
  } catch {
    /* handled below */
  }
  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "Body must be { sessionId: string }" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS guarantees this only returns a session the logged-in instructor owns.
  const data = await loadSessionData(supabase, sessionId);
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const now = new Date();
  const timeline = buildTimeline(data.session, data.students, data.logs, data.events, now);
  const stats = computeStats(data.session, timeline);
  const alerts = detectAlerts(data.session, data.logs);

  // Pseudonymise: Gemini never sees names.
  const labelToName = new Map(timeline.map((s, i) => [`S${i + 1}`, s.name]));
  const payload = {
    sessionStatus: data.session.status,
    elapsedMinutes: sessionEndMin(data.session, now),
    durationMinutes: data.session.duration_minutes,
    pollsLaunched: data.session.polls_launched,
    stats,
    alerts: alerts.map(({ startMin, endMin, affectedCount }) => ({ startMin, endMin, affectedCount })),
    students: timeline.map((s, i) => ({
      label: `S${i + 1}`,
      status: s.status,
      dropCount: s.dropCount,
      firstJoinMin: s.firstJoinMin,
      // null = not applicable: absent students can't be poll non-responders (Silent requires attendance).
      pollResponses: s.firstJoinMin === null ? null : s.pollResponses,
    })),
  };
  const unmask = (text: string) => text.replace(/\bS(\d+)\b/g, (m) => labelToName.get(m) ?? m);

  const t0 = Date.now();
  try {
    const response = await getGemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: JSON.stringify(payload),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: BRIEFING_SCHEMA,
        // Client-side 8s cutoff: the API rejects httpOptions.timeout below 10s ("Minimum allowed deadline is 10s").
        abortSignal: AbortSignal.timeout(8000),
      },
    });
    const raw = JSON.parse(response.text ?? "{}") as Partial<Briefing>;
    const briefing: Briefing = {
      headline: unmask(String(raw.headline ?? "")),
      insights: (raw.insights ?? []).slice(0, 3).map((x) => unmask(String(x))),
      suggestedActions: (raw.suggestedActions ?? []).slice(0, 3).map((x) => unmask(String(x))),
    };
    if (!briefing.headline) throw new Error("Empty model output");
    return NextResponse.json({ source: "gemini", model: GEMINI_MODEL, latencyMs: Date.now() - t0, ...briefing });
  } catch (err) {
    console.error("Gemini briefing failed, using rules fallback:", err);
    return NextResponse.json({
      source: "rules",
      model: null,
      latencyMs: Date.now() - t0,
      ...ruleBasedBriefing(stats, alerts, timeline),
    });
  }
}

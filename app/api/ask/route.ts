// app/api/ask/route.ts — POST { sessionId, question } → a grounded answer from Gemini about this session.
// Same auth/RLS and privacy boundary as the briefing: names in the question are masked, only the pseudonymised
// payload is sent, and names are restored here. No rules fallback: returns 503 if Gemini is unavailable.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadSessionData } from "@/lib/data";
import { GEMINI_MODEL, generateStructured } from "@/lib/gemini";
import { buildModelContext } from "@/lib/model-context";
import { parseAnswer, type AskResponse } from "@/lib/model-output";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_CHARS = 500;

const ASK_SCHEMA = {
  type: "object",
  properties: {
    evidence: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description:
        'Up to 3 input field paths the answer relies on, e.g. "polls[0].connectedResponseRate" or "students[S4].dropCount". Empty if none.',
    },
    answerable: {
      type: "boolean",
      description: "false if ClassPulse deliberately doesn't measure this, or the data doesn't contain it.",
    },
    answer: { type: "string", description: "At most 4 sentences." },
  },
  required: ["evidence", "answerable", "answer"],
};

const SYSTEM_INSTRUCTION = `You are ClassPulse, answering an instructor's question about their online class.
You receive the question and pseudonymised, aggregated session data (students are labelled S1, S2, ...). Answer ONLY from that data, and list the fields you used as evidence.
Set answerable=false when:
- The question asks about attention, focus, emotion, mood, motivation, effort, cheating or honesty, or anything that would need video, audio, faces or chat/message text. Explain kindly that ClassPulse deliberately does not measure this, say what it does measure (connection reliability, poll responses, neutral interaction counts), and suggest the closest question it can answer.
- The data doesn't contain what's needed. Say what's missing.
Hard rules:
- Never infer attention, emotion, intent, motivation, or character.
- Never assert why a student disconnected. A cluster of disconnects is a "possible shared connectivity issue", never behaviour.
- Participation is measured ONLY by poll responses. Chat and hand raises are neutral counts; never praise or criticise a student for them.
- Students with status "absent" never joined: never describe them as poll non-responders.
- When comparing poll numbers, use each poll's connectedResponseRate alongside stats.pollResponseRate.
- Refer to students only by their S-labels. Be concise and kind.`;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    /* handled below */
  }
  const { sessionId, question } = (body ?? {}) as { sessionId?: unknown; question?: unknown };
  if (typeof sessionId !== "string" || !sessionId || typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "Body must be { sessionId: string, question: string }" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json({ error: `Question must be at most ${MAX_QUESTION_CHARS} characters` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS guarantees this only returns a session the logged-in instructor owns.
  const data = await loadSessionData(supabase, sessionId);
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const ctx = buildModelContext(data, new Date());
  const modelInput = { question: ctx.mask(question.trim()), sessionData: ctx.payload };

  const t0 = Date.now();
  try {
    const raw = await generateStructured({
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: JSON.stringify(modelInput),
      schema: ASK_SCHEMA,
    });
    const modelOutput = parseAnswer(raw);
    if (!modelOutput) throw new Error("Model output failed validation");
    const res: AskResponse = {
      model: GEMINI_MODEL,
      latencyMs: Date.now() - t0,
      evidence: modelOutput.evidence.map(ctx.unmask),
      answerable: modelOutput.answerable,
      answer: ctx.unmask(modelOutput.answer),
      modelInput,
      modelOutput,
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error("Gemini ask failed:", err);
    return NextResponse.json({ error: "Gemini is unavailable right now. Try again in a moment." }, { status: 503 });
  }
}

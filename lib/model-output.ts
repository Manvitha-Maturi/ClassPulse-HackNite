// lib/model-output.ts — shapes and runtime validators for Gemini's structured output (briefing and Ask).
// Model output is external input: never cast it, validate it. Pure, so client components can import the types.

export const PRIORITIES = ["act_now", "monitor", "all_clear"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Briefing text as the model returns it (S-labels) or after unmasking (names). */
export type BriefingContent = {
  whatChanged: string;
  insights: string[];
  suggestedActions: string[];
  priority: Priority;
  headline: string;
};

export type BriefingResponse = BriefingContent & {
  source: "gemini" | "rules";
  model: string | null;
  latencyMs: number;
  /** Exactly what was (or, for the rules fallback, would have been) sent to Gemini. Pseudonymised. */
  modelInput: unknown;
  /** Validated model output before names were restored; null for the rules fallback. */
  modelOutput: BriefingContent | null;
};

export type AskContent = { evidence: string[]; answerable: boolean; answer: string };

export type AskResponse = AskContent & {
  model: string;
  latencyMs: number;
  modelInput: unknown;
  modelOutput: AskContent;
};

const MAX_TEXT = 600;
const MAX_ITEMS = 3;

const text = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x.trim().slice(0, MAX_TEXT) : null);

const textList = (x: unknown): string[] | null =>
  Array.isArray(x) ? x.map(text).filter((s): s is string => s !== null).slice(0, MAX_ITEMS) : null;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function parseBriefing(raw: unknown): BriefingContent | null {
  if (!isRecord(raw)) return null;
  const whatChanged = text(raw.whatChanged);
  const insights = textList(raw.insights);
  const suggestedActions = textList(raw.suggestedActions);
  const priority = PRIORITIES.find((p) => p === raw.priority) ?? null;
  const headline = text(raw.headline);
  if (!whatChanged || !insights || !suggestedActions || !priority || !headline) return null;
  return { whatChanged, insights, suggestedActions, priority, headline };
}

export function parseAnswer(raw: unknown): AskContent | null {
  if (!isRecord(raw)) return null;
  const evidence = textList(raw.evidence);
  const answer = text(raw.answer);
  if (!evidence || typeof raw.answerable !== "boolean" || !answer) return null;
  return { evidence, answerable: raw.answerable, answer };
}

/** Apply mask/unmask to every text field of a briefing. */
export function mapBriefingText(b: BriefingContent, fn: (s: string) => string): BriefingContent {
  return {
    whatChanged: fn(b.whatChanged),
    insights: b.insights.map(fn),
    suggestedActions: b.suggestedActions.map(fn),
    priority: b.priority,
    headline: fn(b.headline),
  };
}

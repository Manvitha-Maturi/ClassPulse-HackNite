// lib/gemini.ts — lazy so a missing key never breaks `next build`
import "server-only";
import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;
export function getGemini(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

/**
 * One structured-output call: returns the parsed JSON (unvalidated — callers must validate).
 * Throws on API errors, timeouts, or non-JSON output.
 */
export async function generateStructured(opts: {
  systemInstruction: string;
  contents: string;
  schema: object;
  timeoutMs?: number;
}): Promise<unknown> {
  const response = await getGemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: opts.contents,
    config: {
      systemInstruction: opts.systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: opts.schema,
      // Client-side cutoff: the API rejects httpOptions.timeout below 10s ("Minimum allowed deadline is 10s").
      abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    },
  });
  return JSON.parse(response.text ?? "");
}

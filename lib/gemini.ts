// lib/gemini.ts — lazy so a missing key never breaks `next build`
import "server-only";
import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;
export function getGemini(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

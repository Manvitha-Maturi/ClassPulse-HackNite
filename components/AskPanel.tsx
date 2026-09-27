"use client";

// components/AskPanel.tsx — ask Gemini a question about this session (POST /api/ask).
// Answers are grounded in the pseudonymised session data; questions about attention, emotion etc. are
// declined by design. No rules fallback: if Gemini is unavailable the panel says so.
import { useState } from "react";
import type { AskResponse } from "@/lib/model-output";
import ModelIO from "./ModelIO";
import { ShieldIcon, SparklesIcon } from "./icons";

const SUGGESTIONS = [
  "Is the latest poll's response rate a fair picture?",
  "Who should I follow up with privately after class, and why?",
  "Which students aren't paying attention?",
];

const MAX_QUESTION_CHARS = 500;

export default function AskPanel({ sessionId }: { sessionId: string }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setQuestion(trimmed);
    setAsked(trimmed);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(null);
        setError(body.error ?? `Request failed (${res.status})`);
      } else {
        setResult(body as AskResponse);
      }
    } catch {
      setResult(null);
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 print:hidden">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
          <SparklesIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ask about this session</h2>
          <p className="text-xs text-slate-500">Answered by Gemini from connection and poll data only.</p>
        </div>
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_QUESTION_CHARS}
          placeholder="e.g. Did the network storm affect the last poll?"
          aria-label="Question about this session"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg disabled:opacity-50"
        >
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            onClick={() => void ask(s)}
            className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading && !result && (
        <div className="mt-5 space-y-2" aria-label="Waiting for Gemini">
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
        </div>
      )}

      {result && (
        <div className={`mt-5 rounded-xl bg-slate-50/70 p-4 ring-1 ring-slate-200/70 ${loading ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            {asked && <p className="text-sm font-medium text-slate-900">“{asked}”</p>}
            {!result.answerable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-white">
                <ShieldIcon className="h-3.5 w-3.5" />
                Declined by design
              </span>
            )}
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
              Gemini · {result.model} · {result.latencyMs} ms
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{result.answer}</p>
          {result.evidence.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Evidence</span>
              {result.evidence.map((e) => (
                <span key={e} className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200">
                  {e}
                </span>
              ))}
            </div>
          )}
          <ModelIO input={result.modelInput} output={result.modelOutput} />
        </div>
      )}
    </section>
  );
}

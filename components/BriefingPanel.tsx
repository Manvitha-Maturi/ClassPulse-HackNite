"use client";

// components/BriefingPanel.tsx — AI briefing from POST /api/gemini-summary (Gemini, or the rules fallback).
// Loads once, on Refresh, and — on live sessions — when the alert set changes. Never on every event,
// to stay within Gemini free-tier rate limits.
import { useEffect, useState } from "react";

type Briefing = {
  source: "gemini" | "rules";
  model: string | null;
  latencyMs: number;
  headline: string;
  insights: string[];
  suggestedActions: string[];
};

type Props = {
  sessionId: string;
  /** Changes when a new reliability alert appears (or grows); triggers an automatic refresh. */
  alertSignature: string;
};

async function fetchBriefing(sessionId: string): Promise<Briefing | { error: string }> {
  try {
    const res = await fetch("/api/gemini-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error ?? `Briefing request failed (${res.status})` };
    return body as Briefing;
  } catch {
    return { error: "Could not reach the server." };
  }
}

export default function BriefingPanel({ sessionId, alertSignature }: Props) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchBriefing(sessionId).then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else {
        setBriefing(result);
        setError(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, alertSignature, nonce]);

  const refresh = () => {
    setLoading(true);
    setNonce((n) => n + 1);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-slate-900">AI briefing</h2>
          {briefing && <SourceBadge briefing={briefing} />}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!briefing && loading && <p className="mt-3 text-sm text-slate-500">Generating briefing…</p>}

      {briefing && (
        <div className={`mt-3 space-y-4 ${loading ? "opacity-60" : ""}`}>
          <p className="text-lg font-medium text-slate-900">{briefing.headline}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <List title="Observations" items={briefing.insights} empty="Nothing notable yet." />
            <List title="Suggested actions" items={briefing.suggestedActions} empty="No action needed right now." />
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">Names are never sent to the AI model.</p>
    </section>
  );
}

function SourceBadge({ briefing }: { briefing: Briefing }) {
  if (briefing.source === "rules") {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Rules fallback</span>
    );
  }
  return (
    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
      Gemini · {briefing.model} · {briefing.latencyMs} ms
    </span>
  );
}

function List({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-slate-400">{empty}</p>
      )}
    </div>
  );
}

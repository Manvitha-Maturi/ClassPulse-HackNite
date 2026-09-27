"use client";

// components/BriefingPanel.tsx — AI briefing from POST /api/gemini-summary (Gemini, or the rules fallback).
// Loads once, on Refresh, and — on live sessions — when the alert set changes. Never on every event,
// to stay within Gemini free-tier rate limits.
import { useEffect, useState } from "react";
import { RefreshIcon, ShieldIcon, SparklesIcon } from "./icons";

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
  /** Show the Refresh button (off for the frozen report, which generates once on load). */
  refreshable?: boolean;
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

export default function BriefingPanel({ sessionId, alertSignature, refreshable = true }: Props) {
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
    <section
      className="rounded-2xl bg-gradient-to-br from-indigo-200 via-violet-200 to-sky-200 p-px shadow-sm shadow-indigo-100"
      data-print-avoid-break
    >
      <div className="rounded-[15px] bg-gradient-to-br from-white via-white to-indigo-50/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30">
              <SparklesIcon className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-semibold text-slate-900">AI briefing</h2>
            {briefing && <SourceBadge briefing={briefing} />}
          </div>
          {refreshable && (
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-50 print:hidden"
            >
              <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Thinking…" : "Refresh"}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        {!briefing && loading && (
          <div className="mt-5 space-y-3" aria-label="Generating briefing">
            <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200/70" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
          </div>
        )}

        {briefing && (
          <div className={`mt-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
            <p className="text-xl font-semibold leading-snug tracking-tight text-slate-900">{briefing.headline}</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Observations items={briefing.insights} />
              <Actions items={briefing.suggestedActions} />
            </div>
          </div>
        )}

        <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldIcon className="h-3.5 w-3.5 text-emerald-600" />
          Names are never sent to the AI model.
        </p>
      </div>
    </section>
  );
}

function SourceBadge({ briefing }: { briefing: Briefing }) {
  if (briefing.source === "rules") {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
        Rules fallback
      </span>
    );
  }
  return (
    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
      Gemini · {briefing.model} · {briefing.latencyMs} ms
    </span>
  );
}

function Observations({ items }: { items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Observations</h3>
      {items.length ? (
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {items.map((x, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              {x}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-400">Nothing notable yet.</p>
      )}
    </div>
  );
}

function Actions({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl bg-white/70 p-4 ring-1 ring-slate-200/70">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Suggested actions</h3>
      {items.length ? (
        <ol className="mt-2 space-y-2 text-sm text-slate-700">
          {items.map((x, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
                {i + 1}
              </span>
              {x}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-slate-400">No action needed right now.</p>
      )}
    </div>
  );
}

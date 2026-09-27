"use client";

// components/BriefingPanel.tsx — AI briefing from POST /api/gemini-summary (Gemini, or the rules fallback).
// Loads once, on Refresh, and — on live sessions — when the signal set changes (alerts, polls, connected
// count), debounced so a burst of events is one call. Never on every event, to stay within Gemini rate limits.
import { useEffect, useRef, useState } from "react";
import type { BriefingContent, BriefingResponse, Priority } from "@/lib/model-output";
import ModelIO from "./ModelIO";
import { RefreshIcon, ShieldIcon, SparklesIcon } from "./icons";

const SIGNAL_DEBOUNCE_MS = 1200;

const PRIORITY_CHIP: Record<Priority, { label: string; className: string }> = {
  act_now: { label: "Act now", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  monitor: { label: "Monitor", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  all_clear: { label: "All clear", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

type Props = {
  sessionId: string;
  /** Changes when the alerts, polls or connected count change; triggers a debounced refresh. */
  alertSignature: string;
  /** Show the Refresh button (off for the frozen report, which generates once on load). */
  refreshable?: boolean;
};

async function fetchBriefing(
  sessionId: string,
  previous: BriefingContent | null,
): Promise<BriefingResponse | { error: string }> {
  try {
    const res = await fetch("/api/gemini-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, previous }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error ?? `Briefing request failed (${res.status})` };
    return body as BriefingResponse;
  } catch {
    return { error: "Could not reach the server." };
  }
}

export default function BriefingPanel({ sessionId, alertSignature, refreshable = true }: Props) {
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  // Last validated model output (S-labels, no names), sent back as `previous` so Gemini can say what changed.
  const previousRef = useRef<BriefingContent | null>(null);
  const lastSignatureRef = useRef(alertSignature);

  useEffect(() => {
    let cancelled = false;
    fetchBriefing(sessionId, previousRef.current).then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else {
        if (result.modelOutput) previousRef.current = result.modelOutput;
        setBriefing(result);
        setError(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, nonce]);

  // Signal-driven refresh: wait until the signals settle for SIGNAL_DEBOUNCE_MS, then fetch once.
  useEffect(() => {
    if (alertSignature === lastSignatureRef.current) return;
    lastSignatureRef.current = alertSignature;
    const t = setTimeout(() => {
      setLoading(true);
      setNonce((n) => n + 1);
    }, SIGNAL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [alertSignature]);

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
            {briefing && <PriorityChip priority={briefing.priority} />}
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
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold text-indigo-700">Since last briefing:</span> {briefing.whatChanged}
            </p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Observations items={briefing.insights} />
              <Actions items={briefing.suggestedActions} />
            </div>
            <ModelIO input={briefing.modelInput} output={briefing.modelOutput} />
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

function PriorityChip({ priority }: { priority: Priority }) {
  const chip = PRIORITY_CHIP[priority];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${chip.className}`}>{chip.label}</span>
  );
}

function SourceBadge({ briefing }: { briefing: BriefingResponse }) {
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

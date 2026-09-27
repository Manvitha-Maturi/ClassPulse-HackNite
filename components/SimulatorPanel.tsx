"use client";

// components/SimulatorPanel.tsx — demo-mode controls that inject events via /api/sessions/[id]/simulate.
// The dashboard updates through Realtime, not from these responses.
import { useCallback, useEffect, useRef, useState } from "react";
import { PollIcon, RefreshIcon, StepIcon, StopIcon, ZapIcon } from "./icons";

type SimAction = "tick" | "network_storm" | "recover" | "launch_poll" | "end_session";

const AUTO_TICK_MS = 3000;
const STORM_RECOVER_MS = 20_000;

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export async function simulate(sessionId: string, action: string): Promise<{ message?: string; error?: string; sessionId?: string }> {
  const res = await fetch(`/api/sessions/${sessionId}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: body.error ?? `Request failed (${res.status})` };
  return body;
}

export default function SimulatorPanel({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState<SimAction | null>(null);
  const [autoTick, setAutoTick] = useState(false);
  const [log, setLog] = useState<string>("Ready.");
  const [recoverAt, setRecoverAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const recoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const run = useCallback(
    async (action: SimAction) => {
      setBusy(action);
      const result = await simulate(sessionId, action);
      setBusy(null);
      setLog(result.error ? `Error: ${result.error}` : (result.message ?? "Done."));
      return !result.error;
    },
    [sessionId],
  );

  // Auto tick: one random event every 3s while enabled.
  useEffect(() => {
    if (!autoTick) return;
    const t = setInterval(() => void run("tick"), AUTO_TICK_MS);
    return () => clearInterval(t);
  }, [autoTick, run]);

  // Storm countdown display.
  useEffect(() => {
    if (recoverAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [recoverAt]);

  useEffect(() => () => clearTimeout(recoverTimer.current), []);

  const storm = async () => {
    const ok = await run("network_storm");
    if (!ok) return;
    clearTimeout(recoverTimer.current);
    const at = Date.now() + STORM_RECOVER_MS;
    setRecoverAt(at);
    setNow(Date.now());
    recoverTimer.current = setTimeout(() => {
      setRecoverAt(null);
      void run("recover");
    }, STORM_RECOVER_MS);
  };

  const endSession = async () => {
    setAutoTick(false);
    clearTimeout(recoverTimer.current);
    setRecoverAt(null);
    await run("end_session");
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-slate-100 ring-1 ring-white/10 transition hover:bg-white/15 disabled:opacity-40";
  const secondsLeft = recoverAt === null ? null : Math.max(0, Math.ceil((recoverAt - now) / 1000));

  return (
    <section className="rounded-2xl bg-slate-900 p-5 text-slate-100 shadow-lg shadow-slate-900/10 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-indigo-300 ring-1 ring-white/10">
            <ZapIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-white">Live class simulator</h2>
            <p className="text-xs text-slate-400">Demo mode · injects events through the ingest adapter</p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={autoTick}
            onChange={(e) => setAutoTick(e.target.checked)}
          />
          <span className="relative h-5 w-9 rounded-full bg-white/15 transition peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
          Auto tick (3s)
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className={btn} disabled={busy !== null} onClick={() => void run("tick")}>
          <StepIcon className="h-4 w-4" />
          Tick
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-rose-500/25 transition hover:shadow-lg disabled:opacity-40"
          disabled={busy !== null || recoverAt !== null}
          onClick={() => void storm()}
        >
          <ZapIcon className="h-4 w-4" />
          Network storm
        </button>
        <button className={btn} disabled={busy !== null} onClick={() => void run("recover")}>
          <RefreshIcon className="h-4 w-4" />
          Recover
        </button>
        <button className={btn} disabled={busy !== null} onClick={() => void run("launch_poll")}>
          <PollIcon className="h-4 w-4" />
          Launch poll
        </button>
        <button className={btn} disabled={busy !== null} onClick={() => void endSession()}>
          <StopIcon className="h-4 w-4" />
          End session
        </button>
      </div>
      <p
        className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-slate-300"
        aria-live="polite"
      >
        <span className="text-emerald-400">›</span>
        {busy ? `Running ${busy.replace("_", " ")}…` : log}
        {secondsLeft !== null && (
          <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-amber-300">auto-recover in {secondsLeft}s</span>
        )}
      </p>
    </section>
  );
}

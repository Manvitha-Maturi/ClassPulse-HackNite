"use client";

// components/SimulatorPanel.tsx — demo-mode controls that inject events via /api/sessions/[id]/simulate.
// The dashboard updates through Realtime, not from these responses.
import { useCallback, useEffect, useRef, useState } from "react";

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
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50";
  const secondsLeft = recoverAt === null ? null : Math.max(0, Math.ceil((recoverAt - now) / 1000));

  return (
    <section className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-indigo-900">Live class simulator</h2>
        <span className="text-xs text-indigo-700">Demo mode · injects events through the ingest adapter</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={btn} disabled={busy !== null} onClick={() => void run("tick")}>
          Tick
        </button>
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
          <input type="checkbox" checked={autoTick} onChange={(e) => setAutoTick(e.target.checked)} />
          Auto tick (3s)
        </label>
        <button
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          disabled={busy !== null || recoverAt !== null}
          onClick={() => void storm()}
        >
          Network storm
        </button>
        <button className={btn} disabled={busy !== null} onClick={() => void run("recover")}>
          Recover
        </button>
        <button className={btn} disabled={busy !== null} onClick={() => void run("launch_poll")}>
          Launch poll
        </button>
        <button className={btn} disabled={busy !== null} onClick={() => void endSession()}>
          End session
        </button>
      </div>
      <p className="mt-3 text-sm text-slate-600" aria-live="polite">
        {busy ? `Running ${busy.replace("_", " ")}…` : log}
        {secondsLeft !== null && ` · auto-recover in ${secondsLeft}s`}
      </p>
    </section>
  );
}

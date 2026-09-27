"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayIcon } from "./icons";
import { simulate } from "./SimulatorPanel";

export default function StartLiveDemoButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPending(true);
    setError(null);
    // The session id in the path is ignored for start_live_demo; a new live session is created.
    const result = await simulate("new", "start_live_demo");
    if (result.error || !result.sessionId) {
      setError(result.error ?? "Could not start the demo.");
      setPending(false);
      return;
    }
    router.push(`/sessions/${result.sessionId}`);
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        onClick={() => void start()}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-60"
      >
        <PlayIcon className="h-4 w-4" fill="currentColor" />
        {pending ? "Starting…" : "Start live demo"}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => void start()}
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Starting…" : "Start live demo"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

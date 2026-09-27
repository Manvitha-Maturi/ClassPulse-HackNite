"use client";

import { useEffect, useState } from "react";
import type { RealtimeStatus } from "./useSessionRealtime";

const STATUS_DOT: Record<RealtimeStatus, { className: string; label: string }> = {
  connecting: { className: "bg-slate-300", label: "Connecting to live updates" },
  live: { className: "bg-green-500", label: "Live updates on" },
  error: { className: "bg-red-500", label: "Live updates unavailable" },
  closed: { className: "bg-slate-300", label: "Live updates off" },
};

/** "Updated Xs ago" with a realtime connection dot. Ticks on its own so the dashboard doesn't re-render every second. */
export default function UpdatedAgo({ receivedAt, status }: { receivedAt: number; status: RealtimeStatus }) {
  const [now, setNow] = useState(receivedAt);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const secs = Math.max(0, Math.round((now - receivedAt) / 1000));
  const ago = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m`;
  const dot = STATUS_DOT[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" title={dot.label}>
      <span className={`h-2 w-2 rounded-full ${dot.className}`} />
      Updated {ago} ago
    </span>
  );
}

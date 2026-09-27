"use client";

// components/useSessionRealtime.ts — subscribes to Supabase Realtime for one session and calls onChange
// (debounced) whenever its connection logs, participation events, or session row change. RLS still applies.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RealtimeStatus = "connecting" | "live" | "error" | "closed";

const DEBOUNCE_MS = 400;

export function useSessionRealtime(sessionId: string, onChange: () => void): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const trigger = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`session:${sessionId}`, { config: { postgres_changes_options: { wait: true } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "connection_logs", filter: `session_id=eq.${sessionId}` },
        trigger,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participation_events", filter: `session_id=eq.${sessionId}` },
        trigger,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        trigger,
      )
      .subscribe((state, err) => {
        if (state === "SUBSCRIBED") {
          setStatus("live");
          trigger(); // catch anything that changed between the first fetch and the subscription
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          if (err) console.error("Realtime subscription failed:", err);
          setStatus("error");
        } else if (state === "CLOSED") {
          setStatus("closed");
        }
      });

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return status;
}

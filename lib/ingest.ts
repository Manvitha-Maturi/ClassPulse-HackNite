// lib/ingest.ts — the single write path for platform events (simulator today, platform webhooks later).
// Server-only: writes with the service-role client, so callers must authorise the session first.
// Privacy: only event type/kind + timestamp are stored — never chat text.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type EventSource = "seed" | "simulator" | "zoom";

export type ConnectionInput = {
  sessionId: string;
  studentId: string;
  type: "join" | "leave";
  occurredAt: string; // ISO timestamptz (UTC)
  source: EventSource;
};

export type ParticipationInput = {
  sessionId: string;
  studentId: string;
  kind: "chat" | "poll_response" | "hand_raise";
  pollId?: string;
  occurredAt: string; // ISO timestamptz (UTC)
  source: EventSource;
};

const asArray = <T,>(x: T | T[]): T[] => (Array.isArray(x) ? x : [x]);

export async function ingestConnection(input: ConnectionInput | ConnectionInput[]): Promise<void> {
  const rows = asArray(input).map((e) => ({
    session_id: e.sessionId,
    student_id: e.studentId,
    event_type: e.type,
    occurred_at: e.occurredAt,
    source: e.source,
  }));
  if (!rows.length) return;
  const { error } = await createAdminClient().from("connection_logs").insert(rows);
  if (error) throw error;
}

export async function ingestParticipation(input: ParticipationInput | ParticipationInput[]): Promise<void> {
  const rows = asArray(input).map((e) => ({
    session_id: e.sessionId,
    student_id: e.studentId,
    kind: e.kind,
    poll_id: e.kind === "poll_response" ? (e.pollId ?? null) : null,
    occurred_at: e.occurredAt,
    source: e.source,
  }));
  if (!rows.length) return;
  const { error } = await createAdminClient().from("participation_events").insert(rows);
  if (error) throw error;
}

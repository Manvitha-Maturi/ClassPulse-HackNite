// lib/data.ts — loads everything the metrics need for one session
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionLog, ParticipationEvent, Session, Student } from "./metrics";

export type SessionData = {
  session: Session & { course_code: string; course_name: string | null };
  students: Student[];
  logs: ConnectionLog[];
  events: ParticipationEvent[];
};

export async function loadSessionData(supabase: SupabaseClient, sessionId: string): Promise<SessionData | null> {
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, course_code, course_name, started_at, duration_minutes, polls_launched, status")
    .eq("id", sessionId)
    .single();
  if (error || !session) return null;

  const [studentsRes, logsRes, eventsRes] = await Promise.all([
    supabase.from("students").select("id, display_name").eq("course_code", session.course_code).order("display_name"),
    supabase
      .from("connection_logs")
      .select("student_id, event_type, occurred_at")
      .eq("session_id", sessionId)
      .order("occurred_at"),
    supabase.from("participation_events").select("student_id, kind, poll_id, occurred_at").eq("session_id", sessionId),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (logsRes.error) throw logsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  return { session, students: studentsRes.data, logs: logsRes.data, events: eventsRes.data };
}

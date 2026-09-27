// scripts/seed.ts — idempotent demo data: the deterministic CS3003 scenario from docs/BLUEPRINT.md §4.2.
// Run with `npm run seed`. Uses the service-role key directly (lib/supabase/admin.ts is server-only).
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const COURSE_CODE = "CS3003";
const COURSE_NAME = "Software Engineering";
const STARTED_AT = "2026-10-05T18:00:00Z";
const DURATION_MIN = 75;
// Polls launch at minutes 10, 30, 55; responses land one minute later.
const POLL_ID_BY_RESPONSE_MIN: Record<number, string> = { 11: "poll-1", 31: "poll-2", 56: "poll-3" };

type Row = {
  name: string;
  conn: ["join" | "leave", number][];
  polls: number[];
  chats: number[];
  hands: number[];
};

const ROSTER: Row[] = [
  { name: "Priya S.", conn: [["join", 0.2]], polls: [11, 31, 56], chats: [12, 40], hands: [45] },
  { name: "James T.", conn: [["join", 1], ["leave", 22], ["join", 25]], polls: [11, 31], chats: [31], hands: [] },
  { name: "Aisha M.", conn: [["join", 15], ["leave", 20], ["join", 23]], polls: [31], chats: [40], hands: [] },
  {
    name: "Ravi K.",
    conn: [["join", 0.75], ["leave", 18], ["join", 21], ["leave", 35], ["join", 39]],
    polls: [],
    chats: [50],
    hands: [],
  },
  { name: "Soo-Jin L.", conn: [["join", 0.5], ["leave", 19], ["join", 26]], polls: [11, 31, 56], chats: [12, 28], hands: [] },
  { name: "Marcus D.", conn: [["join", 0]], polls: [11, 31, 56], chats: [], hands: [] },
  { name: "Elena R.", conn: [["join", 2]], polls: [11, 56], chats: [], hands: [33] },
  {
    name: "Omar F.",
    conn: [["join", 1], ["leave", 50], ["join", 52], ["leave", 60], ["join", 61], ["leave", 68], ["join", 69]],
    polls: [56],
    chats: [],
    hands: [],
  },
  { name: "Hannah B.", conn: [["join", 5]], polls: [], chats: [], hands: [] },
  { name: "Diego P.", conn: [["join", 0], ["leave", 70]], polls: [11, 31, 56], chats: [], hands: [] },
  { name: "Tom K.", conn: [["join", 0]], polls: [31, 56], chats: [], hands: [] },
  { name: "Mei W.", conn: [], polls: [], chats: [], hands: [] },
];

const at = (min: number) => new Date(Date.parse(STARTED_AT) + min * 60000).toISOString();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env.local`);
  return v;
}

const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Checks the credentials with a throwaway anon client, so the service-role client's state is untouched. */
async function passwordWorks(email: string, password: string): Promise<boolean> {
  const probe = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return false;
  await probe.auth.signOut({ scope: "local" });
  return true;
}

async function findOrCreateInstructor(email: string, password: string): Promise<string> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      // Only reset the password if .env.local's no longer works: a password update revokes
      // existing login sessions, which would sign the instructor out on every re-seed.
      if (!(await passwordWorks(email, password))) {
        const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
        if (updErr) throw updErr;
        console.log(`Demo instructor exists: ${email} (password reset to .env.local value)`);
      } else {
        console.log(`Demo instructor exists: ${email}`);
      }
      return existing.id;
    }
    if (data.users.length < 1000) break;
  }
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  console.log(`Created demo instructor: ${email}`);
  return data.user.id;
}

async function main() {
  const instructorId = await findOrCreateInstructor(
    requireEnv("DEMO_INSTRUCTOR_EMAIL"),
    requireEnv("DEMO_INSTRUCTOR_PASSWORD"),
  );

  // Idempotency: sessions cascade to their logs/events; then drop the course roster.
  const delSessions = await supabase.from("sessions").delete().eq("instructor_id", instructorId);
  if (delSessions.error) throw delSessions.error;
  const delStudents = await supabase.from("students").delete().eq("course_code", COURSE_CODE);
  if (delStudents.error) throw delStudents.error;

  const { data: students, error: stErr } = await supabase
    .from("students")
    .insert(ROSTER.map((r) => ({ course_code: COURSE_CODE, display_name: r.name })))
    .select("id, display_name");
  if (stErr) throw stErr;
  const idByName = new Map(students.map((s) => [s.display_name as string, s.id as string]));

  const { data: session, error: sessErr } = await supabase
    .from("sessions")
    .insert({
      instructor_id: instructorId,
      course_code: COURSE_CODE,
      course_name: COURSE_NAME,
      started_at: STARTED_AT,
      duration_minutes: DURATION_MIN,
      polls_launched: 3,
      status: "ended",
    })
    .select("id")
    .single();
  if (sessErr) throw sessErr;

  const logs = ROSTER.flatMap((r) =>
    r.conn.map(([event_type, min]) => ({
      session_id: session.id,
      student_id: idByName.get(r.name)!,
      event_type,
      occurred_at: at(min),
      source: "seed",
    })),
  );
  const events = ROSTER.flatMap((r) => {
    const base = { session_id: session.id, student_id: idByName.get(r.name)!, source: "seed" };
    return [
      ...r.polls.map((m) => ({ ...base, kind: "poll_response", poll_id: POLL_ID_BY_RESPONSE_MIN[m], occurred_at: at(m) })),
      ...r.chats.map((m) => ({ ...base, kind: "chat", poll_id: null, occurred_at: at(m) })),
      ...r.hands.map((m) => ({ ...base, kind: "hand_raise", poll_id: null, occurred_at: at(m) })),
    ];
  });

  const logRes = await supabase.from("connection_logs").insert(logs);
  if (logRes.error) throw logRes.error;
  const evRes = await supabase.from("participation_events").insert(events);
  if (evRes.error) throw evRes.error;

  const count = async (table: string, column: string, value: string) => {
    const { count: n, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(column, value);
    if (error) throw error;
    return n;
  };
  console.log("\nSeed complete");
  console.log(`  students (${COURSE_CODE})      ${await count("students", "course_code", COURSE_CODE)}`);
  console.log(`  sessions (demo instructor) ${await count("sessions", "instructor_id", instructorId)}`);
  console.log(`  connection_logs            ${await count("connection_logs", "session_id", session.id)}`);
  console.log(`  participation_events       ${await count("participation_events", "session_id", session.id)}`);
  console.log(`  session id                 ${session.id}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

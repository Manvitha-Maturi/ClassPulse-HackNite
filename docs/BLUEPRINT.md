# CLASSPULSE — HACKATHON MASTER INITIALIZATION PROMPT

You are my hackathon co-pilot for the next 6–8 hours. I'm Manvitha, a CS student (Java, Python, React, REST APIs, SQL, LLM apps). I will build **ClassPulse** from scratch using **Claude Code** in my terminal (Windows + VS Code). Your job is to keep me on scope, hand me paste-ready Claude Code prompts, debug with me, and make sure I ship a deployed, demo-ready product.

Everything you need is in this prompt. Treat it as the single source of truth. If something here conflicts with a "better idea," this prompt wins unless I explicitly change it.

---

## 0. How to work with me

- Be direct and time-efficient. Give practical guidance and real critique, not a menu of options or validation.
- When you give code, give **complete, working files** plus a short plain-English explanation of what each piece does and why.
- When something breaks: **diagnose first** (ask for the exact error, logs, or a command's output), then fix. No guess-and-patch loops.
- Every time I report finishing a step, tell me the **clock status** against the sprint schedule (Section 5) and what to cut if I'm behind.
- Never let me start a new feature until the current one works in the browser.
- Refuse scope creep during the build. Park ideas in a "post-hackathon" list.
- Commit after every working step with a real message (`feat: timeline segments from connection_logs`, not `update`).

---

## 1. ClassPulse in one paragraph

ClassPulse is a **camera-free, privacy-first session reliability and engagement analytics dashboard for instructors** teaching live online classes. It answers three questions in real time: **Who is actually connected? Whose connection is unstable? Who hasn't responded to polls?** It uses only behavioural metadata the meeting platform already records — join/leave events and event *kinds* (poll response, chat, hand raise). It never touches video, audio, faces, or message content, and it never produces an "attention score." Google Gemini (Flash) turns the metrics into plain-language, action-oriented insights for the instructor ("4 students dropped within 4 minutes — likely a network issue, not disengagement; consider pausing").

### Design principles (non-negotiable — these are also the pitch)

1. **No camera or facial analysis, ever.** Webcam "attention detection" is scientifically invalid and invasive. Excluding it is a feature, and we lead with it.
2. **Data minimisation.** Store event type + timestamp only. Chat **text is never stored** — only that a chat happened.
3. **Participation is measured by polls only.** Polls are solicited and universal, so non-response is meaningful. A student is "silent" only if they respond to zero polls. Chat and hand raises reflect personality, not worth — they are shown as neutral **"Live interaction"** counts and are **never scored, ranked, or judged**.
4. **Disconnections are framed as reliability, not behaviour.** Clusters of drops trigger a "likely network/platform issue" alert, not a blame signal.
5. **The LLM never sees student names.** Server-side code sends pseudonyms (S1, S2 …) and aggregated metrics only; names are mapped back in the UI.
6. **All timestamps are `timestamptz` in UTC.** Minute offsets are computed server-side from `started_at`. No local-time strings anywhere in the data path.

---

## 2. Hackathon constraints & scope

### Stack (fixed)

| Layer | Choice |
|---|---|
| App | **Next.js (latest, App Router, TypeScript)** — UI + API route handlers in one repo |
| Styling | **Tailwind CSS** (whatever version `create-next-app` installs) |
| DB + Auth + Live updates | **Supabase** — Postgres, Auth (email/password), Realtime (`postgres_changes`), Row Level Security |
| LLM | **Google Gemini API** via the official Google Gen AI SDK **`@google/genai`** (`import { GoogleGenAI } from "@google/genai"`). Do **not** install `@google/generative-ai` — that is the legacy SDK. Model set by `GEMINI_MODEL` (default `gemini-flash-latest`, which tracks the current Flash model). Structured output via `responseMimeType: "application/json"` + `responseJsonSchema`. Key from Google AI Studio. |
| Hosting | **Vercel** |
| Tests | **Vitest** — for `lib/metrics.ts` only |
| Scripts | `npx tsx scripts/seed.ts` (cross-platform; no bash-only commands) |

### In scope (MVP — must ship)

1. Instructor login (email/password; demo account created by the seed script, no email confirmation flow).
2. Session picker → dashboard for one session.
3. **Stat cards:** Connected now, Unstable connections, Absent, Late joiners, Poll response rate, Silent (0 poll responses).
4. **Alert bar:** 3+ distinct students leave within any 10-minute window → reliability alert.
5. **Connection timeline:** one row per enrolled student, coloured segments (connected / gap / late / left / absent), "now" marker on live sessions.
6. **Participation panel:** poll responses per student (scored), live interactions (neutral count, not ranked).
7. **Real-time updates** via Supabase Realtime (no polling loops).
8. **AI Briefing panel** via Gemini (JSON-schema structured output) with a rules-based fallback if Gemini fails or times out.
9. **Live Class Simulator** (demo mode) that injects realistic events into a live session, including a one-click "network storm."
10. **Post-session report view** (frozen, printable).
11. Deployed on Vercel.

### Out of scope (do not build)

Camera/face/emotion anything · storing chat text · attention scores · student-facing views · multi-tenant org management · email notifications · D3 (the timeline is plain Tailwind divs — faster and no React/D3 DOM fight) · any separate backend server.

### Stretch (only after MVP is deployed and the demo is rehearsed)

Zoom webhook ingestion (`POST /api/webhooks/zoom`) using the same ingest adapter as the simulator. Be honest in the pitch: if it isn't built, say "the ingest adapter is platform-agnostic; Zoom webhooks plug into it."

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # or the project's publishable key
SUPABASE_SERVICE_ROLE_KEY=            # server-only: seed script + simulator
GEMINI_API_KEY=                       # server-only, from Google AI Studio
GEMINI_MODEL=gemini-flash-latest      # or pin a specific current Flash model, e.g. gemini-3.5-flash
NEXT_PUBLIC_DEMO_MODE=true            # shows the simulator panel
DEMO_INSTRUCTOR_EMAIL=demo@classpulse.dev
DEMO_INSTRUCTOR_PASSWORD=             # choose one
```

---

## 3. Domain rules (the product logic — implement exactly)

All times are **minutes from `sessions.started_at`**, rounded to 1 decimal.

| Concept | Rule |
|---|---|
| Enrolled | Students whose `course_code` = session's `course_code` |
| Attended | Has at least one `join` |
| Absent | Enrolled with zero `join`s |
| Late | First join > **3** min after start |
| Drop | A `leave` that is later followed by a `join` (a rejoin) |
| Unstable | `dropCount` ≥ **2** |
| Connected now | Student's most recent connection event is `join` |
| Left early (ended session) | Last event is `leave` with no rejoin before the end |
| Disconnected (live session) | Last event is `leave`; may still come back |
| Poll response rate | total poll responses ÷ (`polls_launched` × attended) × 100, rounded |
| Silent | Attended, `polls_launched` > 0, and zero poll responses |
| Live interactions | chat + hand_raise count — displayed, never scored |
| Reliability alert | Sliding window: any **10**-minute window containing leaves from ≥ **3** distinct students. Overlapping windows merge. Message frames it as a likely network/platform issue. |

Timeline segment types: `connected` (green) · `gap` (red — between a leave and a rejoin, or open-ended on a live session) · `late` (amber — from 0 to first join) · `left` (grey — after final leave on an ended session) · `absent` (light grey hatched — whole row).

Duplicate joins (join while already connected) and orphan leaves (leave while not connected) are ignored.

---

## 4. Technical assets

### 4.1 Supabase SQL schema — run in Supabase SQL Editor

```sql
-- ClassPulse schema. Privacy by design: no video, audio, email, or chat text is stored.

create type public.session_status as enum ('live', 'ended');
create type public.connection_event as enum ('join', 'leave');
create type public.participation_kind as enum ('chat', 'poll_response', 'hand_raise');

-- STUDENTS: roster per course. Display name + optional pseudonymous platform id only.
create table public.students (
  id                      uuid primary key default gen_random_uuid(),
  course_code             text not null,
  display_name            text not null,
  external_participant_id text,            -- e.g. meeting-platform participant id; never an email
  created_at              timestamptz not null default now(),
  unique (course_code, display_name)
);
comment on table public.students is 'Roster only. No emails, photos, or demographic data.';

-- SESSIONS: one live class meeting, owned by an instructor.
create table public.sessions (
  id                  uuid primary key default gen_random_uuid(),
  instructor_id       uuid not null references auth.users(id) on delete cascade,
  course_code         text not null,
  course_name         text,
  external_meeting_id text,
  started_at          timestamptz not null,
  duration_minutes    int not null check (duration_minutes between 5 and 300),
  polls_launched      int not null default 0 check (polls_launched >= 0),
  status              public.session_status not null default 'live',
  created_at          timestamptz not null default now()
);
create index sessions_instructor_idx on public.sessions (instructor_id, started_at desc);

-- CONNECTION LOGS: join/leave only.
create table public.connection_logs (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  event_type  public.connection_event not null,
  occurred_at timestamptz not null,
  source      text not null default 'seed' check (source in ('seed', 'simulator', 'zoom'))
);
create index connection_logs_session_time_idx on public.connection_logs (session_id, occurred_at);
create index connection_logs_session_student_idx on public.connection_logs (session_id, student_id, occurred_at);

-- PARTICIPATION EVENTS: the KIND of interaction only. Chat content is never stored.
create table public.participation_events (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  kind        public.participation_kind not null,
  poll_id     text,                          -- set for poll_response
  occurred_at timestamptz not null,
  source      text not null default 'seed' check (source in ('seed', 'simulator', 'zoom'))
);
create index participation_events_session_idx on public.participation_events (session_id, occurred_at);
comment on table public.participation_events is 'Event kinds only. Message text is intentionally not stored.';

-- ROW LEVEL SECURITY: an instructor sees only their own sessions and those sessions' data.
alter table public.students             enable row level security;
alter table public.sessions             enable row level security;
alter table public.connection_logs      enable row level security;
alter table public.participation_events enable row level security;

create policy "instructor reads own sessions" on public.sessions
  for select to authenticated using (instructor_id = auth.uid());

create policy "instructor reads own roster" on public.students
  for select to authenticated using (
    exists (select 1 from public.sessions s
            where s.course_code = students.course_code and s.instructor_id = auth.uid())
  );

create policy "instructor reads own connection logs" on public.connection_logs
  for select to authenticated using (
    exists (select 1 from public.sessions s
            where s.id = connection_logs.session_id and s.instructor_id = auth.uid())
  );

create policy "instructor reads own participation" on public.participation_events
  for select to authenticated using (
    exists (select 1 from public.sessions s
            where s.id = participation_events.session_id and s.instructor_id = auth.uid())
  );
-- Writes happen only server-side with the service role key (seed, simulator, webhook), which bypasses RLS.

-- REALTIME: broadcast inserts/updates to subscribed dashboards (RLS still applies).
alter publication supabase_realtime add table public.connection_logs, public.participation_events, public.sessions;
```

### 4.2 Deterministic seed scenario (acceptance test data)

Course **CS3003 Software Engineering**, 12 enrolled, one **ended** session: `started_at = 2026-10-05T18:00:00Z`, 75 minutes, `polls_launched = 3` (polls at min 10, 30, 55; responses land 1 minute after each poll).

| Student | Connection events (minutes) | Poll responses | Chats | Hand raises |
|---|---|---|---|---|
| Priya S. | join 0.2 | 3 (min 11, 31, 56) | 2 (12, 40) | 1 (45) |
| James T. | join 1, leave 22, join 25 | 2 (11, 31) | 1 (31) | 0 |
| Aisha M. | join 15, leave 20, join 23 | 1 (31) | 1 (40) | 0 |
| Ravi K. | join 0.75, leave 18, join 21, leave 35, join 39 | 0 | 1 (50) | 0 |
| Soo-Jin L. | join 0.5, leave 19, join 26 | 3 (11, 31, 56) | 2 (12, 28) | 0 |
| Marcus D. | join 0 | 3 (11, 31, 56) | 0 | 0 |
| Elena R. | join 2 | 2 (11, 56) | 0 | 1 (33) |
| Omar F. | join 1, leave 50, join 52, leave 60, join 61, leave 68, join 69 | 1 (56) | 0 | 0 |
| Hannah B. | join 5 | 0 | 0 | 0 |
| Diego P. | join 0, leave 70 | 3 (11, 31, 56) | 0 | 0 |
| Tom K. | join 0 | 2 (31, 56) | 0 | 0 |
| Mei W. | — (absent) | 0 | 0 | 0 |

**Expected outputs (write these as Vitest assertions):**

- Stats: enrolled 12 · connectedNow 10 · unstable 2 (Ravi, Omar) · absent 1 (Mei) · late 2 (Aisha, Hannah) · pollResponseRate 61 (20 ÷ 33) · silent 2 (Ravi, Hannah) · liveInteractions 9
- Drop counts: James 1 · Aisha 1 · Ravi 2 · Soo-Jin 1 · Omar 3 · everyone else 0
- Ravi has 5 segments (connected, gap, connected, gap, connected) · Aisha has late → connected → gap → connected · Diego ends with a `left` segment 70–75 · Mei is a single `absent` segment
- Statuses: Ravi & Omar `unstable` · Aisha & Hannah `late` · Diego `left_early` · Mei `absent` · others `stable`
- Alerts: exactly **1**, startMin 18, endMin 22, affectedCount 4

The seed script also creates the demo instructor (via `supabase.auth.admin.createUser` with `email_confirm: true`) and is idempotent (deletes and recreates the demo data).

### 4.3 `lib/metrics.ts` — pure logic, no I/O

```ts
// lib/metrics.ts
// Pure functions: raw events in, dashboard numbers out. No database, no network.
// All times are minutes from session start. This file is the product's core logic.

export const RULES = {
  LATE_AFTER_MIN: 3,
  UNSTABLE_AT_DROPS: 2,
  ALERT_WINDOW_MIN: 10,
  ALERT_MIN_STUDENTS: 3,
} as const;

export type Student = { id: string; display_name: string };
export type Session = {
  id: string;
  started_at: string; // ISO timestamptz (UTC)
  duration_minutes: number;
  polls_launched: number;
  status: "live" | "ended";
};
export type ConnectionLog = { student_id: string; event_type: "join" | "leave"; occurred_at: string };
export type ParticipationEvent = {
  student_id: string;
  kind: "chat" | "poll_response" | "hand_raise";
  occurred_at: string;
};

export type SegmentType = "connected" | "gap" | "late" | "left" | "absent";
export type Segment = { type: SegmentType; startMin: number; endMin: number };
export type StudentStatus = "stable" | "late" | "unstable" | "left_early" | "disconnected" | "absent";

export type StudentTimeline = {
  studentId: string;
  name: string;
  segments: Segment[];
  dropCount: number;
  firstJoinMin: number | null;
  connected: boolean;
  status: StudentStatus;
  pollResponses: number;
  liveInteractions: number;
};

export type Stats = {
  enrolled: number;
  connectedNow: number;
  unstable: number;
  absent: number;
  late: number;
  pollResponseRate: number | null;
  silent: number;
  liveInteractions: number;
};

export type Alert = { startMin: number; endMin: number; affectedCount: number; message: string };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function minutesSince(startIso: string, iso: string): number {
  return round1((Date.parse(iso) - Date.parse(startIso)) / 60000);
}

/** Right edge of the timeline: full duration if ended, elapsed time if live. */
export function sessionEndMin(session: Session, now: Date = new Date()): number {
  if (session.status === "ended") return session.duration_minutes;
  const elapsed = (now.getTime() - Date.parse(session.started_at)) / 60000;
  return round1(Math.max(0, Math.min(session.duration_minutes, elapsed)));
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function buildTimeline(
  session: Session,
  students: Student[],
  logs: ConnectionLog[],
  events: ParticipationEvent[],
  now: Date = new Date(),
): StudentTimeline[] {
  const endMin = sessionEndMin(session, now);
  const clamp = (m: number) => Math.max(0, Math.min(endMin, m));
  const logsByStudent = groupBy(logs, (l) => l.student_id);
  const eventsByStudent = groupBy(events, (e) => e.student_id);

  return students.map((st) => {
    const evs = (logsByStudent.get(st.id) ?? [])
      .slice()
      .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));

    const segments: Segment[] = [];
    let openAt: number | null = null;
    let lastLeave: number | null = null;
    let firstJoin: number | null = null;
    let drops = 0;

    for (const e of evs) {
      const t = clamp(minutesSince(session.started_at, e.occurred_at));
      if (e.event_type === "join") {
        if (openAt !== null) continue; // duplicate join
        if (firstJoin === null) {
          firstJoin = t;
          if (t > RULES.LATE_AFTER_MIN) segments.push({ type: "late", startMin: 0, endMin: t });
        } else if (lastLeave !== null) {
          segments.push({ type: "gap", startMin: lastLeave, endMin: t });
          drops++;
        }
        openAt = t;
      } else {
        if (openAt === null) continue; // orphan leave
        segments.push({ type: "connected", startMin: openAt, endMin: t });
        openAt = null;
        lastLeave = t;
      }
    }

    const connected = openAt !== null;
    if (openAt !== null) {
      segments.push({ type: "connected", startMin: openAt, endMin });
    } else if (firstJoin !== null && lastLeave !== null && lastLeave < endMin) {
      segments.push({ type: session.status === "live" ? "gap" : "left", startMin: lastLeave, endMin });
    }
    if (firstJoin === null) segments.push({ type: "absent", startMin: 0, endMin });

    const status: StudentStatus =
      firstJoin === null
        ? "absent"
        : drops >= RULES.UNSTABLE_AT_DROPS
          ? "unstable"
          : !connected
            ? session.status === "live" ? "disconnected" : "left_early"
            : firstJoin > RULES.LATE_AFTER_MIN
              ? "late"
              : "stable";

    const pe = eventsByStudent.get(st.id) ?? [];
    return {
      studentId: st.id,
      name: st.display_name,
      segments,
      dropCount: drops,
      firstJoinMin: firstJoin,
      connected,
      status,
      pollResponses: pe.filter((e) => e.kind === "poll_response").length,
      liveInteractions: pe.filter((e) => e.kind !== "poll_response").length,
    };
  });
}

export function computeStats(session: Session, timeline: StudentTimeline[]): Stats {
  const attended = timeline.filter((s) => s.firstJoinMin !== null);
  const totalPoll = attended.reduce((n, s) => n + s.pollResponses, 0);
  const possible = session.polls_launched * attended.length;
  return {
    enrolled: timeline.length,
    connectedNow: timeline.filter((s) => s.connected).length,
    unstable: timeline.filter((s) => s.dropCount >= RULES.UNSTABLE_AT_DROPS).length,
    absent: timeline.length - attended.length,
    late: attended.filter((s) => (s.firstJoinMin ?? 0) > RULES.LATE_AFTER_MIN).length,
    pollResponseRate: possible > 0 ? Math.round((totalPoll / possible) * 100) : null,
    silent: session.polls_launched > 0 ? attended.filter((s) => s.pollResponses === 0).length : 0,
    liveInteractions: timeline.reduce((n, s) => n + s.liveInteractions, 0),
  };
}

export function detectAlerts(session: Session, logs: ConnectionLog[]): Alert[] {
  const leaves = logs
    .filter((l) => l.event_type === "leave")
    .map((l) => ({ id: l.student_id, t: minutesSince(session.started_at, l.occurred_at) }))
    .sort((a, b) => a.t - b.t);

  const clusters: { startMin: number; endMin: number; ids: Set<string> }[] = [];
  for (const { t: start } of leaves) {
    const inWindow = leaves.filter((l) => l.t >= start && l.t <= start + RULES.ALERT_WINDOW_MIN);
    const ids = new Set(inWindow.map((l) => l.id));
    if (ids.size < RULES.ALERT_MIN_STUDENTS) continue;
    const lastLeaveT = Math.max(...inWindow.map((l) => l.t));
    const prev = clusters[clusters.length - 1];
    if (prev && start <= prev.endMin) {
      prev.endMin = Math.max(prev.endMin, lastLeaveT);
      ids.forEach((id) => prev.ids.add(id));
    } else {
      clusters.push({ startMin: start, endMin: lastLeaveT, ids });
    }
  }

  return clusters.map((c) => ({
    startMin: c.startMin,
    endMin: c.endMin,
    affectedCount: c.ids.size,
    message: `${c.ids.size} students disconnected between minute ${Math.floor(c.startMin)} and ${Math.ceil(
      c.endMin,
    )}. This pattern usually means a network or platform issue, not disengagement.`,
  }));
}
```

### 4.4 Supabase clients

```ts
// lib/supabase/server.ts — per-request client that acts as the logged-in instructor (RLS applies)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: safe to ignore when middleware refreshes sessions.
          }
        },
      },
    },
  );
}
```

```ts
// lib/supabase/admin.ts — service-role client. Server-only: seed, simulator, webhooks. Bypasses RLS.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

(Browser client in `lib/supabase/client.ts` uses `createBrowserClient` from `@supabase/ssr` with the same URL + anon key.)

### 4.5 Data loader + dashboard route

```ts
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
    supabase.from("participation_events").select("student_id, kind, occurred_at").eq("session_id", sessionId),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (logsRes.error) throw logsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  return { session, students: studentsRes.data, logs: logsRes.data, events: eventsRes.data };
}
```

```ts
// app/api/sessions/[id]/dashboard/route.ts — one endpoint returns everything the dashboard renders
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadSessionData } from "@/lib/data";
import { buildTimeline, computeStats, detectAlerts, sessionEndMin } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await loadSessionData(supabase, id);
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const now = new Date();
  const timeline = buildTimeline(data.session, data.students, data.logs, data.events, now);
  return NextResponse.json({
    session: data.session,
    elapsedMin: sessionEndMin(data.session, now),
    stats: computeStats(data.session, timeline),
    alerts: detectAlerts(data.session, data.logs),
    timeline,
    generatedAt: now.toISOString(),
  });
}
```

### 4.6 Gemini client + AI briefing route

```ts
// lib/gemini.ts — lazy so a missing key never breaks `next build`
import "server-only";
import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;
export function getGemini(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
```

```ts
// app/api/gemini-summary/route.ts
// POST { sessionId } → structured instructor briefing.
// Metrics are computed server-side; ONLY pseudonymised aggregates go to Gemini; names are mapped back here.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadSessionData } from "@/lib/data";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini";
import {
  buildTimeline, computeStats, detectAlerts, sessionEndMin,
  type Alert, type Stats, type StudentTimeline,
} from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Briefing = { headline: string; insights: string[]; suggestedActions: string[] };

// Gemini native structured output: the model must return an object matching this JSON Schema.
const BRIEFING_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One-line briefing for the instructor, max 15 words." },
    insights: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "Observations about connection reliability and poll responses.",
    },
    suggestedActions: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "Concrete actions the instructor can take right now.",
    },
  },
  required: ["headline", "insights", "suggestedActions"],
};

const SYSTEM_INSTRUCTION = `You are ClassPulse, an assistant that briefs an instructor on live online class reliability.
You receive ONLY aggregated, pseudonymised metrics (students are labelled S1, S2, ...).
Hard rules:
- Never infer attention, emotion, intent, motivation, or character. You have no video or message content.
- Disconnection clusters are reliability issues (network/platform), not behaviour.
- Participation is measured ONLY by poll responses. Chat and hand raises are neutral "live interaction" counts; never praise or criticise a student for them.
- Be concrete, brief, and kind. Suggest actions an instructor can take right now (pause, repost a poll, check in privately, share the slides link).
- Refer to students only by their S-labels.`;

function ruleBasedBriefing(stats: Stats, alerts: Alert[], timeline: StudentTimeline[]): Briefing {
  const unstable = timeline.filter((s) => s.status === "unstable").map((s) => s.name);
  const silent = timeline.filter((s) => s.firstJoinMin !== null && s.pollResponses === 0).map((s) => s.name);
  const insights: string[] = [];
  if (alerts.length) insights.push(alerts[alerts.length - 1].message);
  if (unstable.length) insights.push(`Unstable connections: ${unstable.join(", ")}.`);
  if (stats.pollResponseRate !== null) insights.push(`Poll response rate is ${stats.pollResponseRate}%.`);
  return {
    headline: alerts.length
      ? "Connection issue detected in this session"
      : `${stats.connectedNow} of ${stats.enrolled} students connected`,
    insights,
    suggestedActions: [
      ...(alerts.length ? ["Pause briefly and ask if anyone lost audio or video."] : []),
      ...(silent.length ? [`Repost the last poll; ${silent.length} student(s) haven't responded yet.`] : []),
      ...(unstable.length ? ["Share the slides link so students with unstable connections can follow along."] : []),
    ].slice(0, 3),
  };
}

export async function POST(req: Request) {
  let sessionId: unknown;
  try {
    ({ sessionId } = await req.json());
  } catch {
    /* handled below */
  }
  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "Body must be { sessionId: string }" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS guarantees this only returns a session the logged-in instructor owns.
  const data = await loadSessionData(supabase, sessionId);
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const now = new Date();
  const timeline = buildTimeline(data.session, data.students, data.logs, data.events, now);
  const stats = computeStats(data.session, timeline);
  const alerts = detectAlerts(data.session, data.logs);

  // Pseudonymise: Gemini never sees names.
  const labelToName = new Map(timeline.map((s, i) => [`S${i + 1}`, s.name]));
  const payload = {
    sessionStatus: data.session.status,
    elapsedMinutes: sessionEndMin(data.session, now),
    durationMinutes: data.session.duration_minutes,
    pollsLaunched: data.session.polls_launched,
    stats,
    alerts: alerts.map(({ startMin, endMin, affectedCount }) => ({ startMin, endMin, affectedCount })),
    students: timeline.map((s, i) => ({
      label: `S${i + 1}`,
      status: s.status,
      dropCount: s.dropCount,
      firstJoinMin: s.firstJoinMin,
      pollResponses: s.pollResponses,
    })),
  };
  const unmask = (text: string) => text.replace(/\bS(\d+)\b/g, (m) => labelToName.get(m) ?? m);

  const t0 = Date.now();
  try {
    const response = await getGemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: JSON.stringify(payload),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: BRIEFING_SCHEMA,
        httpOptions: { timeout: 8000 },
      },
    });
    const raw = JSON.parse(response.text ?? "{}") as Partial<Briefing>;
    const briefing: Briefing = {
      headline: unmask(String(raw.headline ?? "")),
      insights: (raw.insights ?? []).slice(0, 3).map((x) => unmask(String(x))),
      suggestedActions: (raw.suggestedActions ?? []).slice(0, 3).map((x) => unmask(String(x))),
    };
    if (!briefing.headline) throw new Error("Empty model output");
    return NextResponse.json({ source: "gemini", model: GEMINI_MODEL, latencyMs: Date.now() - t0, ...briefing });
  } catch (err) {
    console.error("Gemini briefing failed, using rules fallback:", err);
    return NextResponse.json({
      source: "rules",
      model: null,
      latencyMs: Date.now() - t0,
      ...ruleBasedBriefing(stats, alerts, timeline),
    });
  }
}
```

Notes for the implementer:
- `responseMimeType` + `responseJsonSchema` is Gemini's native structured-output mode: the response text is guaranteed-shape JSON, so the route parses it directly with no regex cleanup. We still validate and cap array lengths because the dashboard should never trust external output blindly.
- The Gen AI SDK evolves quickly. If `npx tsc --noEmit` rejects a config field name, check the installed SDK's type definitions (`node_modules/@google/genai`) and adapt the field — do not downgrade the SDK or switch to `@google/generative-ai`.
- Gemini 3.x Flash models think at a medium level by default. If the latency badge shows more than ~2 s, set the SDK's thinking level to its lowest supported value for the resolved model (verify the exact field in the installed types first).
- No `temperature` is set: newer Gemini models recommend leaving sampling parameters at their defaults.

### 4.7 Target file structure

```
classpulse/
├─ CLAUDE.md                       # project rules for Claude Code (generated in Prompt 0)
├─ docs/BLUEPRINT.md               # this master prompt, pasted verbatim
├─ supabase/schema.sql
├─ scripts/seed.ts
├─ lib/
│  ├─ metrics.ts  metrics.test.ts  data.ts  gemini.ts  ingest.ts
│  └─ supabase/ server.ts  client.ts  admin.ts
├─ middleware.ts                   # refresh auth session, protect /sessions/*
├─ app/
│  ├─ login/page.tsx
│  ├─ sessions/page.tsx            # session picker
│  ├─ sessions/[id]/page.tsx       # live dashboard
│  ├─ sessions/[id]/report/page.tsx
│  └─ api/
│     ├─ gemini-summary/route.ts     # POST { sessionId } → structured AI briefing
│     └─ sessions/[id]/ dashboard/route.ts  simulate/route.ts
└─ components/ StatCards.tsx  AlertBar.tsx  Timeline.tsx  ParticipationPanel.tsx
               BriefingPanel.tsx  SimulatorPanel.tsx  LiveBadge.tsx  useSessionRealtime.ts
```

---

## 5. Sprint schedule — 6 hours core + 2 hours buffer

Rule: **deploy to Vercel in the first hour**, not the last. Late deploy surprises kill hackathon demos.

### Milestone 1 (0:00–2:00) — Foundation: data in, numbers out
- 0:00–0:15 Create Supabase project, Gemini API key (Google AI Studio), Vercel account. Paste this blueprint into `docs/BLUEPRINT.md`. Run **Prompt 0**.
- 0:15–0:40 **Prompt 1** scaffold → push to GitHub → import to Vercel → deployed "hello" page.
- 0:40–1:00 Run schema SQL in Supabase. **Prompt 2** clients + env.
- 1:00–1:35 **Prompt 3** metrics + tests. All seed assertions green.
- 1:35–2:00 **Prompt 4** seed script. Verify rows in Supabase Table Editor.
- ✅ Exit check: `npm test` green; seed data visible; Vercel URL live.

### Milestone 2 (2:00–4:00) — The dashboard, live
- 2:00–2:20 **Prompt 5** auth + middleware + login page.
- 2:20–2:40 **Prompt 6** dashboard route + session picker. `curl`/browser returns the expected stats JSON.
- 2:40–3:30 **Prompt 7** dashboard UI (cards, alert, timeline, participation).
- 3:30–4:00 **Prompt 8** Realtime hook.
- ✅ Exit check: logged-in dashboard shows exactly the seed numbers; inserting a row in Supabase updates the page without refresh.

### Milestone 3 (4:00–6:00) — Wow factor + ship
- 4:00–4:45 **Prompt 9** simulator + ingest adapter + live demo session.
- 4:45–5:20 **Prompt 10** Gemini briefing route + panel with latency badge.
- 5:20–5:40 **Prompt 11** report view + print CSS.
- 5:40–6:00 **Prompt 12** production deploy + smoke test.
- ✅ Exit check: on the Vercel URL, "Start live demo" → "Network storm" → alert appears live and the Gemini briefing updates within a couple of seconds.

### Buffer (6:00–8:00)
- 6:00–6:30 Bug fixes from the smoke test. Mobile check (stat cards 2×2, timeline scrolls horizontally).
- 6:30–7:00 README (what it is, privacy-by-design section, architecture, setup) + screenshots + record a backup demo video.
- 7:00–7:30 Rehearse the 3-minute demo twice with a timer.
- 7:30–8:00 Stretch only if everything above is done: **Prompt 13** (Zoom webhook).

**Cut order if behind:** report view → session picker (hardcode demo session) → auth (keep RLS off only as a last resort, and say so) → never cut realtime, simulator, or insights — they're the demo.

---

## 6. Claude Code CLI prompts (paste in order)

Run `claude` from the repo root. Each prompt ends with a verification step — don't move on until it passes.

**Prompt 0 — Project memory**
```
Read docs/BLUEPRINT.md fully. Create CLAUDE.md at the repo root summarising: the product in 3 sentences, the 6 design principles, the fixed stack, the in-scope/out-of-scope lists, the domain rules table, the target file structure, and these working rules: TypeScript strict; never store chat text or any video/audio; the LLM never receives student names; all timestamps timestamptz UTC; business logic lives only in lib/metrics.ts; commit after each working step with a descriptive message; I'm on Windows, so use cross-platform npm scripts only. Keep CLAUDE.md under 120 lines. Do not write any app code yet.
```

**Prompt 1 — Scaffold**
```
Scaffold a Next.js app in the current directory using create-next-app with TypeScript, Tailwind, ESLint, App Router, no src directory, import alias @/*. Install: @supabase/supabase-js @supabase/ssr @google/genai server-only (do NOT install @google/generative-ai). Dev deps: vitest tsx dotenv. Add npm scripts: "test": "vitest run", "seed": "tsx scripts/seed.ts". Create .env.example with exactly the variables listed in docs/BLUEPRINT.md section 2 and make sure .env.local is gitignored. Replace the home page with a minimal "ClassPulse" landing page (title, one-line privacy-first tagline, "Instructor login" link to /login). Run npm run build and fix any errors. Commit.
```

**Prompt 2 — Supabase wiring**
```
Create supabase/schema.sql with the schema from docs/BLUEPRINT.md section 4.1 verbatim. Create lib/supabase/server.ts and lib/supabase/admin.ts exactly as in section 4.4, and lib/supabase/client.ts using createBrowserClient from @supabase/ssr. Create lib/data.ts exactly as in section 4.5. Run npm run build. Commit.
```

**Prompt 3 — Core metrics + tests**
```
Create lib/metrics.ts exactly as in docs/BLUEPRINT.md section 4.3. Then create lib/metrics.test.ts that builds the seed scenario from section 4.2 in memory (fixed started_at 2026-10-05T18:00:00Z, minute offsets converted to ISO timestamps, fake student ids) and asserts every "Expected outputs" bullet: stats, drop counts, Ravi's 5 segments, Aisha's segment sequence, Diego's final left segment, Mei absent, statuses, and exactly one alert (startMin 18, endMin 22, affectedCount 4). Add one extra test: a live session with a student whose last event is a leave has status "disconnected" and a trailing "gap" segment. Run npm test. If a test fails, show me the failing assertion and your diagnosis before changing metrics.ts — the expected values are the spec.
```

**Prompt 4 — Seed script**
```
Create scripts/seed.ts (load env with dotenv from .env.local, use the service-role key). It must be idempotent: find or create the demo instructor with supabase.auth.admin.createUser({ email, password, email_confirm: true }) using DEMO_INSTRUCTOR_EMAIL/PASSWORD; delete that instructor's existing sessions (cascades) and all CS3003 students; insert the 12 students and the ended session from docs/BLUEPRINT.md section 4.2 with every connection log and participation event (poll_id "poll-1"/"poll-2"/"poll-3" for responses to the polls at min 10/30/55, source "seed"). Print a summary: counts per table and the session id. Run npm run seed twice to prove idempotency. Commit.
```

**Prompt 5 — Auth**
```
Add email/password auth with Supabase. Create app/login/page.tsx (clean Tailwind card, email + password, error message, submit via a server action or the browser client), a sign-out button component, and middleware.ts that refreshes the Supabase session on every request and redirects unauthenticated users from /sessions/* to /login. After login redirect to /sessions. Verify I can log in with the demo credentials locally. Commit.
```

**Prompt 6 — Dashboard API + session picker**
```
Create app/api/sessions/[id]/dashboard/route.ts exactly as in docs/BLUEPRINT.md section 4.5. Create app/sessions/page.tsx: server component listing the instructor's sessions (course code, name, date, status badge) newest first, each linking to /sessions/[id]. Verify by visiting /api/sessions/<seed id>/dashboard while logged in: the stats must match section 4.2 exactly (connectedNow 10, unstable 2, absent 1, late 2, pollResponseRate 61, silent 2). Show me the JSON. Commit.
```

**Prompt 7 — Dashboard UI**
```
Build app/sessions/[id]/page.tsx as a client dashboard that fetches /api/sessions/[id]/dashboard. Components, all Tailwind, light theme, max-w-6xl, generous spacing:
- StatCards: 6 cards (Connected now "x / enrolled", Unstable, Absent, Late, Poll response rate, Silent). grid-cols-2 on mobile, 3 on md, 6 on xl.
- AlertBar: amber bar per alert with its message; renders nothing when there are none.
- Timeline: one row per student (name column 140px, truncate with ellipsis), bar track = session duration, segments absolutely positioned with left/width in % of duration. Colours: connected green-500, gap red-500, late amber-400, left slate-300, absent slate-200 with a striped pattern. Tooltip (title attr) with type and minute range. X-axis ticks every 15 min. On live sessions draw a vertical "now" line at elapsedMin. Wrap in overflow-x-auto with min-width 640px. Row status chip (unstable, late, left early, disconnected, absent).
- ParticipationPanel: two columns. "Poll responses" — per-student bar of responses / polls_launched, sorted descending. "Live interaction" — neutral grey counts with a one-line note "Shown for context, not scored." Do NOT rank or colour-code live interaction.
- Header: course code + name, date, LiveBadge (pulsing green dot) when status is live, "Ended" grey badge otherwise, link to report.
No D3, no chart libraries. Verify the seed session renders and matches the expected numbers. Commit.
```

**Prompt 8 — Realtime**
```
Create components/useSessionRealtime.ts: a hook that subscribes via the Supabase browser client to postgres_changes INSERT on connection_logs and participation_events filtered by session_id=eq.<id>, and UPDATE on sessions filtered by id=eq.<id>. On any change, refetch the dashboard route, debounced 400ms. For live sessions also re-render every 15s so the "now" line moves. Show "Updated Xs ago" in the header. Clean up the channel on unmount. Verify: insert a leave row for a seed student in the Supabase SQL editor and the page updates without refresh. Commit.
```

**Prompt 9 — Ingest adapter + Live Class Simulator**
```
Create lib/ingest.ts exporting ingestConnection({sessionId, studentId, type, occurredAt, source}) and ingestParticipation({sessionId, studentId, kind, pollId?, occurredAt, source}) using the admin client — the single write path for simulator and any future platform webhook. Create app/api/sessions/[id]/simulate/route.ts (POST, requires logged-in user who owns the session, and NEXT_PUBLIC_DEMO_MODE=true) with actions:
- "start_live_demo" (session id param ignored; creates a NEW live CS3003 session for this instructor with started_at = now minus 25 minutes, duration 75, and backfills plausible history for minutes 0–25: 10 students join in the first 4 minutes, 1 late at minute 9, 1 absent, one poll at minute 10 with ~70% responses, a few chats). Returns the new session id.
- "tick": one random realistic event (weighted: 50% chat/hand raise, 30% leave-then-rejoin a few seconds later for a random connected student, 20% nothing).
- "network_storm": 4 different connected students leave within ~3 seconds; each rejoins 15–25 seconds later (use setTimeout-free approach: write the leaves now, and the rejoins with occurred_at in the future is NOT allowed — instead return and let the client call "recover" after 20s).
- "recover": rejoin every currently disconnected student.
- "launch_poll": increment polls_launched and, over the response, insert poll responses for ~65% of connected students.
- "end_session": set status 'ended'.
Create components/SimulatorPanel.tsx (only rendered when NEXT_PUBLIC_DEMO_MODE=true): buttons for each action, "Auto tick" toggle (every 3s), and "Network storm" auto-calls "recover" after 20s. Add a "Start live demo" button on /sessions that navigates to the new session. Verify the storm triggers the alert bar live. Commit.
```

**Prompt 10 — Gemini briefing**
```
Create lib/gemini.ts and app/api/gemini-summary/route.ts exactly as in docs/BLUEPRINT.md section 4.6, using the official @google/genai SDK (GoogleGenAI, models.generateContent, config.responseMimeType "application/json" + config.responseJsonSchema). Run npx tsc --noEmit; if any config field is rejected, read the installed SDK's type definitions and adapt — do not switch SDKs. Create components/BriefingPanel.tsx: "AI briefing" card that POSTs { sessionId } to /api/gemini-summary, with a Refresh button; shows headline, insights list, suggested actions, and a small badge "Gemini · <model> · <latencyMs> ms" or "Rules fallback" when source is rules; footnote "Names are never sent to the AI model." Add it to the dashboard. On live sessions auto-refresh the briefing when a new alert appears (not on every event — respect free-tier rate limits). Verify: (1) with a real GEMINI_API_KEY the badge says Gemini and shows latency — tell me the number; if it's above ~2 s, check whether the resolved model supports a lower thinking level and set it; (2) temporarily set GEMINI_API_KEY to an invalid value, confirm the fallback renders, then restore it. Commit.
```

**Prompt 11 — Report view**
```
Create app/sessions/[id]/report/page.tsx: same components as the dashboard but static (no realtime, no simulator, no now-line), a grey "Session ended — report" banner, the Gemini briefing generated once on load, and an "Export PDF" button calling window.print(). Add print CSS: hide nav/buttons, white background, avoid breaking timeline rows across pages. Commit.
```

**Prompt 12 — Production deploy + smoke test**
```
Prepare for Vercel production: list every env var I must set in the Vercel dashboard (mark which are server-only), confirm SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY are never imported into client components (grep and show me), run npm run build and npm test locally, then give me a 10-step smoke test to run on the deployed URL covering login, seed session numbers, live demo start, network storm → alert, Gemini briefing latency and fallback, report print preview, and mobile width 390px. Also write README.md: what it is, privacy by design (the 6 principles), architecture (Next.js ↔ Supabase Postgres/Auth/Realtime ↔ Google Gemini API with JSON-schema structured output, ingest adapter), setup steps, env vars, and a "What we deliberately did not build" section. Commit.
```

**Prompt 13 — STRETCH: Zoom webhook**
```
Only proceed if I confirm the MVP is deployed and the demo is rehearsed. Create app/api/webhooks/zoom/route.ts (runtime nodejs). Read the raw body. Handle "endpoint.url_validation" by returning {plainToken, encryptedToken} where encryptedToken = HMAC-SHA256 hex of plainToken with ZOOM_WEBHOOK_SECRET_TOKEN. For all other events verify the x-zm-signature header: "v0=" + HMAC-SHA256 hex of `v0:${x-zm-request-timestamp}:${rawBody}`; reject mismatches with 401 using a timing-safe compare. Map meeting.participant_joined / meeting.participant_left to ingestConnection: find the session by external_meeting_id = payload.object.id and status live; match the student by external_participant_id, falling back to display_name within the course; ignore unknown participants (log only, never create students from webhook data). Respond 200 within 3 seconds. Add a Vitest test for the validation HMAC. Commit.
```

---

## 7. Three-minute demo script

**Setup before walking up:** logged in on the deployed URL, seed report open in one tab, live demo session freshly started in another, Gemini warmed with one briefing call (cold first calls are slower), backup video ready.

**0:00–0:20 — Hook.** "Every online instructor has asked 'are you still there?' into a grid of black squares. The tools that try to answer it use webcams and 'attention scores.' That's invasive, and the science says webcam attention detection doesn't work. So we built the opposite."

**0:20–0:45 — What it is.** "ClassPulse is a camera-free session reliability dashboard. It uses only metadata the meeting platform already records: who joined, who left, and that a poll response happened. No video, no audio, no chat text stored. And when we use Google Gemini to brief the instructor, Gemini never sees a student's name."

**0:45–1:50 — Live demo (the core).**
1. Point at the stat cards and timeline: "Green is connected, red is a gap, amber is a late join. Ravi dropped twice — that's an unstable connection, not a disengaged student."
2. Click **Network storm.** Four rows turn red live, the alert bar appears: "Four students dropped within a minute — ClassPulse calls it what it is: a network issue. The instructor knows to pause, not to scold."
3. Click **Refresh briefing.** Point at the badge: "That's Gemini Flash — the latency is right there on screen. We use Gemini's native structured JSON output, so the response lands as a typed object that renders straight into the dashboard: headline, observations, actions. No parsing hacks, no prompt-and-pray. And it only ever received pseudonyms — S1, S7 — we map names back on our server."
4. Students rejoin automatically; gaps close on the timeline.

**1:50–2:20 — The participation decision.** "We only score polls — they're asked of everyone, so silence there is meaningful. Chat and hand raises are shown for context but never ranked, because talking more isn't the same as learning more." Flash the report view and Export PDF.

**2:20–2:45 — Architecture.** "Next.js on Vercel, Supabase Postgres with row-level security so instructors only see their own classes, Supabase Realtime for instant updates, and the Google Gemini API for low-latency, schema-enforced instructor briefings — with a rules fallback so the dashboard never depends on a network call. Every event flows through one ingest adapter — our simulator uses it today, and a Zoom webhook plugs into the same path." (Only say "Zoom is connected" if Prompt 13 is actually live.)

**2:45–3:00 — Close.** "Real-time data, a Gemini briefing in seconds, and zero surveillance. ClassPulse gives instructors the one thing they actually need in the moment — who's really there — without surveilling a single student. Privacy isn't a constraint we worked around; it's the product."

**Likely judge questions — prep answers:**
- *Why not use the camera?* Invalid science, bias risk, privacy law exposure, and students turn cameras off for bandwidth — the exact population we're trying to help.
- *Is this real Zoom data?* Be precise about what's built: simulator + platform-agnostic ingest adapter (+ webhook if completed).
- *Could this be misused to punish students?* No per-student engagement score exists; drops are framed as reliability; chat is never judged; data is minimal and cascades on session delete.
- *Why Gemini?* The briefing has to land while class is still happening, so we need a fast Flash model, and it has to render into UI components reliably, so we need structured output. Gemini's `responseJsonSchema` gives us both; the rules fallback covers outages.
- *What exactly does Gemini see?* Show the payload: statuses, drop counts, poll counts, alert windows, S-labels. No names, no chat, no media.

---

## 8. Your first reply to me

Reply with: (1) a 3-line confirmation of the product and scope, (2) the checklist of accounts/keys I need before starting the clock, and (3) Prompt 0 ready to paste. Then wait for me to report progress.

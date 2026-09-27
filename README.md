# ClassPulse

**Camera-free, privacy-first session reliability for live online classes.**

ClassPulse is a real-time dashboard for instructors teaching live online classes. It answers three questions while the class is happening:

1. **Who is actually connected?**
2. **Whose connection is unstable?**
3. **Who hasn't responded to polls?**

It uses only metadata the meeting platform already records: join/leave events and the *kind* of interaction (poll response, chat, hand raise). It never touches video, audio, faces or message content, and it never produces an "attention score". Google Gemini turns the metrics into a short, action-oriented briefing ("4 students dropped within 4 minutes, likely a network issue; consider pausing"), with a rules-based fallback so the dashboard never depends on a network call.

**Live demo:** https://class-pulse-hack-nite.vercel.app

---

## Privacy by design

These six rules are enforced in the code, not just the pitch:

| # | Principle | How it's enforced |
|---|---|---|
| 1 | **No camera or facial analysis, ever.** | There is no media pipeline. The schema has no column that could hold video, audio or images. |
| 2 | **Data minimisation.** | Only event type + timestamp are stored. `participation_events` has no text column, so chat *content* cannot be stored. |
| 3 | **Participation is measured by polls only.** | "Silent" means attended and zero poll responses. Chats and hand raises are shown as neutral "Live interaction" counts, in roster order, never scored, ranked or colour-coded. |
| 4 | **Disconnections are reliability, not behaviour.** | 3+ students leaving within 10 minutes raises a "likely network or platform issue" alert, never a blame signal. |
| 5 | **The LLM never sees student names.** | The server sends Gemini pseudonyms (`S1`, `S2`, …) and aggregates only, then maps names back before responding. Absent students are sent with `pollResponses: null` so they're never framed as non-responders. |
| 6 | **All timestamps are UTC `timestamptz`.** | Minute offsets are computed server-side from `sessions.started_at`. Dates are displayed in UTC. |

Row Level Security means an instructor can only read their own sessions and those sessions' events. Every write goes through server code with the service-role key; there are no client-side writes.

---

## Architecture

```
Browser (instructor)                     Vercel (Next.js 16, App Router)                 Services
─────────────────────                    ─────────────────────────────────               ─────────────────────────
Dashboard / report pages  ──fetch──▶     proxy.ts (session refresh, /sessions guard)
                                         GET  /api/sessions/[id]/dashboard ──RLS──▶      Supabase Postgres + Auth
                                         POST /api/gemini-summary ──S-labels only──▶     Google Gemini API
                                         POST /api/sessions/[id]/simulate                  (JSON-schema output)
                                              └─▶ lib/ingest.ts ──service role──▶        Supabase Postgres
useSessionRealtime  ◀── postgres_changes (RLS-scoped) ───────────────────────────────    Supabase Realtime
```

- **`lib/metrics.ts`**: all product logic as pure functions: timelines, stats and reliability alerts. It's covered by `lib/metrics.test.ts` against a deterministic 12-student scenario.
- **`lib/ingest.ts`**: the single write path for events. The simulator uses it today, and a platform webhook (e.g. Zoom `participant_joined/left`) plugs into the same functions.
- **Realtime**: the dashboard subscribes to inserts on `connection_logs`/`participation_events` and updates to its session row, then refetches, debounced. There are no polling loops.
- **Gemini**: `@google/genai` with `responseMimeType: "application/json"` and `responseJsonSchema`, so the briefing arrives as a typed object that renders directly. There's an 8 s cutoff, and any error falls back to a rules-based briefing, labelled in the UI.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime, RLS) · Google Gemini (`@google/genai`) · Vitest · Vercel.

---

## Setup

Requirements: Node 20+ (tested on Node 24), a Supabase project, and a Gemini API key from Google AI Studio. All commands work in PowerShell, cmd or bash.

1. **Install**
   ```
   npm install
   ```
2. **Database:** in the Supabase SQL Editor, run `supabase/schema.sql`. It creates the tables, RLS policies and the Realtime publication.
3. **Environment:** copy `.env.example` to `.env.local` and fill it in (see below).
4. **Seed demo data.** This creates the demo instructor and the CS3003 scenario. It's idempotent and safe to re-run.
   ```
   npm run seed
   ```
5. **Run**
   ```
   npm run dev
   ```
   Open http://localhost:3000 and sign in with `DEMO_INSTRUCTOR_EMAIL` / `DEMO_INSTRUCTOR_PASSWORD`.

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest suite for `lib/metrics.ts` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Recreate the demo instructor's data |

### Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon/publishable key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Seed script, simulator and ingest writes. Bypasses RLS. |
| `GEMINI_API_KEY` | **server-only** | Google AI Studio key |
| `GEMINI_MODEL` | server | Model id. `gemini-flash-lite-latest` measured ~1 s per briefing, against 3–6 s for `gemini-flash-latest`. |
| `NEXT_PUBLIC_DEMO_MODE` | public | `true` shows the Live Class Simulator. It's inlined at build time. |
| `DEMO_INSTRUCTOR_EMAIL` | server (seed) | Demo login email |
| `DEMO_INSTRUCTOR_PASSWORD` | server (seed) | Demo login password |

Server-only keys are read only in `lib/supabase/admin.ts`, `lib/gemini.ts` (both `import "server-only"`) and `scripts/seed.ts`. On Vercel, set all eight under Project → Settings → Environment Variables, and redeploy after changing any of them.

---

## Demo flow

1. `/sessions` → open the ended **CS3003** session: 10/12 connected, 2 unstable (Ravi, Omar), 1 absent, 61% poll response rate, and one reliability alert at minutes 18–22.
2. **Start live demo** creates a live session 25 minutes in.
3. **Network storm**: four rows turn red and the alert appears live. The students auto-recover after 20 s.
4. **AI briefing** shows a badge with the model and latency, e.g. "Gemini · gemini-flash-lite-latest · ~1000 ms".
5. **Report** → **Export PDF** for the frozen, printable post-session view.

---

## What we deliberately did not build

- **Camera, face or emotion analysis of any kind.** Webcam "attention detection" is scientifically invalid and invasive. Students often turn cameras off for bandwidth, and they're exactly the students this is meant to help.
- **Attention or engagement scores.** No per-student score exists. Chat and hand raises are never ranked.
- **Storing chat text.** Only the fact that a chat happened is recorded.
- **Student-facing views, multi-tenant org management, email notifications.**
- **Chart libraries / D3.** The timeline is plain positioned `div`s.
- **A separate backend server.** API route handlers in the same Next.js app are enough.
- **Zoom integration (not built yet).** The ingest adapter is platform-agnostic, so a Zoom webhook would call the same `ingestConnection`/`ingestParticipation` functions the simulator uses.

@AGENTS.md

# ClassPulse — project rules

Source of truth: `docs/BLUEPRINT.md` (its Errata section, if present, overrides everything above it).

## Product
ClassPulse is a camera-free, privacy-first session reliability and engagement analytics dashboard for instructors teaching live online classes. It answers three questions in real time — who is actually connected, whose connection is unstable, and who hasn't responded to polls — using only behavioural metadata the meeting platform already records (join/leave events and event *kinds*: poll response, chat, hand raise). It never touches video, audio, faces, or message content and never produces an "attention score". Google Gemini (Flash) turns the metrics into plain-language, action-oriented insights, with a rules-based fallback.

## Design principles (non-negotiable)
1. **No camera** or facial analysis, ever.
2. **Data minimisation:** store event type + timestamp only. Chat text is never stored.
3. **Polls-only participation:** "silent" = attended and zero poll responses. Chat/hand raises are neutral "Live interaction" counts — never scored, ranked, or judged.
4. **Drops = reliability:** disconnect clusters raise a "likely network/platform issue" alert, never a blame signal.
5. **LLM never sees names:** only pseudonyms (S1, S2…) + aggregates go to Gemini; names are mapped back server-side.
6. **UTC `timestamptz` only:** minute offsets computed server-side from `started_at`; no local-time strings in the data path.

## Stack (fixed)
- Next.js 16.3.6 (App Router, TypeScript strict), React 19.2.8, TypeScript 5.9.3, ESLint 9.
- Tailwind CSS 4.3.3 via `@tailwindcss/postcss`.
- Next.js 16: auth/session refresh goes in **`proxy.ts`, not `middleware.ts`** (blueprint §4.7 is outdated here). Read `node_modules/next/dist/docs/` before using Next APIs.
- Supabase: Postgres, Auth (email/password), Realtime (`postgres_changes`), RLS — `@supabase/supabase-js`, `@supabase/ssr`.
- Gemini: **`@google/genai` ONLY** (`GoogleGenAI`). Never install/import `@google/generative-ai`. Model from `GEMINI_MODEL`.
- Vitest (tests for `lib/metrics.ts`), tsx for `scripts/seed.ts`, hosted on Vercel.
- Installed: `@supabase/supabase-js` 2.117, `@supabase/ssr` 0.12, `@google/genai` 2.24, `server-only`; dev: `vitest` 5.0, `tsx` 4.23, `dotenv` 18.0, `@types/node` 24 (vitest 5 needs ≥22).
- Scripts: `npm run typecheck` (`tsc --noEmit`), `npm test` (`vitest run`), `npm run seed` (`tsx scripts/seed.ts`).

## Domain rules (§3)
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

Segments: `connected` (green) · `gap` (red) · `late` (amber) · `left` (grey) · `absent` (light grey hatched). Duplicate joins and orphan leaves are ignored.

## Hard rules
- Never change `lib/metrics.ts` logic without updating `lib/metrics.test.ts` in the same change. The §4.2 expected outputs are the spec — if a test fails, diagnose and report before touching metrics.
- Server-only modules (`lib/supabase/admin.ts`, `lib/gemini.ts`, anything importing `server-only`) are never imported from `scripts/`.
- `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` never reach client components.
- No D3 or chart libraries (timeline = plain Tailwind divs). No separate backend server. No chat text stored anywhere.
- Business logic lives only in `lib/metrics.ts` (pure, no I/O).
- Windows: commands must be cross-platform (npm scripts, `npx`) — no bash-only syntax.

## Out of scope (do not build)
Camera/face/emotion anything · storing chat text · attention scores · student-facing views · multi-tenant org management · email notifications · D3 · any separate backend server. Zoom webhook is stretch-only, after MVP is deployed and rehearsed.

## Workflow
- One task at a time. After each task run `npx tsc --noEmit` and `npm test` (once tests exist) and report the results.
- Commit after each working step with a descriptive message.
- **Do not start the next task until the user says so.**

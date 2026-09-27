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

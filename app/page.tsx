import Link from "next/link";
import DemoLoginButton from "@/components/DemoLoginButton";
import { CameraOffIcon, EyeOffIcon, LogoMark, PollIcon, PulseIcon } from "@/components/icons";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const PILLARS = [
  {
    Icon: CameraOffIcon,
    title: "No camera, ever",
    body: "Only join/leave events and interaction kinds. No video, audio, faces or chat text.",
    tone: "bg-rose-50 text-rose-600 ring-rose-100",
  },
  {
    Icon: PulseIcon,
    title: "Drops mean reliability",
    body: "Clusters of disconnects are flagged as a possible shared connectivity issue, never as disengagement.",
    tone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  },
  {
    Icon: EyeOffIcon,
    title: "AI never sees names",
    body: "Gemini gets pseudonyms and aggregates only. Names are mapped back on our server.",
    tone: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  },
];

// Decorative preview of the connection timeline (illustrative, not real data).
const PREVIEW_ROWS: { name: string; segs: [string, number][] }[] = [
  { name: "S1", segs: [["bg-emerald-500", 100]] },
  { name: "S2", segs: [["bg-emerald-500", 28], ["bg-rose-500", 6], ["bg-emerald-500", 66]] },
  { name: "S3", segs: [["bg-amber-400", 18], ["bg-emerald-500", 82]] },
  { name: "S4", segs: [["bg-emerald-500", 26], ["bg-rose-500", 9], ["bg-emerald-500", 65]] },
  { name: "S5", segs: [["bg-emerald-500", 88], ["bg-slate-300", 12]] },
];

export default function Home() {
  return (
    <main className="relative isolate flex flex-1 flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-indigo-200/50 blur-3xl" />
        <div className="absolute -right-32 top-20 h-[24rem] w-[24rem] rounded-full bg-violet-200/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[20rem] w-[20rem] rounded-full bg-sky-100/60 blur-3xl" />
      </div>

      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">ClassPulse</span>
        </span>
        <Link href="/login" className="text-sm font-medium text-slate-600 transition hover:text-indigo-600">
          Sign in
        </Link>
      </nav>

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-10 lg:grid-cols-[1.1fr_1fr] lg:py-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Privacy-first session analytics
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
            Know who&apos;s really there.{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Without a camera.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            ClassPulse shows instructors who is connected, whose connection is unstable, and who hasn&apos;t answered
            a poll, in real time, using only metadata the meeting platform already records.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {DEMO_MODE && <DemoLoginButton />}
            <Link
              href="/login"
              className={
                DEMO_MODE
                  ? "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-5 py-3 font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-indigo-200 hover:text-indigo-700"
                  : "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-xl hover:shadow-indigo-500/30"
              }
            >
              Instructor login
            </Link>
          </div>
          {DEMO_MODE && (
            <p className="mt-3 text-sm text-slate-500">No sign-up needed: opens a shared demo account with fictional students.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-xl shadow-indigo-100/60 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Connection timeline</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {PREVIEW_ROWS.map((r) => (
              <div key={r.name} className="flex items-center gap-3">
                <span className="w-6 font-mono text-xs text-slate-400">{r.name}</span>
                <div className="flex h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  {r.segs.map(([cls, w], i) => (
                    <div key={i} className={cls} style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
            <PulseIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            2 students dropped within a minute: possible shared connectivity issue, not disengagement.
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <PollIcon className="h-4 w-4 text-indigo-500" />
            Participation is measured by polls only.
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-16 md:grid-cols-3">
        {PILLARS.map(({ Icon, title, body, tone }) => (
          <div key={title} className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

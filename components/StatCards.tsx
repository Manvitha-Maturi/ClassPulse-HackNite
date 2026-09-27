import type { ComponentType, SVGProps } from "react";
import type { Stats } from "@/lib/metrics";
import { ClockIcon, PollIcon, PulseIcon, SilentIcon, UserOffIcon, WifiIcon } from "./icons";

type Tone = "emerald" | "rose" | "slate" | "amber" | "indigo" | "violet";

const TONE: Record<Tone, { icon: string; bar: string }> = {
  emerald: { icon: "bg-emerald-50 text-emerald-600 ring-emerald-100", bar: "bg-emerald-500" },
  rose: { icon: "bg-rose-50 text-rose-600 ring-rose-100", bar: "bg-rose-500" },
  slate: { icon: "bg-slate-100 text-slate-500 ring-slate-200", bar: "bg-slate-400" },
  amber: { icon: "bg-amber-50 text-amber-600 ring-amber-100", bar: "bg-amber-400" },
  indigo: { icon: "bg-indigo-50 text-indigo-600 ring-indigo-100", bar: "bg-gradient-to-r from-indigo-500 to-violet-500" },
  violet: { icon: "bg-violet-50 text-violet-600 ring-violet-100", bar: "bg-violet-500" },
};

type Card = {
  label: string;
  value: string;
  suffix?: string;
  hint: string;
  tone: Tone;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** 0–100 fill for a thin progress bar under the value. */
  progress?: number;
};

export default function StatCards({ stats }: { stats: Stats }) {
  const cards: Card[] = [
    {
      label: "Connected now",
      value: String(stats.connectedNow),
      suffix: `/ ${stats.enrolled}`,
      hint: "Currently in the session",
      tone: "emerald",
      Icon: WifiIcon,
      progress: stats.enrolled ? (stats.connectedNow / stats.enrolled) * 100 : 0,
    },
    { label: "Unstable", value: String(stats.unstable), hint: "2+ connection drops", tone: "rose", Icon: PulseIcon },
    { label: "Absent", value: String(stats.absent), hint: "Never joined", tone: "slate", Icon: UserOffIcon },
    { label: "Late", value: String(stats.late), hint: "Joined after 3 min", tone: "amber", Icon: ClockIcon },
    {
      label: "Poll response rate",
      value: stats.pollResponseRate === null ? "—" : String(stats.pollResponseRate),
      suffix: stats.pollResponseRate === null ? undefined : "%",
      hint: "Responses ÷ possible",
      tone: "indigo",
      Icon: PollIcon,
      progress: stats.pollResponseRate ?? undefined,
    },
    { label: "Silent", value: String(stats.silent), hint: "Attended, 0 poll responses", tone: "violet", Icon: SilentIcon },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, value, suffix, hint, tone, Icon, progress }) => (
        <div
          key={label}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50"
          data-print-avoid-break
        >
          <div className="flex items-start justify-between gap-2">
            {/* Fixed two-line height so values line up even when a label wraps on narrow cards. */}
            <p className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-slate-500">{label}</p>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${TONE[tone].icon}`}>
              <Icon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
            {value}
            {suffix && <span className="ml-1 text-lg font-medium text-slate-400">{suffix}</span>}
          </p>
          {progress !== undefined ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${TONE[tone].bar}`} style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
          ) : (
            <div className="mt-2 h-1.5" />
          )}
          <p className="mt-2 text-xs text-slate-400">{hint}</p>
        </div>
      ))}
    </div>
  );
}

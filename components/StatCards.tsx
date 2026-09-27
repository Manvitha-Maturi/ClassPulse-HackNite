import type { Stats } from "@/lib/metrics";

type Card = { label: string; value: string; hint: string };

export default function StatCards({ stats }: { stats: Stats }) {
  const cards: Card[] = [
    { label: "Connected now", value: `${stats.connectedNow} / ${stats.enrolled}`, hint: "Currently in the session" },
    { label: "Unstable", value: String(stats.unstable), hint: "2+ connection drops" },
    { label: "Absent", value: String(stats.absent), hint: "Never joined" },
    { label: "Late", value: String(stats.late), hint: "Joined after 3 min" },
    {
      label: "Poll response rate",
      value: stats.pollResponseRate === null ? "—" : `${stats.pollResponseRate}%`,
      hint: "Responses ÷ possible",
    },
    { label: "Silent", value: String(stats.silent), hint: "Attended, 0 poll responses" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-500">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{c.value}</p>
          <p className="mt-1 text-xs text-slate-400">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}

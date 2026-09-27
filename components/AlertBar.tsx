import type { Alert } from "@/lib/metrics";

export default function AlertBar({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={`${a.startMin}-${a.endMin}`}
          role="alert"
          data-print-avoid-break
          className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <span aria-hidden className="mt-0.5 text-lg leading-none">⚠</span>
          <div>
            <p className="font-medium">Likely network or platform issue</p>
            <p className="text-sm">{a.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

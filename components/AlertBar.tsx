import type { Alert } from "@/lib/metrics";
import { AlertIcon } from "./icons";

export default function AlertBar({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={`${a.startMin}-${a.endMin}`}
          role="alert"
          data-print-avoid-break
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/60 p-4 text-amber-950 shadow-sm shadow-amber-100"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 ring-1 ring-amber-200">
            <AlertIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              Likely network or platform issue
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {Math.floor(a.startMin) === Math.ceil(a.endMin)
                  ? `min ${Math.floor(a.startMin)}`
                  : `min ${Math.floor(a.startMin)}–${Math.ceil(a.endMin)}`}{" "}
                · {a.affectedCount} students
              </span>
            </p>
            <p className="mt-0.5 text-sm text-amber-900/80">{a.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

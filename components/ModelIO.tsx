// components/ModelIO.tsx — shows exactly what crossed the privacy boundary: the pseudonymised input sent to
// Gemini and its validated output before names were restored.

type Props = {
  input: unknown;
  /** null when Gemini wasn't reached (rules fallback). */
  output: unknown | null;
};

export default function ModelIO({ input, output }: Props) {
  return (
    <details className="group mt-4 rounded-xl bg-white/70 ring-1 ring-slate-200/70 print:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-indigo-700">
        <span>What Gemini sees</span>
        <span className="text-xs text-slate-400 transition group-open:rotate-90">▶</span>
      </summary>
      <div className="border-t border-slate-200/70 px-4 pb-4 pt-3">
        <p className="font-mono text-[11px] text-slate-500">
          metrics → pseudonymise → Gemini (JSON schema) → validate → restore names server-side
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Pane title="Sent to Gemini (no names)" value={input} />
          <Pane
            title="Gemini returned (before names restored)"
            value={output}
            empty="Gemini wasn't reached; this briefing came from the rules fallback."
          />
        </div>
      </div>
    </details>
  );
}

function Pane({ title, value, empty }: { title: string; value: unknown; empty?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      {value == null ? (
        <p className="mt-1.5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">{empty ?? "Nothing to show."}</p>
      ) : (
        <pre className="mt-1.5 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

"use client";

import { PrinterIcon } from "./icons";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:shadow-lg print:hidden"
    >
      <PrinterIcon className="h-4 w-4" />
      Export PDF
    </button>
  );
}

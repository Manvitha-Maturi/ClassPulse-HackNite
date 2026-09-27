import Link from "next/link";
import { LogoMark, ShieldIcon } from "@/components/icons";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-200/50 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark className="h-10 w-10" />
          <span className="text-lg font-semibold tracking-tight text-slate-900">ClassPulse</span>
        </Link>
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-xl shadow-indigo-100/50 backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Instructor login</h1>
          <p className="mt-1 text-sm text-slate-500">Camera-free session reliability for your live classes.</p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldIcon className="h-3.5 w-3.5 text-emerald-600" />
          No video, audio or chat text is ever collected.
        </p>
      </div>
    </main>
  );
}

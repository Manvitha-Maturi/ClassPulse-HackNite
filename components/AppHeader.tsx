import Link from "next/link";
import SignOutButton from "./SignOutButton";
import { LogoMark } from "./icons";

export default function AppHeader({ email }: { email: string | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/sessions" className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">ClassPulse</span>
        </Link>
        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold uppercase text-slate-600">
                {email[0]}
              </span>
              {email}
            </span>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

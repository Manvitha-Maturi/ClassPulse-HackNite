"use client";

// One-click sign-in as the shared demo instructor. Rendered only when NEXT_PUBLIC_DEMO_MODE is "true";
// the server action checks it again and holds the credentials server-side.
import { useActionState } from "react";
import { demoLogin, type LoginState } from "@/app/login/actions";
import { PlayIcon } from "./icons";

const initialState: LoginState = { error: null };

export default function DemoLoginButton({ className = "" }: { className?: string }) {
  const [state, formAction, pending] = useActionState(demoLogin, initialState);

  return (
    <form action={formAction} className={className}>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-60"
      >
        <PlayIcon className="h-4 w-4" fill="currentColor" />
        {pending ? "Opening the demo…" : "Try the live demo"}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

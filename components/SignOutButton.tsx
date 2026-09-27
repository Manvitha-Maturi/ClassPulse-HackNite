import { signOut } from "@/app/login/actions";
import { LogOutIcon } from "./icons";

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      >
        <LogOutIcon className="h-4 w-4" />
        Sign out
      </button>
    </form>
  );
}

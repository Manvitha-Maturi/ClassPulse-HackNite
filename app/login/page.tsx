import Link from "next/link";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← ClassPulse
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Instructor login</h1>
        <p className="mt-1 text-sm text-slate-600">Camera-free session reliability for your live classes.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

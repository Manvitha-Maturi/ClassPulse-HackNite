import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">ClassPulse</h1>
        <p className="mt-4 text-lg text-slate-600">
          Camera-free, privacy-first session reliability for live online classes.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700"
        >
          Instructor login
        </Link>
      </div>
    </main>
  );
}

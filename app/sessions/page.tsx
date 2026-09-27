// Placeholder landing page after login; Prompt 6 replaces this with the session picker.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function SessionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Your sessions</h1>
        <SignOutButton />
      </div>
      <p className="mt-4 text-slate-600">Signed in as {user.email}. Session list coming next.</p>
    </main>
  );
}

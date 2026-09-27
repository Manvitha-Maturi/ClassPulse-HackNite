// Shared chrome for every signed-in page: sticky app header with the instructor's email and sign out.
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";

export default async function SessionsLayout({ children }: LayoutProps<"/sessions">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <AppHeader email={user?.email ?? null} />
      {children}
    </>
  );
}

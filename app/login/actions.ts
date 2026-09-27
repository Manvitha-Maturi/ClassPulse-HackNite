"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Invalid email or password." };

  redirect("/sessions");
}

/**
 * One-click sign-in as the shared demo instructor (demo mode only). The credentials are read from
 * server-only env vars and never sent to the browser.
 */
export async function demoLogin(): Promise<LoginState> {
  const email = process.env.DEMO_INSTRUCTOR_EMAIL;
  const password = process.env.DEMO_INSTRUCTOR_PASSWORD;
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true" || !email || !password) {
    return { error: "The live demo isn't available right now." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("Demo login failed:", error.message);
    return { error: "The live demo isn't available right now." };
  }

  redirect("/sessions");
}

export async function signOut() {
  const supabase = await createClient();
  // Local scope: only this browser. The demo account is shared, so a global sign-out would log out everyone.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

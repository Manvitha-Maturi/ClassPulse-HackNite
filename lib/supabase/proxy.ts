// lib/supabase/proxy.ts — refreshes the Supabase auth cookie on every request and guards /sessions/*.
// Used only by the root proxy.ts (Next.js 16's replacement for middleware.ts).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // No-cache headers so a CDN never serves one user's auth cookie to another.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser(): it refreshes the session.
  // getUser() asks the Auth server, matching the pages' check. getClaims() only verifies the JWT locally,
  // so a revoked session still "passes" here but fails in the page, causing a /login <-> /sessions loop.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = Boolean(user);
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Carry over any refreshed auth cookies.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!signedIn && (pathname === "/sessions" || pathname.startsWith("/sessions/"))) return redirectTo("/login");
  if (signedIn && pathname === "/login") return redirectTo("/sessions");

  return response;
}

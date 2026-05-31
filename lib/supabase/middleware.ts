import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public routes reachable without a session. Everything else requires login.
const PUBLIC_PREFIXES = ["/login", "/register", "/auth"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * Refreshes the Supabase session cookie on every request and enforces the auth
 * gate: unauthenticated users are bounced to /login; authenticated users on an
 * auth page are sent to the app. Returning the `supabaseResponse` (with its
 * refreshed cookies) is required for sessions to stay alive.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getUser() — it
  // anchors the session refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

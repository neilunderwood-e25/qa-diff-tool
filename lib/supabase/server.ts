import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

// Server-side Supabase client (RSC, route handlers, server actions) bound to
// the request's cookies so it reads/refreshes the signed-in user's session.
// Uses the anon key — this client is for *auth/session*, not privileged data
// access (privileged work goes through lib/supabase/storage.ts + Prisma).
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In a Server Component the cookie store is read-only; the middleware
          // refreshes the session cookie, so swallowing here is safe.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* called from a Server Component — ignore */
          }
        },
      },
    }
  );
}

/**
 * Return the authenticated user, or null. Use in API routes to reject
 * unauthenticated requests with a 401 (the UI is already gated by middleware;
 * this is defense-in-depth).
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

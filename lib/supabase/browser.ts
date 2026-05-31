import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for user authentication (login / register /
// sign out). Uses the public anon key — never the service-role key. Auth state
// is persisted to cookies so the server (middleware + route handlers) can read
// the same session.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

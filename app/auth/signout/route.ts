import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// POST /auth/signout — clears the session server-side (removing the auth
// cookies) and redirects to the login screen.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}

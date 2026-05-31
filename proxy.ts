import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 "proxy" convention (formerly "middleware"). Runs the Supabase
// session refresh + auth gate on every matched request.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except Next internals and static asset files. API routes
  // ARE included so they sit behind the auth gate too.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|runs/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

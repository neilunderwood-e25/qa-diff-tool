import { NextResponse } from "next/server";
import { compareMeta } from "@/lib/meta";
import { getCurrentUser } from "@/lib/supabase/server";

// POST /api/meta { liveUrl, testUrl } — compare meta tags, live = source of truth.
export const runtime = "nodejs";
export const maxDuration = 30;

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { liveUrl?: string; testUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const liveUrl = body.liveUrl?.trim() ?? "";
  const testUrl = body.testUrl?.trim() ?? "";
  if (!isValidHttpUrl(liveUrl) || !isValidHttpUrl(testUrl)) {
    return NextResponse.json(
      { error: "Both Live and Test must be valid http(s) URLs." },
      { status: 400 }
    );
  }

  try {
    const result = await compareMeta(liveUrl, testUrl);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Meta comparison failed." },
      { status: 500 }
    );
  }
}

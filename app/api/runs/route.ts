import { NextResponse } from "next/server";
import { deleteRun, getRunResult, listRunSummaries } from "@/lib/runs";
import { getCurrentUser } from "@/lib/supabase/server";

// Run history. GET /api/runs returns newest-first summaries (no heavy locale
// payload); GET /api/runs?id=<runId> returns a full run reassembled into the
// same CompareResult shape the compare route returns live.

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");

  try {
    if (id) {
      const result = await getRunResult(id);
      if (!result) {
        return NextResponse.json({ error: "Run not found." }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    const runs = await listRunSummaries(50);
    return NextResponse.json({ runs });
  } catch (e) {
    console.error("[runs] query failed:", e);
    return NextResponse.json(
      { error: "Failed to load run history." },
      { status: 500 }
    );
  }
}

/** DELETE /api/runs?id=<runId> — remove a run and its screenshots. */
export async function DELETE(request: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing run id." }, { status: 400 });
  }

  try {
    const deleted = await deleteRun(id);
    if (!deleted) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[runs] delete failed:", e);
    return NextResponse.json({ error: "Failed to delete run." }, { status: 500 });
  }
}

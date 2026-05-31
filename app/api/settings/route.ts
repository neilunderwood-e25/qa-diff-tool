import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, type QaSettings } from "@/lib/settings";

// Settings live in the database (single shared row, id=1) and are read/written
// only here — the browser goes through this route rather than touching the DB,
// because Prisma is server-only.

export const runtime = "nodejs";

const SETTINGS_ID = 1;

function clean(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** GET /api/settings — read the shared row, self-seeding defaults if absent. */
export async function GET() {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const row = await prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: {
        id: SETTINGS_ID,
        liveBase: DEFAULT_SETTINGS.liveBase,
        migrationBase: DEFAULT_SETTINGS.migrationBase,
      },
    });
    const settings: QaSettings = {
      liveBase: row.liveBase,
      migrationBase: row.migrationBase,
    };
    return NextResponse.json(settings);
  } catch (e) {
    // Fall back to defaults so the UI still functions if the DB is unreachable.
    console.error("[settings] read failed:", e);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

/** PUT /api/settings — upsert the shared row. */
export async function PUT(request: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<QaSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const settings: QaSettings = {
    liveBase: clean(body.liveBase, DEFAULT_SETTINGS.liveBase),
    migrationBase: clean(body.migrationBase, DEFAULT_SETTINGS.migrationBase),
  };

  try {
    await prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: settings,
      create: { id: SETTINGS_ID, ...settings },
    });
    return NextResponse.json(settings);
  } catch (e) {
    console.error("[settings] write failed:", e);
    return NextResponse.json(
      { error: "Failed to save settings." },
      { status: 500 }
    );
  }
}

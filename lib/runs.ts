import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStorageAdmin, SCREENSHOTS_BUCKET } from "@/lib/supabase/storage";
import { VIEWPORTS } from "@/lib/viewports";
import type { CompareResult, LocaleResult } from "@/lib/types";

// Run-history persistence. Keeps all Prisma access for the `runs` table in one
// place so the API routes stay thin and the DB row shape never leaks into the
// rest of the app — callers work with `CompareResult` / `RunSummary` only.

/** Lightweight row for the history list (omits the heavy `locales` payload). */
export interface RunSummary {
  runId: string;
  liveUrl: string;
  testUrl: string;
  localeCodes: string[];
  maxDiffPercent: number | null;
  createdAt: string;
}

/** Max diff percent across every viewport of every locale (null if none ran). */
export function computeMaxDiffPercent(locales: LocaleResult[]): number | null {
  let max: number | null = null;
  for (const loc of locales) {
    for (const vp of loc.viewports) {
      if (typeof vp.diffPercent === "number") {
        max = max === null ? vp.diffPercent : Math.max(max, vp.diffPercent);
      }
    }
  }
  return max;
}

/**
 * Persist a completed comparison. Returns nothing useful — callers should wrap
 * this in try/catch and treat failure as non-fatal: a DB hiccup must never
 * discard a multi-minute capture that already succeeded.
 */
export async function persistRun(result: CompareResult): Promise<void> {
  await prisma.run.create({
    data: {
      runId: result.runId,
      liveUrl: result.liveUrl,
      testUrl: result.testUrl,
      localeCodes: result.locales.map((l) => l.locale),
      maxDiffPercent: computeMaxDiffPercent(result.locales),
      // The locale tree is plain JSON-serializable data; cast for Prisma's Json.
      locales: result.locales as unknown as Prisma.InputJsonValue,
      createdAt: new Date(result.createdAt),
    },
  });
}

/** Newest-first summaries for the history list. */
export async function listRunSummaries(limit = 50): Promise<RunSummary[]> {
  const rows = await prisma.run.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      runId: true,
      liveUrl: true,
      testUrl: true,
      localeCodes: true,
      maxDiffPercent: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    runId: r.runId,
    liveUrl: r.liveUrl,
    testUrl: r.testUrl,
    localeCodes: r.localeCodes,
    maxDiffPercent: r.maxDiffPercent,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Delete a run: removes its screenshots from Storage (best-effort) and the DB
 * row. Returns false if no row matched (so the caller can 404). Screenshot
 * paths are reconstructed from `localeCodes × VIEWPORTS`; Storage `remove`
 * ignores keys that don't exist, so failed/partial captures are handled.
 */
export async function deleteRun(runId: string): Promise<boolean> {
  try {
    const run = await prisma.run.findUnique({
      where: { runId },
      select: { localeCodes: true },
    });
    const locales = run?.localeCodes?.length ? run.localeCodes : ["en"];
    const paths: string[] = [];
    for (const locale of locales) {
      for (const vp of VIEWPORTS) {
        for (const file of ["live.png", "test.png", "diff.png"]) {
          paths.push(`${runId}/${locale}/${vp.name}/${file}`);
        }
      }
    }
    const storage = getStorageAdmin();
    await storage.storage.from(SCREENSHOTS_BUCKET).remove(paths);
  } catch (e) {
    // A storage hiccup must not block deleting the DB row.
    console.warn(`[runs] failed to remove screenshots for ${runId}:`, e);
  }

  const { count } = await prisma.run.deleteMany({ where: { runId } });
  return count > 0;
}

/** Reassemble a stored run into the same `CompareResult` the API returns live. */
export async function getRunResult(runId: string): Promise<CompareResult | null> {
  const row = await prisma.run.findUnique({ where: { runId } });
  if (!row) return null;
  return {
    runId: row.runId,
    liveUrl: row.liveUrl,
    testUrl: row.testUrl,
    createdAt: row.createdAt.toISOString(),
    locales: row.locales as unknown as LocaleResult[],
  };
}

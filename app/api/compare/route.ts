import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { chromium, type Browser } from "playwright";
import { VIEWPORTS } from "@/lib/viewports";
import { captureScreenshot } from "@/lib/capture";
import { diffPngs } from "@/lib/diff";
import { DEFAULT_LOCALE, applyLocale, isLocale } from "@/lib/locales";
import { getStorageAdmin, uploadScreenshot } from "@/lib/supabase/storage";
import { getCurrentUser } from "@/lib/supabase/server";
import { compareMeta } from "@/lib/meta";
import { persistRun } from "@/lib/runs";
import type { CompareResult, LocaleResult, ViewportResult } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function POST(request: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { liveUrl?: string; testUrl?: string; locales?: unknown };
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

  // Resolve requested locales: dedupe, validate, default to [en].
  const requested = Array.isArray(body.locales)
    ? [...new Set(body.locales.filter((l): l is string => typeof l === "string"))]
    : [];
  const locales = requested.filter(isLocale);
  if (requested.length && !locales.length) {
    return NextResponse.json(
      { error: "No valid locale codes provided." },
      { status: 400 }
    );
  }
  if (!locales.length) locales.push(DEFAULT_LOCALE);

  const runId = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const runDir = path.join(process.cwd(), "public", "runs", runId);

  // Storage is best-effort: if it isn't configured we still capture and return
  // a result, falling back to local /runs URLs. Build the client once.
  let storage: SupabaseClient | null = null;
  try {
    storage = getStorageAdmin();
  } catch (e) {
    console.warn("[compare] Supabase Storage disabled:", errMsg(e));
  }

  let browser: Browser | undefined;
  try {
    // Default to headed Chrome: many production sites (Akamai etc.) block the
    // headless browser fingerprint and return an "Access Denied" page. A real
    // window is far less detectable. Set HEADLESS=true to override.
    browser = await chromium.launch({
      headless: process.env.HEADLESS === "true",
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const localeResults: LocaleResult[] = [];

    for (const locale of locales) {
      const localeLiveUrl = applyLocale(liveUrl, locale);
      const localeTestUrl = applyLocale(testUrl, locale);
      const viewports: ViewportResult[] = [];

      // Kick off the meta-tag comparison concurrently with the screenshot
      // captures (cheap HTTP fetches) so it adds no latency to the run.
      // Non-fatal: a failure leaves the locale without meta data.
      const metaPromise = compareMeta(localeLiveUrl, localeTestUrl).catch(
        () => undefined
      );

      for (const vp of VIEWPORTS) {
        const outDir = path.join(runDir, locale, vp.name);
        await mkdir(outDir, { recursive: true });
        const publicBase = `/runs/${runId}/${locale}/${vp.name}`;

        const result: ViewportResult = { viewport: vp.name, width: vp.width };

        // Capture both pages; record per-URL failures instead of aborting.
        const [liveRes, testRes] = await Promise.allSettled([
          captureScreenshot(browser, localeLiveUrl, vp),
          captureScreenshot(browser, localeTestUrl, vp),
        ]);

        let liveBuf: Buffer | undefined;
        let testBuf: Buffer | undefined;
        let diffBuf: Buffer | undefined;

        if (liveRes.status === "fulfilled") {
          liveBuf = liveRes.value;
          await writeFile(path.join(outDir, "live.png"), liveBuf);
          result.liveImage = `${publicBase}/live.png`;
        } else {
          result.liveError = errMsg(liveRes.reason);
        }

        if (testRes.status === "fulfilled") {
          testBuf = testRes.value;
          await writeFile(path.join(outDir, "test.png"), testBuf);
          result.testImage = `${publicBase}/test.png`;
        } else {
          result.testError = errMsg(testRes.reason);
        }

        if (liveBuf && testBuf) {
          const diff = diffPngs(liveBuf, testBuf);
          diffBuf = diff.diffBuffer;
          await writeFile(path.join(outDir, "diff.png"), diffBuf);
          result.diffImage = `${publicBase}/diff.png`;
          result.diffPixels = diff.diffPixels;
          result.diffPercent = diff.diffPercent;
        }

        // Mirror the just-written buffers to Supabase Storage in parallel. On
        // success the image URL is swapped to the public Storage URL (loads on
        // any machine); on failure the local /runs path is kept. The local
        // writes above remain as a cheap on-box cache.
        if (storage) {
          const mirror = (
            buf: Buffer,
            file: string,
            key: "liveImage" | "testImage" | "diffImage"
          ) =>
            uploadScreenshot(storage!, `${runId}/${locale}/${vp.name}/${file}`, buf)
              .then((url) => {
                result[key] = url;
              })
              .catch((e) =>
                console.warn(`[compare] upload ${file} failed:`, errMsg(e))
              );

          const uploads: Promise<void>[] = [];
          if (liveBuf) uploads.push(mirror(liveBuf, "live.png", "liveImage"));
          if (testBuf) uploads.push(mirror(testBuf, "test.png", "testImage"));
          if (diffBuf) uploads.push(mirror(diffBuf, "diff.png", "diffImage"));
          await Promise.all(uploads);
        }

        viewports.push(result);
      }

      localeResults.push({
        locale,
        liveUrl: localeLiveUrl,
        testUrl: localeTestUrl,
        viewports,
        meta: await metaPromise,
      });
    }

    const payload: CompareResult = {
      runId,
      liveUrl,
      testUrl,
      createdAt: new Date().toISOString(),
      locales: localeResults,
    };

    // Persist run history. Non-fatal: a DB hiccup must never discard a capture
    // that already succeeded — log and return the result regardless.
    try {
      await persistRun(payload);
    } catch (e) {
      console.error("[compare] failed to persist run:", errMsg(e));
    }

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: `Comparison failed: ${errMsg(e)}` },
      { status: 500 }
    );
  } finally {
    await browser?.close();
  }
}

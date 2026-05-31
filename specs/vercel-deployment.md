# Deploy QA-Tool to Vercel (Hobby) — Async Chunked Capture

> Status: **planned, not yet implemented.** Saved for later execution.

## Context
The app (Next.js 16 + Supabase Auth + Prisma + Supabase Storage) is built to run **locally**, where it launches a **visible (headed)** Chrome to defeat Akamai bot-detection on `netapp.com`, captures full-page screenshots across up to 10 locales × 2 viewports, and returns the whole `CompareResult` from one long `POST /api/compare`. None of that survives Vercel serverless:
- Full `playwright` has no browser binary on Vercel and busts the function size limit.
- Headed mode is impossible (no display); `public/runs` writes hit a read-only FS.
- **Hobby caps functions at 60s** — too short for even a single multi-page capture, let alone a multi-locale run.

**Decisions (confirmed with user):** run headless **on Vercel** with best-effort stealth (no third-party browser service), use an **async background-job model**, target **Hobby**.

**Honest constraint baked into this plan:** headless from Vercel's datacenter IPs + stealth headers will reliably capture the **Vercel-hosted test site** and unprotected pages, but the **Akamai-protected live `netapp.com` will often still return "Access Denied."** The design fails *gracefully per-URL* (the live pane shows an error, the run continues) and exposes a `CAPTURE_PROXY` env hook so a residential proxy can be added later to actually beat Akamai — **without re-architecting**.

Same Supabase project (`auwetfkjaldtfczvdoaj`) serves prod; only new columns + auth-URL config are needed there.

## Architecture: create → step (client-orchestrated)
Because Hobby invocations are ≤60s, one request cannot do a whole run. Split the work into **units** (one `locale × viewport`) and have the **browser client drive** the loop — no server cron/worker (Hobby cron is daily-only).

1. `POST /api/compare/create` — validate, build the unit plan, insert a `Run` row `status="pending"`, return `{ runId, units }`. Fast, no browser.
2. `POST /api/compare/step` `{ runId, unitIndex }` — launch chromium, capture live+test for that one unit (parallel), diff, upload to Storage, merge the `ViewportResult` into `Run.locales`, mark unit done. `maxDuration=60`.
3. Client (`CompareForm`) calls `create`, then `step` **sequentially** for each unit, repainting `ResultViewer` after each (live progress), bumping history once on completion. A closed tab simply stops — the DB keeps the partial run.

Sequential stepping serializes the per-run `Run.locales` read-modify-write (no races); `applyUnitResult` is made **idempotent** (keyed by `unitIndex`, counts recomputed from `units[].status`) to survive client retries.

## File-level changes

### Prisma — `prisma/schema.prisma` (additive, backward-compatible)
Add to `model Run`: `status String @default("complete")`, `units Json @default("[]")`, `unitsTotal Int @default(0)`, `unitsDone Int @default(0)`, `error String?`, `updatedAt DateTime @updatedAt @map("updated_at")`. String (not enum) status keeps `db push` and Supabase MCP migrations identical. Default `"complete"` makes pre-existing rows read as done.
Apply via `npm run db:push` **and** an idempotent `ALTER TABLE runs ADD COLUMN ...` through Supabase MCP `apply_migration` (all defaulted/nullable → non-locking).

### New `lib/browser.ts`
`launchBrowser(): Promise<Browser>` — **dynamic `import()`** so the bundle never pulls both engines:
- `process.env.VERCEL` → `playwright-core` + `@sparticuz/chromium` (`executablePath()`, `chromium.args`, `headless:true`).
- else → full `playwright`, `headless: process.env.HEADLESS === "true"` (current local behavior).
- both paths add `proxy` when `CAPTURE_PROXY` is set.

### `lib/capture.ts` / `lib/prepare.ts`
- Import **types from `playwright-core`** (not `playwright`) so the type graph doesn't drag in the heavy package.
- **Nav budget:** `waitUntil: "domcontentloaded"`, `timeout: 25_000` (replaces `networkidle`/60s, the main 60s-buster); bound `preparePage` total with a `Promise.race` (~8s) so slow pages can't blow the unit.
- **Stealth additions:** client-hint headers (`sec-ch-ua*`, `Sec-Fetch-*`, `Accept`, `Upgrade-Insecure-Requests`) on `extraHTTPHeaders`; extend the existing `addInitScript` to also patch `navigator.languages/plugins`, `window.chrome`, `permissions.query` (best-effort, never throws). Keep per-viewport UAs from `lib/viewports.ts`.

### API routes
- **New** `app/api/compare/create/route.ts` (POST, `maxDuration=10`, `getCurrentUser()`→401): lift validation from the old route (`isValidHttpUrl`, locale dedupe/validate), build `RunUnit[]` = `{ index, locale, viewport, width, liveUrl, testUrl, status }` over `locales × VIEWPORTS` with `applyLocale`, `createRun(...)`.
- **New** `app/api/compare/step/route.ts` (POST, `maxDuration=60`, auth): load run, find `units[unitIndex]`; if `done` return idempotently; `launchBrowser()` (fresh per step), `Promise.allSettled` both captures, `diffPngs`, `uploadScreenshot` (key `${runId}/${locale}/${vp}/{live,test,diff}.png`), `applyUnitResult`, `browser.close()` in `finally`. Capture failures stay per-URL `liveError/testError` (unit still `done`).
- **Delete** old `app/api/compare/route.ts` (invalid `maxDuration=120`, dead `public/runs` path; fully replaced).
- `app/api/runs/route.ts`: unchanged structurally; `getRunResult` now returns partial runs + `status/unitsDone/unitsTotal`.

### `lib/runs.ts`
Replace `persistRun` with `createRun`, `applyUnitResult` (idempotent, keyed by `unitIndex`, recomputes `maxDiffPercent`/`localeCodes`/`unitsDone`/`status`; wrap read-modify-write in `prisma.$transaction`), and finalize-on-last-unit. Add `status/unitsTotal/unitsDone` to `RunSummary` + `listRunSummaries` select. Keep `computeMaxDiffPercent`.

### `lib/types.ts`
`CompareResult` gains optional `status?: RunStatus`, `unitsDone?`, `unitsTotal?` (backward-compatible). Add `RunUnit` + `RunStatus`. `ViewportResult`/`LocaleResult` unchanged (image fields already optional → partial locales render fine).

### FS guard (in step path)
`const localCache = !process.env.VERCEL;` — gate every `mkdir`/`writeFile`. On Vercel set image URLs **only** from `uploadScreenshot`'s returned Storage URL (no local-path fallback). **Storage becomes mandatory on Vercel:** step fails fast with a clear error if `process.env.VERCEL` and `getStorageAdmin()`/bucket are unavailable. Local dev keeps the write-then-overwrite behavior.

### Client — `components/CompareForm.tsx`, `CompareWorkspace.tsx`, `ResultViewer.tsx`, `RunHistory.tsx`
- `CompareForm.handleSubmit`: `create` → seed a skeleton `CompareResult` (`status:"running"`) and `onResult` immediately → loop `step` sequentially, merging each `ViewportResult` and calling `onResult` to repaint; button shows `Capturing n/total…`; retry a failed step once then continue. Optional Cancel via `AbortController`.
- `CompareWorkspace`: only bump `historyKey` when `result.status === "complete"` (add `onComplete` or gate the bump) so partial repaints don't thrash history.
- `ResultViewer`: add a progress header for `pending|running`; guard `locales.length === 0` and `activeLocale` outrunning captured locales.
- `RunHistory`: show a running/partial badge (`${unitsDone}/${unitsTotal}`) + distinct dot color via `toneFor`.

### Config
- `next.config.ts`: `serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium"]`.
- `package.json`: add `playwright-core` **pinned to the same version as `playwright`** + `@sparticuz/chromium` (revision compatible with playwright-core); add `"engines": { "node": ">=20" }`. Keep `playwright`, `pw:install`, `postinstall: prisma generate`, `db:push`.
- **New** `vercel.json`: `{ "functions": { "app/api/compare/step/route.ts": { "maxDuration": 60, "memory": 2048 } } }` (max Hobby memory — chromium + tall full-page PNGs OOM at 1024).
- `lib/prisma.ts`: cache client on `globalThis` **unconditionally** (drop the `NODE_ENV` guard) for warm-invocation reuse.

### Env vars (Vercel project settings, Production + Preview)
`DATABASE_URL` (**append `?pgbouncer=true&connection_limit=1`**), `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, optional `CAPTURE_PROXY`. Do **not** set `VERCEL` (injected automatically — it's the engine/FS switch).

### Supabase dashboard (prod domain)
- Auth → URL Configuration → **Site URL** = `https://<prod>.vercel.app`; **Redirect allow-list** add `/auth/confirm`, `/**`, and preview wildcard `https://*-<scope>.vercel.app/**`. (`AuthForm.tsx` builds `emailRedirectTo` from `window.location.origin`, so the live URL must be allow-listed.)
- Confirm `qa-screenshots` bucket exists + **public** (already created).

## Risks (prioritized)
- **A. One unit in 60s (highest):** chromium cold start + 2 heavy captures. Mitigated by `domcontentloaded`+bounded prepare. **Fallback designed-in:** if real sites still time out, split a unit into one-page-per-call (`locale×viewport×side`) — 4 calls/locale.
- **B. @sparticuz/chromium + playwright-core + Next 16:** version match is the #1 failure; 250MB unzipped budget (fits via `serverExternalPackages` + brotli binary); verify with `next build` size + a deployed smoke test before wiring UI.
- **C. Prisma/PgBouncer:** require `pgbouncer=true&connection_limit=1`; unconditional global client cache.
- **D. Partial-run merge:** safe under sequential stepping; idempotent keyed writes + `$transaction` cover retries/dup tabs.
- **E. Akamai:** datacenter-IP blocks likely on live site; graceful per-URL errors + `CAPTURE_PROXY` lever. Set expectations.
- **F/G:** Storage load-bearing on Vercel (fail fast if unconfigured); tall-PNG memory (use 2048MB / consider height cap).

## Verification
1. Local: `npm run db:push` (adds columns), `npm run build`, `npm run dev` → run a single-locale compare; confirm create→step loop, live progress repaint, run row with `status="complete"`, Storage URLs in `<img>`, history shows it. Run all-locales → progress to N/N.
2. Pre-deploy: init git, push to GitHub (repo is **not** currently initialized) — or use `vercel` CLI directly.
3. Vercel: set env vars + Supabase auth URLs; deploy; smoke-test `/api/compare/step` size/runtime via a deployed single capture of the **test site** (expect success) and the **live site** (may show Access Denied — expected without proxy).
4. Confirm service-role key absent from client bundle (re-run the `.next/static` grep). Confirm Hobby step stays <60s on a real page; if not, flip to the one-page-per-call fallback.

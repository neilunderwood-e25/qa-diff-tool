# Integrate Supabase for Persistent Data

## Context
The Visual QA tool currently loses data:
- **Settings** (`liveBase` / `migrationBase`) live only in browser `localStorage` (`lib/settings.ts`) — gone on browser clear, not shared across devices.
- **Comparison runs** (`CompareResult` JSON + diff metrics) are returned in memory only — lost on refresh, no history.
- **Screenshots** are written to `public/runs/<runId>/...` on local disk (git-ignored) — never catalogued, local-only.

Goal: integrate Supabase so settings, run history, and screenshots persist across sessions and machines. Scope: **no auth, single shared workspace** (internal tool).

Key de-risking fact: `components/ResultViewer.tsx` treats `liveImage`/`testImage`/`diffImage` as opaque URL strings. If the API returns Supabase Storage URLs in those same fields, the viewer works **unchanged** — no type changes needed.

## Approach

### 1. Dependency & env
- `npm install @supabase/supabase-js` (no `@supabase/ssr` — only needed for auth sessions, which we don't have).
- Env vars in `.env.local` (already git-ignored):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser, settings page)
  - `SUPABASE_SERVICE_ROLE_KEY` (**server-only**, used in API routes which already declare `runtime = "nodejs"`)
- Commit a `.env.example` documenting the three vars.

### 2. Supabase SQL (run in dashboard SQL editor, or apply via MCP)
- Table `settings`: singleton row (`id=1`, `live_base`, `migration_base`, `updated_at`), seeded with current defaults (`https://netapp.com`, `https://netapp-e25migration.vercel.app`).
- Table `runs`: `run_id` (PK, matches existing `${Date.now()}-${hex}`), `live_url`, `test_url`, `locale_codes text[]`, `max_diff_percent numeric`, `locales jsonb` (full `LocaleResult[]` payload), `created_at`. Index on `created_at desc`.
  - **JSONB over normalized tables**: the `locales` tree is read/written atomically and never queried per-viewport; normalizing adds joins for zero benefit.
- Storage bucket `qa-screenshots` (public read).
- **RLS enabled** with permissive policies (the anon key ships to the browser): `settings` allows anon select/insert/update; `runs` allows anon **select only** (writes go through service role, which bypasses RLS); storage objects public read. (Justification: disabling RLS would let anyone with the public bundle write any table.)

```sql
-- SETTINGS: single shared row
create table public.settings (
  id            int primary key default 1,
  live_base     text not null,
  migration_base text not null,
  updated_at    timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);
insert into public.settings (id, live_base, migration_base)
values (1, 'https://netapp.com', 'https://netapp-e25migration.vercel.app')
on conflict (id) do nothing;

-- RUNS: one row per comparison; nested locale/viewport data in JSONB
create table public.runs (
  run_id        text primary key,
  live_url      text not null,
  test_url      text not null,
  locale_codes  text[] not null default '{}',
  max_diff_percent numeric,
  locales       jsonb not null,
  created_at    timestamptz not null default now()
);
create index runs_created_at_idx on public.runs (created_at desc);

-- RLS
alter table public.settings enable row level security;
alter table public.runs     enable row level security;
create policy "settings_read"   on public.settings for select using (true);
create policy "settings_write"  on public.settings for insert with check (true);
create policy "settings_update" on public.settings for update using (true) with check (true);
create policy "runs_read" on public.runs for select using (true);

-- STORAGE bucket for screenshots (public read)
insert into storage.buckets (id, name, public)
values ('qa-screenshots', 'qa-screenshots', true)
on conflict (id) do nothing;
create policy "qa_screenshots_public_read"
on storage.objects for select using (bucket_id = 'qa-screenshots');
```

### 3. Client helpers (new files)
- `lib/supabase/client.ts` — browser anon client (`createClient` with URL + anon key) for the settings page.
- `lib/supabase/server.ts` — `getSupabaseAdmin()` factory returning a service-role client (`persistSession: false`); lazy factory so the key is read at request time, never bundled to client.

### 4. `app/api/compare/route.ts` changes
- Create admin client at top of `POST`.
- In the per-viewport loop, after each existing `writeFile`, **also upload** the same buffer to `qa-screenshots` at path `<runId>/<locale>/<viewport>/{live,test,diff}.png`, and set `result.liveImage`/`testImage`/`diffImage` to `getPublicUrl(...)` (sync string-build) instead of the local `/runs/...` path. **Keep** the `public/runs` writes as a local cache (cheap, buffers already in memory).
  - Mitigate latency: collect upload promises and `await Promise.all` per viewport rather than awaiting each inline (the main risk — see below).
- After the loop, build the same `CompareResult` payload (now with Storage URLs) and `insert` a `runs` row (`max_diff_percent` = max `diffPercent` across viewports; `locales` = `localeResults` as JSONB). Wrap insert in try/catch that logs but does **not** fail the response — a DB hiccup must not discard a 2-minute capture.

### 5. Settings: Supabase as source of truth, localStorage as cache
- `lib/settings.ts` — keep `joinUrl`, `DEFAULT_SETTINGS`, and existing localStorage helpers; add:
  - `fetchSettings()`: read row id=1, fall back to localStorage → defaults on error; refresh cache on success.
  - `persistSettings(s)`: `upsert` row id=1, and update localStorage cache.
- `app/settings/page.tsx` — hydrate via `fetchSettings()`; `handleSubmit`/`handleReset` `await persistSettings(...)`. Seed initial state from `loadSettings()` so the form isn't empty during fetch.
- `components/CompareForm.tsx` — init state from `loadSettings()` (instant cached value, no flash), then `fetchSettings().then(setSettings)` in the effect to reconcile. No prop changes.

### 6. Run history (minimal)
- New `app/api/runs/route.ts` (`runtime = "nodejs"`):
  - `GET /api/runs` → summary list (no heavy `locales`), newest-first, limit 50.
  - `GET /api/runs?id=<runId>` → full row reassembled into a `CompareResult`.
- `components/RunHistory.tsx` — "Recent runs" list with `onSelect(result)` callback (mirrors `CompareForm`'s `onResult`). Fetches summary on mount; clicking a row fetches the full run and calls `onSelect`.
- `app/page.tsx` — render `<RunHistory onSelect={setResult} />` below the form, reusing existing `result` state + `ResultViewer`.

## Critical files
- Modify: `app/api/compare/route.ts`, `lib/settings.ts`, `app/settings/page.tsx`, `components/CompareForm.tsx`, `app/page.tsx`
- Create: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `app/api/runs/route.ts`, `components/RunHistory.tsx`, `.env.local`, `.env.example`
- Unchanged: `components/ResultViewer.tsx`, `lib/types.ts` (Storage URLs slot into existing `*Image` fields)

## Main risk
Storage upload latency stacks onto the already-slow (≤120s) capture route: `locales × 2 viewports × 3 PNGs` uploads. Mitigate by parallelizing uploads with `Promise.all`; keep `public/runs` writes as fallback; bump `maxDuration` / cap PNG size if needed. DB insert is non-fatal (try/catch).

## Verification
1. Run SQL (or apply via MCP); confirm `settings` seed row, `runs` table, public `qa-screenshots` bucket.
2. Populate `.env.local`; restart `npm run dev`.
3. **Settings round-trip**: change `liveBase` on `/settings`, Save, reload → persists. Confirm row id=1 in dashboard. Open in incognito (cold cache) → still loads (proves DB is source of truth).
4. **Run a compare**: submit a slug → ResultViewer renders from `*.supabase.co/storage/...` URLs (check `<img src>`); a `runs` row appears with correct fields; PNGs visible in bucket.
5. **History**: reload `/` → run appears newest-first; click → ResultViewer re-renders from Storage URLs.
6. **Cross-machine**: open instance with empty `public/runs` → past runs + screenshots still load.
7. **Resilience**: bad service-role key → compare still returns a result (insert fails gracefully, logged).
8. **Security**: grep `.next/static` for the service role key — must NOT appear (only anon key).

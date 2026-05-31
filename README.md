# Visual QA Tool — Live vs Test

A local web app to visually compare two webpages (e.g. production vs a migrated
test target). It captures full-page screenshots of both URLs at **desktop** and
**mobile** widths using Playwright, then shows a pixel diff three ways: a diff
**heatmap**, **side-by-side**, and an **onion-skin** opacity slider — with a
percentage difference score per viewport.

## Setup

```bash
npm install
npx playwright install chromium   # one-time: downloads the headless browser (~150MB)
npm run dev
```

Open http://localhost:3000, paste a Live URL and a Test URL, and click
**Run comparison**.

Example:

- Live: `https://www.netapp.com/devops`
- Test: `https://netapp-e25migration.vercel.app/devops`

## Localizations

Enter the **English (default) URLs** once, then toggle the localization codes
you want to test. Each selected code is run as its own comparison, with the code
prepended as the first path segment of both URLs:

- `en` — `https://netapp-e25migration.vercel.app/customers/acens-caso-de-exito/`
- `fr` — `https://netapp-e25migration.vercel.app/fr/customers/acens-caso-de-exito/`

Supported codes: `en, fr, de, es, it, ja, ko, pt, zh-hans, zh-hant`. `en` is the
default and uses the URLs exactly as entered (no prefix). If the URL you paste
already carries a locale prefix, it is stripped and replaced, so the same input
works regardless of which locale you copied it from. Results are grouped by
locale (each tab shows its worst-viewport diff %), then by viewport. Each
selected locale runs both viewports, so the run takes proportionally longer.

## How it works

- `app/api/compare/route.ts` — POST endpoint that launches Chromium, captures
  both pages per locale per viewport, diffs them, and writes PNGs to
  `public/runs/<runId>/<locale>/<viewport>/`.
- `lib/locales.ts` — supported locale codes and `applyLocale()`, which derives a
  locale's URL from the base by inserting the path-prefix segment.
- `lib/capture.ts` — full-page screenshot for one URL + viewport.
- `lib/prepare.ts` — stabilizes each page before the shot (disables animations,
  hides cookie banners, triggers lazy-loaded content, waits for fonts).
- `lib/diff.ts` — pads images to equal size and runs `pixelmatch`.

## Bot protection (important)

By default the tool launches a **visible (headed) Chrome window**. Many
production sites (e.g. anything behind Akamai, including `netapp.com`) detect and
block the headless browser fingerprint, returning an "Access Denied" page. A real
window is far less detectable, so headed mode is required to capture those sites.
A browser window will briefly open during each run — this is expected.

To force headless mode (faster, no window — fine for sites without bot
protection), set the env var:

```bash
HEADLESS=true npm run dev
```

## Notes

- Generated screenshots live under `public/runs/` (git-ignored). Delete that
  folder to clear history.
- Runs locally only — Playwright needs a real browser, which doesn't run on
  serverless platforms like Vercel functions.
- Some sites still block automation or require auth; those pages report a
  per-URL capture error in the results instead of crashing the run.
- A note on the diff %: full pages of differing height are padded to the taller
  size with white before diffing, so a large height difference between the two
  sites inflates the percentage. Use the side-by-side and onion-skin views to
  judge real layout changes.

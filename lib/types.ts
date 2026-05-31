export interface CompareRequest {
  liveUrl: string;
  testUrl: string;
  /** Locale codes to test. Defaults to ["en"] when omitted/empty. */
  locales?: string[];
}

export interface ViewportPreset {
  name: string;
  width: number;
  height: number;
  isMobile: boolean;
  deviceScaleFactor?: number;
  userAgent?: string;
}

/** Result for a single viewport. `error` is set if either capture failed. */
export interface ViewportResult {
  viewport: string;
  width: number;
  liveImage?: string; // public URL e.g. /runs/<id>/desktop/live.png
  testImage?: string;
  diffImage?: string;
  diffPixels?: number;
  diffPercent?: number;
  liveError?: string;
  testError?: string;
}

/** Result for a single locale: the derived URLs and their per-viewport diffs. */
export interface LocaleResult {
  locale: string;
  liveUrl: string;
  testUrl: string;
  viewports: ViewportResult[];
  /** Meta-tag comparison for this locale's URL pair (live = source of truth). */
  meta?: MetaCompareResult;
}

export interface CompareResult {
  runId: string;
  /** Base URLs as entered (before locale derivation). */
  liveUrl: string;
  testUrl: string;
  createdAt: string;
  locales: LocaleResult[];
}

/** Meta-tag comparison (live site = source of truth). */
export type MetaStatus = "match" | "different" | "missing";

export interface MetaRow {
  /** Stable identity, e.g. "name:description", "property:og:title", "charset". */
  key: string;
  /** Identifying attribute: name | property | http-equiv | itemprop | charset. */
  attr: string;
  /** The identifier value shown to the user, e.g. "description", "og:title". */
  label: string;
  /** The live site's content for this tag (the source of truth). */
  liveContent: string;
  /** Normalized markup, e.g. `<meta name="description" content="…" />`. */
  raw: string;
  status: MetaStatus;
  /** The migration's value when it exists but differs (status === "different"). */
  testContent?: string;
}

export interface MetaCompareResult {
  liveUrl: string;
  testUrl: string;
  liveError?: string;
  testError?: string;
  rows: MetaRow[];
  summary: { total: number; matched: number; missing: number; different: number };
}

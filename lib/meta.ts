import type { MetaCompareResult, MetaRow, MetaStatus } from "./types";

// Meta-tag comparison. Fetches both pages' raw HTML server-side (no browser
// needed — meta tags live in the server-rendered <head>), parses every <meta>,
// and compares the migration against the live site, which is the source of
// truth. A realistic User-Agent is sent so sites that sniff bots still serve
// real markup; if a fetch is blocked the row table is empty and an error is
// surfaced per-side.

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FETCH_HEADERS = {
  "User-Agent": DESKTOP_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
};

interface ParsedMeta {
  key: string;
  attr: string;
  label: string;
  content: string;
  raw: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

/** Decode the handful of HTML entities that commonly appear in meta content. */
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

const META_TAG_RE = /<meta\b[^>]*>/gi;
const ATTR_RE =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttrs(tag: string): Record<string, string> {
  const inner = tag.replace(/^<meta\b/i, "").replace(/\/?>$/, "");
  const attrs: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(inner))) {
    if (!m[1]) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    attrs[m[1].toLowerCase()] = decodeEntities(value);
  }
  return attrs;
}

/** Build a normalized ParsedMeta from a raw <meta> tag, or null if unidentifiable. */
function toMeta(tag: string): ParsedMeta | null {
  const attrs = parseAttrs(tag);

  if (attrs.charset != null) {
    return {
      key: "charset",
      attr: "charset",
      label: "charset",
      content: attrs.charset,
      raw: `<meta charset="${attrs.charset}" />`,
    };
  }

  const order: { attr: string }[] = [
    { attr: "name" },
    { attr: "property" },
    { attr: "http-equiv" },
    { attr: "itemprop" },
  ];
  const found = order.find((o) => attrs[o.attr] != null);
  if (!found) return null;

  const id = attrs[found.attr];
  const content = attrs.content ?? "";
  return {
    key: `${found.attr}:${id.toLowerCase()}`,
    attr: found.attr,
    label: id,
    content,
    raw: `<meta ${found.attr}="${id}" content="${content}" />`,
  };
}

function parseMetas(html: string): ParsedMeta[] {
  const out: ParsedMeta[] = [];
  let m: RegExpExecArray | null;
  META_TAG_RE.lastIndex = 0;
  while ((m = META_TAG_RE.exec(html))) {
    const meta = toMeta(m[0]);
    if (meta) out.push(meta);
  }
  return out;
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    return e.name === "AbortError" ? "Request timed out." : e.message;
  }
  return String(e);
}

const STATUS_RANK: Record<MetaStatus, number> = {
  missing: 0,
  different: 1,
  match: 2,
};

/**
 * Fetch both pages and diff their meta tags. Every live meta becomes a row;
 * `status` reflects whether the migration has the same tag with the same
 * content (match), the same tag with different content (different), or no such
 * tag (missing).
 */
export async function compareMeta(
  liveUrl: string,
  testUrl: string
): Promise<MetaCompareResult> {
  const [liveRes, testRes] = await Promise.allSettled([
    fetchHtml(liveUrl),
    fetchHtml(testUrl),
  ]);

  const result: MetaCompareResult = {
    liveUrl,
    testUrl,
    rows: [],
    summary: { total: 0, matched: 0, missing: 0, different: 0 },
  };

  if (liveRes.status === "rejected") result.liveError = errMsg(liveRes.reason);
  if (testRes.status === "rejected") result.testError = errMsg(testRes.reason);

  // Without the live HTML there is no source of truth, so there's nothing to do.
  if (liveRes.status !== "fulfilled") return result;

  const liveMetas = parseMetas(liveRes.value);

  // Index the migration's metas by key → list of contents (a key can repeat,
  // e.g. multiple og:image).
  const testIndex = new Map<string, string[]>();
  if (testRes.status === "fulfilled") {
    for (const meta of parseMetas(testRes.value)) {
      const list = testIndex.get(meta.key) ?? [];
      list.push(meta.content.trim());
      testIndex.set(meta.key, list);
    }
  }

  const rows: MetaRow[] = liveMetas.map((meta) => {
    const liveContent = meta.content.trim();
    const candidates = testIndex.get(meta.key);

    let status: MetaStatus;
    let testContent: string | undefined;
    if (!candidates || candidates.length === 0) {
      status = "missing";
    } else if (candidates.some((c) => c === liveContent)) {
      status = "match";
    } else {
      status = "different";
      testContent = candidates[0];
    }

    return {
      key: meta.key,
      attr: meta.attr,
      label: meta.label,
      liveContent: meta.content,
      raw: meta.raw,
      status,
      testContent,
    };
  });

  // Surface problems first, then matches; stable within each group.
  rows.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  result.rows = rows;
  result.summary = {
    total: rows.length,
    matched: rows.filter((r) => r.status === "match").length,
    missing: rows.filter((r) => r.status === "missing").length,
    different: rows.filter((r) => r.status === "different").length,
  };
  return result;
}

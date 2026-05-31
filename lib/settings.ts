// User-configurable base URLs for the two sites being compared. These let you
// paste just a slug (e.g. "/customers/acens-caso-de-exito") in the compare form
// instead of two full URLs every time.
//
// Persistence model: the database (via /api/settings) is the source of truth so
// the values are shared across devices and survive a browser clear. localStorage
// is kept as a fast local cache — `loadSettings()` returns it synchronously for
// an instant, flash-free first paint, then `fetchSettings()` reconciles against
// the server.

export interface QaSettings {
  /** Base URL of the production/live site, e.g. https://netapp.com */
  liveBase: string;
  /** Base URL of the migration/test site, e.g. https://netapp-e25migration.vercel.app */
  migrationBase: string;
}

export const DEFAULT_SETTINGS: QaSettings = {
  liveBase: "https://netapp.com",
  migrationBase: "https://netapp-e25migration.vercel.app",
};

const STORAGE_KEY = "qa-tool:settings";

export function loadSettings(): QaSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<QaSettings>;
    return {
      liveBase:
        typeof parsed.liveBase === "string" && parsed.liveBase.trim()
          ? parsed.liveBase.trim()
          : DEFAULT_SETTINGS.liveBase,
      migrationBase:
        typeof parsed.migrationBase === "string" && parsed.migrationBase.trim()
          ? parsed.migrationBase.trim()
          : DEFAULT_SETTINGS.migrationBase,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: QaSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function normalize(raw: Partial<QaSettings> | null | undefined): QaSettings {
  return {
    liveBase:
      typeof raw?.liveBase === "string" && raw.liveBase.trim()
        ? raw.liveBase.trim()
        : DEFAULT_SETTINGS.liveBase,
    migrationBase:
      typeof raw?.migrationBase === "string" && raw.migrationBase.trim()
        ? raw.migrationBase.trim()
        : DEFAULT_SETTINGS.migrationBase,
  };
}

/**
 * Fetch the shared settings from the server (source of truth). On success the
 * localStorage cache is refreshed. On any failure it falls back to the cached
 * value, then defaults — the UI never blocks on the network.
 */
export async function fetchSettings(): Promise<QaSettings> {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const settings = normalize((await res.json()) as Partial<QaSettings>);
    saveSettings(settings);
    return settings;
  } catch {
    return loadSettings();
  }
}

/**
 * Persist settings to the server and refresh the localStorage cache. Returns
 * the normalized settings that were saved; throws if the server rejects them.
 */
export async function persistSettings(settings: QaSettings): Promise<QaSettings> {
  const normalized = normalize(settings);
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalized),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to save settings.");
  }
  const saved = normalize((await res.json()) as Partial<QaSettings>);
  saveSettings(saved);
  return saved;
}

/**
 * Join a configured base URL with a slug.
 *
 * - Collapses duplicate slashes at the seam.
 * - If the slug is already a full http(s) URL, it is used as-is (handy for
 *   one-off overrides without editing settings).
 */
export function joinUrl(base: string, slug: string): string {
  const trimmedSlug = slug.trim();
  if (/^https?:\/\//i.test(trimmedSlug)) return trimmedSlug;

  const cleanBase = base.trim().replace(/\/+$/, "");
  if (!trimmedSlug) return cleanBase;
  return `${cleanBase}/${trimmedSlug.replace(/^\/+/, "")}`;
}

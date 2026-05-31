"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  fetchSettings,
  loadSettings,
  persistSettings,
  type QaSettings,
} from "@/lib/settings";

function FieldPreview({ base }: { base: string }) {
  return (
    <span className="mt-1.5 block truncate font-mono text-xs text-text-faint">
      {base.replace(/\/+$/, "")}/customers/acens-caso-de-exito
    </span>
  );
}

export function SettingsForm() {
  // Seed from cache for an instant paint, reconcile with the DB after mount.
  const [settings, setSettings] = useState<QaSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);

  function update<K extends keyof QaSettings>(key: K, value: QaSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function persist(next: QaSettings) {
    setError(null);
    setSaving(true);
    try {
      const result = await persistSettings(next);
      setSettings(result);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        persist(settings);
      }}
      className="panel ticked space-y-7 p-7"
    >
      <label className="block">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint">
          Live site base
          <span className="text-text-faint/60">(live-slug-begin)</span>
        </span>
        <input
          type="url"
          required
          value={settings.liveBase}
          onChange={(e) => update("liveBase", e.target.value)}
          placeholder="https://netapp.com"
          className="field mt-2 w-full px-3.5 py-2.5 font-mono text-sm"
        />
        <FieldPreview base={settings.liveBase} />
      </label>

      <label className="block">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint">
          Migration site base
          <span className="text-text-faint/60">(migration-slug-begin)</span>
        </span>
        <input
          type="url"
          required
          value={settings.migrationBase}
          onChange={(e) => update("migrationBase", e.target.value)}
          placeholder="https://netapp-e25migration.vercel.app"
          className="field mt-2 w-full px-3.5 py-2.5 font-mono text-sm"
        />
        <FieldPreview base={settings.migrationBase} />
      </label>

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <button
          type="submit"
          disabled={saving}
          className="btn-lime px-5 py-2.5 text-sm"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={() => persist(DEFAULT_SETTINGS)}
          disabled={saving}
          className="font-mono text-xs uppercase tracking-[0.12em] text-text-dim transition hover:text-text disabled:opacity-50"
        >
          Reset to defaults
        </button>
        {saved && !saving && (
          <span className="flex items-center gap-1.5 font-mono text-xs text-lime">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-lime" />
            saved
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red/30 bg-red/10 px-3 py-2.5 text-sm text-red">
          {error}
        </p>
      )}
    </form>
  );
}

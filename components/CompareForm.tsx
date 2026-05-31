"use client";

import { useEffect, useState } from "react";
import type { CompareResult } from "@/lib/types";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/locales";
import {
  fetchSettings,
  joinUrl,
  loadSettings,
  type QaSettings,
} from "@/lib/settings";

export function CompareForm({
  onResult,
}: {
  onResult: (result: CompareResult) => void;
}) {
  const [slug, setSlug] = useState("");
  // Seed from the localStorage cache (instant, no flash), then reconcile against
  // the server's shared settings after mount.
  const [settings, setSettings] = useState<QaSettings>(loadSettings);
  const [locales, setLocales] = useState<string[]>([DEFAULT_LOCALE]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);

  const liveUrl = joinUrl(settings.liveBase, slug);
  const testUrl = joinUrl(settings.migrationBase, slug);

  function toggleLocale(code: string) {
    setLocales((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  const allSelected = locales.length === LOCALES.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!slug.trim()) {
      setError("Enter a slug to compare.");
      return;
    }
    if (!locales.length) {
      setError("Select at least one localization code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveUrl, testUrl, locales }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Comparison failed.");
        return;
      }
      onResult(data as CompareResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint">
          Slug
        </label>
        <input
          type="text"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="/customers/acens-caso-de-exito"
          className="field mt-2 w-full px-3.5 py-2.5 font-mono text-sm"
        />
        <div className="mt-3 space-y-1.5 rounded-lg border border-line bg-bg-elev px-3 py-2.5">
          <div className="flex gap-2 text-xs">
            <span className="w-16 shrink-0 font-mono uppercase tracking-wide text-text-faint">
              live
            </span>
            <span className="break-all font-mono text-text-dim">{liveUrl}</span>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="w-16 shrink-0 font-mono uppercase tracking-wide text-text-faint">
              test
            </span>
            <span className="break-all font-mono text-lime/80">{testUrl}</span>
          </div>
        </div>
      </div>

      <fieldset>
        <div className="mb-2.5 flex items-center justify-between">
          <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint">
            Localizations
          </legend>
          <button
            type="button"
            onClick={() =>
              setLocales(allSelected ? [DEFAULT_LOCALE] : [...LOCALES])
            }
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint transition hover:text-text-dim"
          >
            {allSelected ? "reset" : "all"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LOCALES.map((code) => {
            const active = locales.includes(code);
            return (
              <button
                type="button"
                key={code}
                onClick={() => toggleLocale(code)}
                aria-pressed={active}
                className={`rounded-md border px-2.5 py-1 font-mono text-xs uppercase transition ${
                  active
                    ? "border-lime/50 bg-lime/15 text-lime"
                    : "border-line bg-bg-elev text-text-dim hover:border-line-bright hover:text-text"
                }`}
              >
                {code}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-text-faint">
          {locales.length} {locales.length === 1 ? "locale" : "locales"} × 2
          viewports ={" "}
          <span className="font-mono text-text-dim">
            {locales.length * 2} captures
          </span>
          .
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="btn-lime flex w-full items-center justify-center gap-2 px-5 py-3 text-sm"
      >
        {loading ? "Running comparison…" : "Run comparison →"}
      </button>

      {loading && (
        <div className="flex items-center gap-2.5 rounded-lg border border-line bg-bg-elev px-3 py-2.5 text-xs text-text-dim">
          <span className="dot-live inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />
          Capturing full-page screenshots at desktop &amp; mobile — up to a
          minute per site.
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red/30 bg-red/10 px-3 py-2.5 text-sm text-red">
          {error}
        </p>
      )}
    </form>
  );
}

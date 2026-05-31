"use client";

import { useState } from "react";
import type { CompareResult, ViewportResult } from "@/lib/types";
import { DiffScore } from "./DiffScore";
import { OnionSlider } from "./OnionSlider";
import { MetaResultTable } from "./MetaResultTable";

type ResultSection = "screenshots" | "meta";

type ViewMode = "heatmap" | "sidebyside" | "onion";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "heatmap", label: "Heatmap" },
  { id: "sidebyside", label: "Side by side" },
  { id: "onion", label: "Onion skin" },
];

function ImagePane({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex-1">
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
        {label}
      </div>
      <a href={src} target="_blank" rel="noreferrer" className="group block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="block w-full rounded-lg border border-line bg-bg-elev transition group-hover:border-line-bright"
        />
      </a>
    </div>
  );
}

function ViewportPanel({ result }: { result: ViewportResult }) {
  const [mode, setMode] = useState<ViewMode>("heatmap");

  const hasBoth = !!result.liveImage && !!result.testImage;

  return (
    <div>
      {(result.liveError || result.testError) && (
        <div className="mb-4 space-y-1 rounded-lg border border-red/30 bg-red/10 p-3 text-sm text-red">
          {result.liveError && (
            <div>
              <strong className="font-semibold">Live failed:</strong>{" "}
              {result.liveError}
            </div>
          )}
          {result.testError && (
            <div>
              <strong className="font-semibold">Test failed:</strong>{" "}
              {result.testError}
            </div>
          )}
        </div>
      )}

      {typeof result.diffPercent === "number" && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <DiffScore percent={result.diffPercent} />
          {typeof result.diffPixels === "number" && (
            <span className="font-mono text-xs text-text-faint">
              {result.diffPixels.toLocaleString()} px changed
            </span>
          )}
        </div>
      )}

      {hasBoth && (
        <>
          <div className="mb-4 inline-flex rounded-lg border border-line bg-bg-elev p-1">
            {VIEW_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] transition ${
                  mode === m.id
                    ? "bg-lime/15 text-lime"
                    : "text-text-dim hover:text-text"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "heatmap" && result.diffImage && (
            <ImagePane src={result.diffImage} label="Changed pixels (magenta)" />
          )}

          {mode === "sidebyside" && (
            <div className="flex gap-4">
              <ImagePane src={result.liveImage!} label="Live" />
              <ImagePane src={result.testImage!} label="Test" />
            </div>
          )}

          {mode === "onion" && (
            <OnionSlider
              liveSrc={result.liveImage!}
              testSrc={result.testImage!}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Worst (highest) diff percent across a locale's viewports, for the summary. */
function maxDiffPercent(result: { viewports: ViewportResult[] }): number | null {
  const percents = result.viewports
    .map((vp) => vp.diffPercent)
    .filter((p): p is number => typeof p === "number");
  return percents.length ? Math.max(...percents) : null;
}

export function ResultViewer({ result }: { result: CompareResult }) {
  const [activeLocale, setActiveLocale] = useState(0);
  const [activeVp, setActiveVp] = useState(0);
  const [section, setSection] = useState<ResultSection>("screenshots");

  const locale = result.locales[activeLocale];
  const viewport = locale.viewports[activeVp] ?? locale.viewports[0];
  const metaSummary = locale.meta?.summary;
  const metaIssues = metaSummary
    ? metaSummary.missing + metaSummary.different
    : 0;

  return (
    <div className="panel ticked rise p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
          Result
        </span>
        <span className="font-mono text-[11px] text-text-faint">
          {result.runId}
        </span>
      </div>

      {result.locales.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {result.locales.map((loc, i) => {
            const worst = maxDiffPercent(loc);
            const active = activeLocale === i;
            return (
              <button
                key={loc.locale}
                onClick={() => {
                  setActiveLocale(i);
                  setActiveVp(0);
                }}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-xs uppercase transition ${
                  active
                    ? "border-lime/50 bg-lime/15 text-lime"
                    : "border-line bg-bg-elev text-text-dim hover:border-line-bright hover:text-text"
                }`}
              >
                <span>{loc.locale}</span>
                {worst !== null && (
                  <span className="text-text-faint">{worst.toFixed(1)}%</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-5 space-y-1 rounded-lg border border-line bg-bg-elev px-3 py-2.5">
        <div className="flex gap-2 text-xs">
          <span className="w-12 shrink-0 font-mono uppercase tracking-wide text-text-faint">
            live
          </span>
          <span className="break-all font-mono text-text-dim">
            {locale.liveUrl}
          </span>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="w-12 shrink-0 font-mono uppercase tracking-wide text-text-faint">
            test
          </span>
          <span className="break-all font-mono text-lime/80">
            {locale.testUrl}
          </span>
        </div>
      </div>

      {/* Screenshots vs meta-tags section toggle */}
      <div className="mb-5 inline-flex rounded-lg border border-line bg-bg-elev p-1">
        <button
          onClick={() => setSection("screenshots")}
          className={`rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] transition ${
            section === "screenshots"
              ? "bg-lime/15 text-lime"
              : "text-text-dim hover:text-text"
          }`}
        >
          Screenshots
        </button>
        <button
          onClick={() => setSection("meta")}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] transition ${
            section === "meta"
              ? "bg-lime/15 text-lime"
              : "text-text-dim hover:text-text"
          }`}
        >
          Meta tags
          {metaIssues > 0 && (
            <span className="rounded-full bg-red/20 px-1.5 text-[10px] font-semibold text-red">
              {metaIssues}
            </span>
          )}
        </button>
      </div>

      {section === "screenshots" ? (
        <>
          <div className="mb-5 flex gap-1 border-b border-line">
            {locale.viewports.map((vp, i) => (
              <button
                key={vp.viewport}
                onClick={() => setActiveVp(i)}
                className={`-mb-px border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] capitalize transition ${
                  activeVp === i
                    ? "border-lime text-lime"
                    : "border-transparent text-text-faint hover:text-text-dim"
                }`}
              >
                {vp.viewport} · {vp.width}px
              </button>
            ))}
          </div>

          <ViewportPanel result={viewport} />
        </>
      ) : locale.meta ? (
        <MetaResultTable result={locale.meta} />
      ) : (
        <p className="rounded-lg border border-line bg-bg-elev px-4 py-6 text-center text-sm text-text-dim">
          No meta-tag data for this run.
        </p>
      )}
    </div>
  );
}

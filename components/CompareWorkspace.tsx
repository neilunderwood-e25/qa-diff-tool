"use client";

import { useState } from "react";
import { CompareForm } from "@/components/CompareForm";
import { ResultViewer } from "@/components/ResultViewer";
import { RunHistory } from "@/components/RunHistory";
import type { CompareResult } from "@/lib/types";

// Client island for the home page: owns the shared `result` state so the form,
// the result viewer, and the history list all stay in sync. Bumping
// `historyKey` after a fresh run re-fetches the history list. Each run produces
// both the visual diff and the meta-tag audit (shown as tabs in ResultViewer).
export function CompareWorkspace() {
  const [result, setResult] = useState<CompareResult | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  function handleResult(r: CompareResult) {
    setResult(r);
    setHistoryKey((k) => k + 1);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="panel ticked p-6">
          <div className="mb-5 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
              New comparison
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-faint">
              <span className="dot-live inline-block h-1.5 w-1.5 rounded-full bg-lime" />
              ready
            </span>
          </div>
          <CompareForm onResult={handleResult} />
        </div>
      </div>

      <div className="min-w-0">
        {result ? (
          <ResultViewer result={result} />
        ) : (
          <div className="panel grid min-h-[220px] place-items-center p-10 text-center">
            <div>
              <div className="mx-auto mb-4 flex h-12 items-end justify-center gap-1.5">
                {[40, 70, 30, 85, 55].map((h, i) => (
                  <span
                    key={i}
                    className="w-2 rounded-full bg-line-bright"
                    style={{ height: `${h * 0.5}px` }}
                  />
                ))}
              </div>
              <p className="font-display text-sm font-medium tracking-tight text-text-dim">
                No comparison loaded
              </p>
              <p className="mt-1 text-sm text-text-faint">
                Run a slug or open a past run below to see the diff.
              </p>
            </div>
          </div>
        )}

        <RunHistory
          onSelect={setResult}
          onDeleted={(runId) =>
            setResult((cur) => (cur?.runId === runId ? null : cur))
          }
          refreshKey={historyKey}
        />
      </div>
    </div>
  );
}

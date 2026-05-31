"use client";

import { useEffect, useState } from "react";
import type { CompareResult } from "@/lib/types";
import type { RunSummary } from "@/lib/runs";

// "Recent runs" list backed by /api/runs. Fetches summaries on mount (and
// whenever `refreshKey` changes — bumped by the page after a new comparison),
// then loads the full run on click and hands it to `onSelect`.

function toneFor(percent: number | null): { dot: string; text: string } {
  if (percent === null) return { dot: "bg-text-faint", text: "text-text-faint" };
  if (percent >= 2) return { dot: "bg-red", text: "text-red" };
  if (percent >= 0.1) return { dot: "bg-amber", text: "text-amber" };
  return { dot: "bg-lime", text: "text-lime" };
}

export function RunHistory({
  onSelect,
  onDeleted,
  refreshKey,
}: {
  onSelect: (result: CompareResult) => void;
  onDeleted?: (runId: string) => void;
  refreshKey?: number;
}) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  // Run pending delete-confirmation, and the id currently being deleted.
  const [confirmRun, setConfirmRun] = useState<RunSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/runs", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.runs)) setRuns(data.runs as RunSummary[]);
        else setError(data.error ?? "Failed to load run history.");
      })
      .catch(
        (err) =>
          !cancelled &&
          setError(err instanceof Error ? err.message : "Network error.")
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function open(runId: string) {
    setLoadingId(runId);
    setError(null);
    try {
      const res = await fetch(`/api/runs?id=${encodeURIComponent(runId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load run.");
        return;
      }
      onSelect(data as CompareResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoadingId(null);
    }
  }

  async function confirmDelete() {
    if (!confirmRun) return;
    const id = confirmRun.runId;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/runs?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to delete run.");
        return;
      }
      setRuns((prev) => prev.filter((r) => r.runId !== id));
      onDeleted?.(id);
      setConfirmRun(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
          Recent runs
        </h2>
        {runs.length > 0 && (
          <span className="font-mono text-[11px] text-text-faint">
            {runs.length} logged
          </span>
        )}
      </div>

      {loading ? (
        <p className="font-mono text-xs text-text-faint">loading history…</p>
      ) : runs.length === 0 ? (
        <div className="panel px-4 py-6 text-center">
          <p className="text-sm text-text-dim">No runs yet.</p>
          <p className="mt-1 text-xs text-text-faint">
            Run a comparison to start building history.
          </p>
        </div>
      ) : (
        <ul className="panel divide-y divide-line overflow-hidden">
          {runs.map((run) => {
            const tone = toneFor(run.maxDiffPercent);
            return (
              <li key={run.runId} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => open(run.runId)}
                  disabled={loadingId === run.runId}
                  className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left transition hover:bg-panel-2 disabled:opacity-60"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm text-text-dim group-hover:text-text">
                      {run.liveUrl}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-text-faint">
                      {new Date(run.createdAt).toLocaleString()} ·{" "}
                      {run.localeCodes.length || 1}{" "}
                      {run.localeCodes.length === 1 ? "locale" : "locales"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${tone.text}`}
                  >
                    {run.maxDiffPercent === null
                      ? "—"
                      : `${run.maxDiffPercent.toFixed(2)}%`}
                  </span>
                  {/* spacer keeps the score clear of the hover trash button */}
                  <span className="w-8 shrink-0" />
                </button>

                {/* hover-reveal delete */}
                <button
                  type="button"
                  onClick={() => setConfirmRun(run)}
                  disabled={deletingId === run.runId}
                  aria-label="Delete run"
                  title="Delete run"
                  className="absolute right-3 grid h-7 w-7 place-items-center rounded-md border border-transparent text-text-faint opacity-0 transition focus:opacity-100 focus:outline-none group-hover:opacity-100 hover:border-red/40 hover:bg-red/10 hover:text-red disabled:opacity-60"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red/30 bg-red/10 px-3 py-2.5 text-sm text-red">
          {error}
        </p>
      )}

      {confirmRun && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete run"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={() => deletingId || setConfirmRun(null)}
        >
          <div
            className="panel ticked rise w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-red/40 bg-red/10 text-red">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold tracking-tight text-text">
                  Delete this run?
                </h3>
                <p className="mt-1 break-all font-mono text-xs text-text-faint">
                  {confirmRun.liveUrl}
                </p>
                <p className="mt-2 text-sm text-text-dim">
                  This permanently removes the run and its screenshots. This
                  can&apos;t be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmRun(null)}
                disabled={!!deletingId}
                className="font-mono text-xs uppercase tracking-[0.12em] text-text-dim transition hover:text-text disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={!!deletingId}
                className="rounded-lg border border-red/50 bg-red/15 px-4 py-2 text-sm font-semibold text-red transition hover:bg-red/25 disabled:opacity-60"
              >
                {deletingId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

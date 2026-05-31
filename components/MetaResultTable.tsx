import type { MetaCompareResult, MetaRow } from "@/lib/types";

// Renders a meta-tag comparison: left column Yes/No (is it on the migration?),
// right column the live site's <meta> markup (the source of truth). Shared by
// the run result viewer.

function MetaTagMarkup({ row }: { row: MetaRow }) {
  return (
    <code className="block break-all font-mono text-xs leading-relaxed text-text-dim">
      <span className="text-text-faint">&lt;meta </span>
      <span className="text-cyan">{row.attr}</span>
      <span className="text-text-faint">=</span>
      <span className="text-text">&quot;{row.label}&quot;</span>
      {row.attr !== "charset" && (
        <>
          <span className="text-text-faint"> content=</span>
          <span className="text-lime/90">&quot;{row.liveContent}&quot;</span>
        </>
      )}
      <span className="text-text-faint"> /&gt;</span>
    </code>
  );
}

const STATUS_BADGE: Record<
  MetaRow["status"],
  { label: string; className: string }
> = {
  match: { label: "Yes", className: "border-lime/40 bg-lime/10 text-lime" },
  different: {
    label: "Validate",
    className: "border-amber/40 bg-amber/10 text-amber",
  },
  missing: { label: "No", className: "border-red/40 bg-red/10 text-red" },
};

function StatusCell({ row }: { row: MetaRow }) {
  const badge = STATUS_BADGE[row.status];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

export function MetaResultTable({ result }: { result: MetaCompareResult }) {
  const { summary } = result;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      {/* summary header */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-bg-elev px-5 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
          {summary.total} live meta {summary.total === 1 ? "tag" : "tags"}
        </span>
        <span className="font-mono text-xs text-lime">
          {summary.matched} matched
        </span>
        {summary.different > 0 && (
          <span className="font-mono text-xs text-amber">
            {summary.different} different
          </span>
        )}
        {summary.missing > 0 && (
          <span className="font-mono text-xs text-red">
            {summary.missing} missing
          </span>
        )}
      </div>

      {result.liveError && (
        <p className="border-b border-line bg-red/10 px-5 py-2.5 text-sm text-red">
          Couldn&apos;t fetch the live site: {result.liveError}
        </p>
      )}
      {result.testError && (
        <p className="border-b border-line bg-amber/10 px-5 py-2.5 text-sm text-amber">
          Couldn&apos;t fetch the migration site: {result.testError} — every tag
          shows as missing.
        </p>
      )}

      {/* column headers */}
      <div className="flex items-center gap-4 border-b border-line px-5 py-2.5">
        <span className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
          On mig.
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
          Live site meta (source of truth)
        </span>
      </div>

      {result.rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-text-dim">
          No meta tags found on the live site.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {result.rows.map((row, i) => (
            <li key={`${row.key}-${i}`} className="flex gap-4 px-5 py-3.5">
              <span className="w-20 shrink-0 pt-0.5">
                <StatusCell row={row} />
              </span>
              <span className="min-w-0 flex-1">
                <MetaTagMarkup row={row} />
                {row.status === "different" && (
                  <span className="mt-1.5 block break-all font-mono text-[11px] text-amber">
                    migration: &quot;{row.testContent}&quot;
                  </span>
                )}
                {row.status === "missing" && (
                  <span className="mt-1.5 block font-mono text-[11px] text-red">
                    not present on migration
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

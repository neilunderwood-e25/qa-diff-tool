export function DiffScore({ percent }: { percent: number }) {
  // Thresholds: <0.1% effectively identical, <2% minor, else significant.
  let tone =
    "border-lime/40 bg-lime/10 text-lime [--bar:var(--lime)]";
  let label = "Match";
  if (percent >= 2) {
    tone = "border-red/40 bg-red/10 text-red [--bar:var(--red)]";
    label = "Significant";
  } else if (percent >= 0.1) {
    tone = "border-amber/40 bg-amber/10 text-amber [--bar:var(--amber)]";
    label = "Minor drift";
  }

  // Width caps at 100% for the inline magnitude bar.
  const w = Math.min(100, percent);

  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-lg border px-3 py-1.5 ${tone}`}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
        {label}
      </span>
      <span className="h-1 w-12 overflow-hidden rounded-full bg-current/20">
        <span
          className="block h-full rounded-full"
          style={{ width: `${w}%`, background: "var(--bar)" }}
        />
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums">
        {percent.toFixed(2)}%
      </span>
    </span>
  );
}

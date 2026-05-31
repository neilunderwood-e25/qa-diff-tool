// Left-hand showcase panel for the auth screens: the product wordmark plus a
// faux "instrument readout" — animated pixel-drift bars and a scanline — that
// sells the Precision Instrument identity before the user is even logged in.

const BARS = [
  { w: "92%", v: "4.21", tone: "var(--red)" },
  { w: "68%", v: "2.04", tone: "var(--amber)" },
  { w: "34%", v: "0.88", tone: "var(--lime)" },
  { w: "12%", v: "0.09", tone: "var(--lime)" },
  { w: "78%", v: "2.97", tone: "var(--amber)" },
];

export function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* scanline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-lime/10 to-transparent"
        style={{ animation: "scan 4.5s linear infinite" }}
      />

      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-lime/40 bg-lime/10 text-lime">
            <span className="text-lg leading-none">▦</span>
          </span>
          <span className="font-display text-sm font-bold tracking-[0.3em] text-text">
            PIXELDRIFT
          </span>
        </div>

        <h1 className="mt-16 max-w-md font-display text-4xl font-semibold leading-[1.15] tracking-tight text-text">
          See every
          <br />
          <span className="text-lime">pixel of drift</span>
          <br />
          before it ships.
        </h1>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-text-dim">
          A measurement instrument for visual regression. Capture live vs
          migration at every viewport and locale, diff to the pixel, and keep a
          permanent record.
        </p>
      </div>

      {/* faux readout */}
      <div className="relative mt-12">
        <div className="mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint">
          <span>pixel drift / live readout</span>
          <span className="flex items-center gap-1.5 text-lime">
            <span className="dot-live inline-block h-1.5 w-1.5 rounded-full bg-lime" />
            sampling
          </span>
        </div>
        <div className="space-y-2.5">
          {BARS.map((b, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-10 shrink-0 font-mono text-[11px] text-text-faint">
                vp{i + 1}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: b.w,
                    background: b.tone,
                    animation: `rise 0.7s cubic-bezier(0.16,1,0.3,1) ${
                      0.15 * i
                    }s both`,
                  }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-[11px] text-text-dim">
                {b.v}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

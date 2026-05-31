"use client";

import { useState } from "react";

/**
 * Onion-skin overlay: the Test image is layered over the Live image and a
 * slider controls its opacity, making layout shifts easy to spot.
 */
export function OnionSlider({
  liveSrc,
  testSrc,
}: {
  liveSrc: string;
  testSrc: string;
}) {
  const [opacity, setOpacity] = useState(0.5);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 font-mono text-xs text-text-dim">
        <span className="uppercase tracking-[0.12em] text-text-faint">live</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="rng w-64"
          aria-label="Test image opacity"
        />
        <span className="uppercase tracking-[0.12em] text-lime">test</span>
        <span className="tabular-nums text-text-faint">
          {Math.round(opacity * 100)}%
        </span>
      </div>
      <div className="relative inline-block overflow-auto rounded-lg border border-line bg-bg-elev">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={liveSrc} alt="Live" className="block max-w-full" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={testSrc}
          alt="Test overlay"
          className="absolute left-0 top-0 block max-w-full"
          style={{ opacity }}
        />
      </div>
    </div>
  );
}

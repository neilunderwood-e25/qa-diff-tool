import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export interface DiffResult {
  diffBuffer: Buffer;
  diffPixels: number;
  diffPercent: number;
  width: number;
  height: number;
}

/**
 * Copy a source PNG's pixels into a new white-filled canvas of `width`x`height`,
 * anchored top-left. Lets us diff two images of different sizes.
 */
function padToCanvas(src: PNG, width: number, height: number): PNG {
  const out = new PNG({ width, height });
  out.data.fill(0xff); // opaque white
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (src.width * y + x) << 2;
      const di = (width * y + x) << 2;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

/**
 * Pixel-diff two PNG buffers. Images are normalized to the larger of the two
 * dimensions (padded with white) before comparison. Returns a magenta diff
 * image plus the changed-pixel count and percentage.
 */
export function diffPngs(liveBuf: Buffer, testBuf: Buffer): DiffResult {
  const live = PNG.sync.read(liveBuf);
  const test = PNG.sync.read(testBuf);

  const width = Math.max(live.width, test.width);
  const height = Math.max(live.height, test.height);

  const a = padToCanvas(live, width, height);
  const b = padToCanvas(test, width, height);
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: 0.1,
    alpha: 0.3,
    diffColor: [255, 0, 255],
    includeAA: false,
  });

  const total = width * height;
  return {
    diffBuffer: PNG.sync.write(diff),
    diffPixels,
    diffPercent: total === 0 ? 0 : (diffPixels / total) * 100,
    width,
    height,
  };
}

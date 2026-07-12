// Deterministic generative art for NFTs — a data-URI SVG derived purely from a seed string, so
// there are no external image assets to host or fetch. Same seed → same art, every render.

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Small seeded PRNG (mulberry32) so a seed yields a stable sequence.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An inline SVG (string) for the given seed — a soft gradient with a few floating shapes. */
export function nftArtSvg(seed: string, size = 320): string {
  const r = rng(hash(seed));
  const h1 = Math.floor(r() * 360);
  const h2 = (h1 + 40 + Math.floor(r() * 120)) % 360;
  const bgA = `hsl(${h1} 70% 22%)`;
  const bgB = `hsl(${h2} 75% 14%)`;

  const shapes: string[] = [];
  const count = 3 + Math.floor(r() * 4);
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(r() * size);
    const cy = Math.floor(r() * size);
    const rad = 30 + Math.floor(r() * (size / 3));
    const hue = (h1 + Math.floor(r() * 160)) % 360;
    const op = (0.18 + r() * 0.4).toFixed(2);
    if (r() > 0.5) {
      shapes.push(`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="hsl(${hue} 85% 60%)" opacity="${op}"/>`);
    } else {
      const s = rad;
      const rot = Math.floor(r() * 90);
      shapes.push(
        `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="${Math.floor(s / 6)}" fill="hsl(${hue} 85% 62%)" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bgA}"/>
      <stop offset="1" stop-color="${bgB}"/>
    </linearGradient>
    <filter id="b"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <g filter="url(#b)">${shapes.join("")}</g>
</svg>`;
}

/** The same art as a data: URI, for use in an <img src>. */
export function nftArtDataUri(seed: string, size = 320): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(nftArtSvg(seed, size))}`;
}

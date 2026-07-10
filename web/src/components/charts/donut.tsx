// Lightweight allocation donut — pure SVG, no chart dependency. Renders proportional arcs
// with a categorical palette; segments below a threshold roll into "Other".

export type DonutSegment = { label: string; value: number };

// Distinct, dark-mode-legible categorical hues (brand green leads).
const PALETTE = [
  "#18C964", "#2563EB", "#F59E0B", "#A855F7", "#EC4899",
  "#14B8A6", "#F97316", "#64748B", "#84CC16", "#06B6D4",
];

export function Donut({
  segments,
  size = 180,
  thickness = 22,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-border-subtle text-xs text-foreground-muted"
        style={{ width: size, height: size }}
      >
        No holdings
      </div>
    );
  }

  // Roll tiny slices (<2%) into "Other".
  const sorted = [...segments].sort((a, b) => b.value - a.value);
  const major = sorted.filter((s) => s.value / total >= 0.02);
  const otherVal = sorted
    .filter((s) => s.value / total < 0.02)
    .reduce((s, x) => s + x.value, 0);
  const shown = otherVal > 0 ? [...major, { label: "Other", value: otherVal }] : major;

  let offset = 0;
  const arcs = shown.map((seg, i) => {
    const frac = seg.value / total;
    const len = frac * circ;
    const arc = (
      <circle
        key={seg.label}
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={PALETTE[i % PALETTE.length]}
        strokeWidth={thickness}
        strokeDasharray={`${len} ${circ - len}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${c} ${c})`}
      />
    );
    offset += len;
    return arc;
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-border-subtle)" strokeWidth={thickness} />
        {arcs}
      </svg>
      <ul className="flex flex-col gap-1.5 text-sm">
        {shown.map((seg, i) => (
          <li key={seg.label} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <span className="font-medium">{seg.label}</span>
            <span className="font-mono text-xs tabular-nums text-foreground-muted">
              {((seg.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

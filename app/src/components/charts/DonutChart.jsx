import { useEffect, useState } from "react";
import { fmtNum, fmtPct } from "../../logic/format";

// Porte 1:1 de donutChart() do HTML original.
export function DonutChart({ data, onClick, size = 150, thick = 20 }) {
  const r = (size - thick) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  const total = data.reduce((a, d) => a + (d.value || 0), 0);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(false);
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setAnimated(true));
      return id2;
    });
    return () => cancelAnimationFrame(id1);
  }, [data]);

  if (!total) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={thick} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fill="var(--muted)">sem dados</text>
      </svg>
    );
  }

  let offset = 0;
  const segments = data.filter((d) => d.value).map((d, i) => {
    const frac = d.value / total, len = frac * circ;
    const el = (
      <circle
        key={d.label + i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thick}
        strokeDasharray={`${animated ? len : 0} ${circ}`} strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ cursor: onClick ? "pointer" : "default", transition: "opacity .15s ease, stroke-dasharray .9s cubic-bezier(.22,.61,.36,1)" }}
        onClick={onClick ? () => onClick(d) : undefined}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = ".72"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        <title>{`${d.label}: ${fmtNum(d.value)} (${fmtPct(frac * 100)})`}</title>
      </circle>
    );
    offset += len;
    return el;
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {segments}
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-display)">{fmtNum(total)}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9.5" fill="var(--muted)">total</text>
    </svg>
  );
}

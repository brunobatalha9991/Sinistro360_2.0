import { useEffect, useRef } from "react";
import { fmtNum, monthLabel } from "../../logic/format";

function Series({ s, x, y, labels, onClick }) {
  const ref = useRef(null);

  useEffect(() => {
    const poly = ref.current;
    if (!poly) return;
    try {
      const len = poly.getTotalLength();
      poly.style.strokeDasharray = `${len} ${len}`;
      poly.style.strokeDashoffset = String(len);
      poly.style.transition = "stroke-dashoffset 1s cubic-bezier(.22,.61,.36,1)";
      const id = requestAnimationFrame(() => requestAnimationFrame(() => { poly.style.strokeDashoffset = "0"; }));
      return () => cancelAnimationFrame(id);
    } catch { /* ignore */ }
  }, [s]);

  if (!s) return null;
  const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <>
      <polyline ref={ref} points={pts} fill="none" stroke={s.color} strokeWidth={2.3} strokeLinejoin="round" strokeLinecap="round" />
      {s.values.map((v, i) => (
        <circle
          key={i} cx={x(i)} cy={y(v)} r={3.2} fill={s.color}
          style={{ cursor: onClick ? "pointer" : "default" }}
          onClick={onClick ? () => onClick(labels[i]) : undefined}
        >
          <title>{`${monthLabel(labels[i])} — ${s.name}: ${fmtNum(v)}`}</title>
        </circle>
      ))}
    </>
  );
}

// Porte 1:1 de lineChartDual() do HTML original.
export function LineChartDual({ labels, seriesA, seriesB, onClick, w = 620, h = 210 }) {
  const pad = { l: 32, r: 12, t: 16, b: 24 };
  const innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;
  const allVals = seriesA.values.concat(seriesB ? seriesB.values : []);
  let max = Math.max(...allVals, 1);
  max = Math.ceil(max * 1.2) || 1;
  const n = labels.length;
  const x = (i) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => pad.t + innerH - (v / max) * innerH;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="xMidYMid meet">
      {[0, 1, 2, 3].map((g) => {
        const gy = pad.t + innerH - (g / 3) * innerH;
        return (
          <g key={g}>
            <line x1={pad.l} x2={w - pad.r} y1={gy} y2={gy} stroke="var(--border-soft)" strokeWidth={1} />
            <text x={0} y={gy + 3} fontSize="8.5" fill="var(--muted-soft)">{fmtNum(Math.round((max * g) / 3))}</text>
          </g>
        );
      })}
      {labels.map((lb, i) => {
        if (n > 8 && i % 2 !== 0 && i !== n - 1) return null;
        return <text key={lb} x={x(i)} y={h - 6} fontSize="8.5" fill="var(--muted-soft)" textAnchor="middle">{monthLabel(lb)}</text>;
      })}
      <Series s={seriesA} x={x} y={y} labels={labels} onClick={onClick} />
      <Series s={seriesB} x={x} y={y} labels={labels} onClick={onClick} />
    </svg>
  );
}

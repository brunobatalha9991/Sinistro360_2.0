import { useEffect, useState } from "react";
import { fmtNum, PALETTE } from "../../logic/format";
import { EmptyState } from "../EmptyState.jsx";

// Porte 1:1 de rankList() do HTML original.
export function RankList({ data, onClick, fmt }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(false);
    const id1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimated(true));
    });
    return () => cancelAnimationFrame(id1);
  }, [data]);

  if (!data.length) return <EmptyState>Sem dados para este recorte.</EmptyState>;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rank-list">
      {data.map((d, i) => {
        const pct = max ? Math.max(3, Math.round((d.value / max) * 100)) : 0;
        const color = d.color || PALETTE[i % PALETTE.length];
        return (
          <div
            key={d.label + i} className="rank-item"
            title={onClick ? `Ver sinistros de "${d.label}"` : ""}
            onClick={onClick ? () => onClick(d) : undefined}
          >
            <span className="rk-label">{d.label}</span>
            <div className="rk-bar-wrap">
              <div className="rk-bar" style={{ width: (animated ? pct : 0) + "%", background: color }} />
            </div>
            <span className="rk-val">{fmt ? fmt(d.value) : fmtNum(d.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

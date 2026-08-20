import { fmtNum } from "../../logic/format";

// Porte 1:1 de legendFor() do HTML original.
export function Legend({ data, onClick }) {
  return (
    <div className="legend">
      {data.map((d, i) => (
        <div key={d.label + i} className="legend-item" onClick={onClick ? () => onClick(d) : undefined}>
          <span className="legend-dot" style={{ background: d.color, color: d.color }} />
          <span className="lt">{d.label}</span>
          <span className="lv">{fmtNum(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

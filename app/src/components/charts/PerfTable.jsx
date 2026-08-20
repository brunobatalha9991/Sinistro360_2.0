import { fmtPct } from "../../logic/format";

// Porte 1:1 de pbarCell() do HTML original.
export function PbarCell({ pct, color }) {
  pct = Math.max(0, Math.min(100, pct || 0));
  return (
    <span>
      <span className="pbar-wrap"><span className="pbar" style={{ width: pct + "%", background: color || "#2563eb" }} /></span>
      {fmtPct(pct)}
    </span>
  );
}

// Porte 1:1 de perfTable() do HTML original. rows: [{ onClick, cells: [<td/>, ...] }]
export function PerfTable({ headers, rows }) {
  return (
    <div className="perf-table-wrap">
      <table className="perf-table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.onClick ? "clickable" : ""} onClick={r.onClick}>
              {r.cells}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

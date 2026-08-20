import { useState } from "react";
import { DEFAULT_COLS } from "../logic/columnPrefs";

// Porte 1:1 de columnPicker() do HTML original.
export function ColumnPicker({ allCols, pref, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className={"btn" + (open ? "" : " sec") + " sm"} style={{ marginBottom: 10 }} onClick={() => setOpen(!open)}>
        {open ? "▲ Ocultar colunas" : "▤ Colunas"}
      </button>
      {open && (
        <div className="chips" style={{ padding: 10, border: "1px dashed var(--line)", borderRadius: 8, marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 12, marginRight: 6, alignSelf: "center" }}>Colunas:</span>
          {allCols.map((col) => {
            const on = pref.order.indexOf(col.key) >= 0;
            return (
              <div
                key={col.key} className={"chip-btn" + (on ? " active" : "")}
                onClick={() => {
                  const o = on ? pref.order.filter((k) => k !== col.key) : [...pref.order, col.key];
                  onChange({ ...pref, order: o });
                }}
              >
                {(on ? "✓ " : "+ ") + col.label}
              </div>
            );
          })}
          <button className="btn sec xs" style={{ marginLeft: 6 }} onClick={() => onChange(JSON.parse(JSON.stringify(DEFAULT_COLS)))}>
            Restaurar padrão
          </button>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";

// Porte 1:1 de claimsTable() do HTML original, com um acréscimo: cabeçalho
// com colunas reordenáveis por arrastar, redimensionáveis por arrastar a
// borda, e agora também ordenáveis por clique (maior→menor / A→Z, alterna
// a cada clique na mesma coluna).
function Th({ col, width, sortDir, onDropCol, onResize, onSort }) {
  function handleDragStart(e) { e.dataTransfer.setData("text/plain", col.key); }
  function handleDragOver(e) { e.preventDefault(); }
  function handleDrop(e) {
    e.preventDefault();
    const from = e.dataTransfer.getData("text/plain");
    if (from) onDropCol(from, col.key);
  }
  function handleMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.parentElement;
    const startX = e.clientX, startW = th.offsetWidth;
    function mv(ev) {
      const w = Math.max(60, startW + (ev.clientX - startX));
      th.style.width = w + "px";
      th.style.minWidth = w + "px";
    }
    function up() {
      document.removeEventListener("mousemove", mv);
      document.removeEventListener("mouseup", up);
      onResize(col.key, th.offsetWidth);
    }
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
  }
  const sortable = typeof col.sortValue === "function";
  return (
    <th
      draggable style={{ position: "relative", cursor: "move", ...(width ? { width, minWidth: width } : {}) }}
      onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}
    >
      {sortable ? (
        <span
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, userSelect: "none" }}
          title="Clique para ordenar"
          onClick={() => onSort(col.key)}
        >
          {col.label}
          <span style={{ fontSize: 10, opacity: sortDir ? 1 : .35 }}>{sortDir === "desc" ? "▼" : "▲"}</span>
        </span>
      ) : col.label}
      <span
        style={{ position: "absolute", right: 0, top: 0, height: "100%", width: 6, cursor: "col-resize", userSelect: "none" }}
        onMouseDown={handleMouseDown}
      />
    </th>
  );
}

export function ClaimsTable({ rows, allCols, pref, onPrefChange }) {
  const cols = pref.order.map((k) => allCols.find((c) => c.key === k)).filter(Boolean);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  function handleDropCol(from, to) {
    if (from === to) return;
    const o = pref.order.slice();
    const fi = o.indexOf(from), ti = o.indexOf(to);
    if (fi < 0 || ti < 0) return;
    o.splice(fi, 1);
    o.splice(ti, 0, from);
    onPrefChange({ ...pref, order: o });
  }
  function handleResize(key, width) {
    onPrefChange({ ...pref, widths: { ...pref.widths, [key]: width } });
  }
  function handleSort(key) {
    if (sortKey === key) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); }
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sortedRows = useMemo(() => {
    const col = cols.find((c) => c.key === sortKey);
    if (!col || typeof col.sortValue !== "function") return rows;
    const withVal = rows.map((c) => ({ c, v: col.sortValue(c) }));
    withVal.sort((a, b) => {
      const av = a.v, bv = b.v;
      let cmp;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "pt-BR", { numeric: true, sensitivity: "base" });
      return sortDir === "desc" ? -cmp : cmp;
    });
    return withVal.map((x) => x.c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir]);

  return (
    <div style={{ overflow: "auto" }}>
      <table>
        <thead>
          <tr>
            {cols.map((col) => (
              <Th key={col.key} col={col} width={pref.widths[col.key]} sortDir={sortKey === col.key ? sortDir : null} onDropCol={handleDropCol} onResize={handleResize} onSort={handleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((c) => (
            <tr key={c.id}>{cols.map((col) => <td key={col.key}>{col.cell(c)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Porte 1:1 de claimsTable() do HTML original: cabeçalho com colunas
// reordenáveis por arrastar e redimensionáveis por arrastar a borda.
function Th({ col, width, onDropCol, onResize }) {
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
  return (
    <th
      draggable style={{ position: "relative", cursor: "move", ...(width ? { width, minWidth: width } : {}) }}
      onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}
    >
      {col.label}
      <span
        style={{ position: "absolute", right: 0, top: 0, height: "100%", width: 6, cursor: "col-resize", userSelect: "none" }}
        onMouseDown={handleMouseDown}
      />
    </th>
  );
}

export function ClaimsTable({ rows, allCols, pref, onPrefChange }) {
  const cols = pref.order.map((k) => allCols.find((c) => c.key === k)).filter(Boolean);

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

  return (
    <div style={{ overflow: "auto" }}>
      <table>
        <thead>
          <tr>
            {cols.map((col) => (
              <Th key={col.key} col={col} width={pref.widths[col.key]} onDropCol={handleDropCol} onResize={handleResize} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>{cols.map((col) => <td key={col.key}>{col.cell(c)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

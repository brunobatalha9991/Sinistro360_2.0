import { useState } from "react";

// Chips de status com editar/excluir/adicionar — usado em Vistoria, em cada
// etapa de Perda Parcial/Integral e nas etapas de Atendimento.
export function StatusChipsEditor({ options, onChange }) {
  const [draft, setDraft] = useState("");

  function editar(i, atual) {
    const nv = prompt("Editar status:", atual);
    if (nv) { const next = [...options]; next[i] = nv.trim(); onChange(next); }
  }
  function excluir(i) { onChange(options.filter((_, idx) => idx !== i)); }
  function adicionar() {
    const v = draft.trim();
    if (v) { onChange([...options, v]); setDraft(""); }
  }

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {options.map((op, i) => (
          <span key={op + i} className="badge gray" style={{ gap: 6 }}>
            <span>{op}</span>
            <a onClick={() => editar(i, op)}>✎</a>
            <a style={{ color: "var(--danger)" }} onClick={() => excluir(i)}>✕</a>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input className="inline" placeholder="Novo status..." style={{ minWidth: 150 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn sec xs" onClick={adicionar}>+ Status</button>
      </div>
    </>
  );
}

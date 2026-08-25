import { useState } from "react";
import { campoEfetivo, campoFoiEditado } from "../logic/claims";

// Porte 1:1 de editableCell() do HTML original: clique no valor ou no lápis
// abre um input/select; salva ao sair do campo (ou ao trocar, no caso do
// select); Escape cancela sem salvar.
export function EditableCell({ c, campo, overrides, canEdit, onCommit, type, options, emptyLabel, novoLabel, promptMsg, className }) {
  const [editing, setEditing] = useState(false);
  const valAtual = campoEfetivo(overrides, c, campo);
  const edited = campoFoiEditado(overrides, c, campo);

  function openEditor() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    setEditing(true);
  }
  function commit(v) { onCommit(v); setEditing(false); }

  if (!editing) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {edited && <span className="tag-manual">editado</span>}
        <span className={className} style={{ cursor: "pointer" }} onClick={openEditor}>
          {valAtual == null || String(valAtual).trim() === "" ? "—" : String(valAtual)}
        </span>
        <a title="Editar" style={{ opacity: 0.6, cursor: "pointer" }} onClick={openEditor}>✎</a>
      </span>
    );
  }

  if (type === "select") {
    const names = [...(options || [])];
    if (valAtual && names.indexOf(valAtual) < 0) names.unshift(valAtual);
    return (
      <select
        className="inline" style={{ minWidth: 180 }} autoFocus defaultValue={valAtual || ""}
        onChange={(e) => {
          if (e.target.value === "__nova__") {
            const nv = window.prompt(promptMsg || "Novo valor:");
            if (nv && nv.trim()) commit(nv.trim()); else setEditing(false);
          } else { commit(e.target.value); }
        }}
        onBlur={() => setTimeout(() => setEditing(false), 150)}
      >
        <option value="">{"— " + (emptyLabel || "Nenhum") + " —"}</option>
        {names.map((n) => <option key={n} value={n}>{n}</option>)}
        <option value="__nova__">{novoLabel || "+ Novo..."}</option>
      </select>
    );
  }

  return (
    <input
      className="inline" type={type || "text"} style={{ minWidth: 180 }} autoFocus
      defaultValue={valAtual == null ? "" : valAtual}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(false); }}
    />
  );
}

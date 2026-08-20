import { useEffect, useState } from "react";
import { getNextAction } from "../../logic/claims";
import { fmtDateBR } from "../../logic/format";

// Porte 1:1 de nextActionPanel() do HTML original.
export function NextActionPanel({ c, overrides, actions, canEdit }) {
  const atual = getNextAction(overrides, c.id);
  const [titulo, setTitulo] = useState(atual?.title || "");
  const [desc, setDesc] = useState(atual?.desc || "");
  const [data, setData] = useState(atual?.date || "");
  useEffect(() => {
    const na = getNextAction(overrides, c.id);
    setTitulo(na?.title || ""); setDesc(na?.desc || ""); setData(na?.date || "");
  }, [c.id]);

  function salvar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    const t = titulo.trim();
    if (!t) { alert("Informe o título da próxima ação."); return; }
    const obj = { title: t, desc: desc.trim(), date: data || "" };
    actions.saveNextAction(c.id, obj);
    actions.logAudit(c.id, "Próxima ação definida", obj.title + (obj.date ? ` — prazo ${fmtDateBR(obj.date)}` : ""));
  }
  function concluir() {
    actions.saveNextAction(c.id, null);
    actions.logAudit(c.id, "Próxima ação concluída/removida", "");
    setTitulo(""); setDesc(""); setData("");
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Próxima ação</h3>
        <span className="tag-manual">Registro manual preservado na sincronização</span>
      </div>
      {atual && atual.title && (
        <div style={{ background: "rgba(var(--brand-rgb),.08)", border: "1px solid rgba(var(--brand-rgb),.28)", borderRadius: 8, padding: 12, margin: "10px 0" }}>
          <div style={{ fontWeight: 700 }}>{atual.title}</div>
          <div className="muted" style={{ fontSize: 12, margin: "2px 0" }}>{atual.date ? `Prazo: ${fmtDateBR(atual.date)}` : "Sem prazo definido"}</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap", marginTop: 4 }}>{atual.desc || ""}</div>
        </div>
      )}
      <div className="field"><label>Título da próxima ação</label><input placeholder="Título da próxima ação" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
      <div className="field"><label>Descrição da próxima ação</label><textarea rows={3} placeholder="Descrição da próxima ação" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="field"><label>Data da próxima ação</label><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={salvar}>Salvar próxima ação</button>
        {atual && <button className="btn sec" onClick={concluir}>Concluir / limpar</button>}
      </div>
    </div>
  );
}

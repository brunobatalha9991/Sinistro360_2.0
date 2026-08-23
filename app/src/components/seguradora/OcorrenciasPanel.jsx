import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { ProcSearch } from "../ProcSearch.jsx";
import { downloadCSV } from "../../logic/csvImport";
import { fmtDateBR, todayISO, txt } from "../../logic/format";

const TIPO_LABEL = { reclamacao: "Reclamação", feedback: "Feedback" };
const TIPO_BADGE = { reclamacao: "red", feedback: "blue" };

// Reclamações e feedbacks da seguradora (corp_seguradora_ocorrencias), com
// vínculo opcional a um processo existente, filtro De/Até e exportação em
// CSV do período filtrado — a pedido do usuário.
export function OcorrenciasPanel({ seguradoraId, claims, actions, canEdit, navigate }) {
  const [tipo, setTipo] = useState("reclamacao");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(todayISO());
  const [claimId, setClaimId] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const todas = actions.ocorrencias.filter((o) => o.seguradoraId === seguradoraId);
  const filtradas = todas.filter((o) => {
    if (de && (!o.data || o.data < de)) return false;
    if (ate && (!o.data || o.data > ate)) return false;
    return true;
  }).slice().sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  function registrar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    if (!titulo.trim()) { alert("Informe um título."); return; }
    actions.addOcorrencia(seguradoraId, { tipo, titulo, descricao, data, claimId: claimId || null });
    setTitulo(""); setDescricao(""); setClaimId("");
  }

  function exportarCsv() {
    const header = ["Tipo", "Título", "Descrição", "Data", "Status", "Nº Sinistro vinculado", "Registrado por", "Registrado em"];
    const rows = [header].concat(filtradas.map((o) => {
      const c = o.claimId ? claims.find((x) => x.id === o.claimId) : null;
      return [TIPO_LABEL[o.tipo] || o.tipo, o.titulo, o.descricao, fmtDateBR(o.data), o.status, c ? (c.numsin || "#" + c.nosnum) : "", o.who, o.at];
    }));
    downloadCSV(`ocorrencias_seguradora_${seguradoraId}.csv`, rows);
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Registrar reclamação ou feedback</h3>
      <div className="grid c2">
        <div className="field">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="reclamacao">Reclamação</option>
            <option value="feedback">Feedback</option>
          </select>
        </div>
        <div className="field"><label>Data</label><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
      </div>
      <div className="field"><label>Título</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Resumo curto" /></div>
      <div className="field"><label>Descrição</label><textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
      <div className="field">
        <label>Vincular a processo existente (opcional)</label>
        <ProcSearch value={{ label: "" }} onChange={setClaimId} claims={claims} />
      </div>
      <button className="btn" onClick={registrar}>Registrar</button>

      <div style={{ marginTop: 22, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Histórico ({filtradas.length})</h3>
          <button className="btn sec sm" onClick={exportarCsv} disabled={!filtradas.length}>⬇ Exportar CSV do período</button>
        </div>
        <div className="chips" style={{ alignItems: "center", marginTop: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>de</span>
          <input type="date" className="inline" value={de} onChange={(e) => setDe(e.target.value)} />
          <span className="muted" style={{ fontSize: 12 }}>até</span>
          <input type="date" className="inline" value={ate} onChange={(e) => setAte(e.target.value)} />
          {(de || ate) && <button className="chip-btn" onClick={() => { setDe(""); setAte(""); }}>limpar</button>}
        </div>

        {filtradas.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {filtradas.map((o) => {
              const c = o.claimId ? claims.find((x) => x.id === o.claimId) : null;
              return (
                <div key={o.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={"badge " + TIPO_BADGE[o.tipo]}>{TIPO_LABEL[o.tipo] || o.tipo}</span>
                    <span className={"badge " + (o.status === "resolvida" ? "green" : "amber")}>{o.status === "resolvida" ? "Resolvida" : "Aberta"}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{fmtDateBR(o.data)}</span>
                    {c && <a className="badge purple" onClick={() => navigate("sinistro", c.id)}>🔗 {c.numsin || "#" + c.nosnum}</a>}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>{o.titulo}</div>
                  {o.descricao && <div style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>{o.descricao}</div>}
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>por {txt(o.who)}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {o.status !== "resolvida" && (
                      <button className="btn sec xs" onClick={() => canEdit ? actions.resolverOcorrencia(o.id) : alert("Seu perfil é apenas de consulta.")}>Marcar como resolvida</button>
                    )}
                    <button className="btn sec xs" onClick={() => canEdit ? (confirm("Excluir este registro?") && actions.excluirOcorrencia(o.id)) : alert("Seu perfil é apenas de consulta.")}>Excluir</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ marginTop: 14 }}><EmptyState>Nenhuma reclamação ou feedback registrado para este período.</EmptyState></div>
        )}
      </div>
    </div>
  );
}

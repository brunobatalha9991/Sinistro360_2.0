import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { fmtDateBR, todayISO, txt } from "../../logic/format";

const TIPOS = ["Ligação", "Reunião", "Visita", "WhatsApp", "Presencial"];

// Comunicação do gestor com a seguradora (a pedido do usuário) — registro
// independente do histórico de cada sinistro, pensado como evidência pra
// alinhar em reuniões com a seguradora.
export function ComunicacaoGestorPanel({ seguradoraId, actions, canEdit }) {
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [data, setData] = useState(todayISO());
  const [resumo, setResumo] = useState("");

  const registros = actions.comunicacoes
    .filter((x) => x.seguradoraId === seguradoraId)
    .slice().sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  function registrar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    if (!resumo.trim()) { alert("Descreva a comunicação realizada."); return; }
    actions.addComunicacaoGestor(seguradoraId, { tipo, data, resumo });
    setResumo("");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Registrar comunicação com a seguradora</h3>
      <div className="grid c2">
        <div className="field">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label>Data</label><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
      </div>
      <div className="field"><label>Resumo</label><textarea rows={3} value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="O que foi tratado, decidido ou combinado" /></div>
      <button className="btn" onClick={registrar}>Registrar</button>

      <div style={{ marginTop: 22, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <h3 style={{ margin: 0 }}>Histórico ({registros.length})</h3>
        {registros.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {registros.map((r) => (
              <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="badge purple">{r.tipo}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{fmtDateBR(r.data)}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{r.resumo}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>por {txt(r.who)}</div>
                <button className="btn sec xs" style={{ marginTop: 6 }} onClick={() => canEdit ? (confirm("Excluir este registro?") && actions.excluirComunicacaoGestor(r.id)) : alert("Seu perfil é apenas de consulta.")}>Excluir</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 14 }}><EmptyState>Nenhuma comunicação registrada ainda.</EmptyState></div>
        )}
      </div>
    </div>
  );
}

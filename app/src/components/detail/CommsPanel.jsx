import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { useAuth } from "../../hooks/useAuth";
import { loadComms } from "../../logic/claims";
import { fmtDateBR, todayISO, txt } from "../../logic/format";

const CANAIS = ["Cliente", "Oficina", "Seguradora"];
const MEIOS = ["Telefone", "WhatsApp", "E-mail", "Presencial", "Outro"];

// Porte 1:1 de commsPanel() do HTML original (histórico de comunicações).
export function CommsPanel({ c, overrides, actions, canEdit }) {
  const { currentUser } = useAuth();
  const list = loadComms(overrides, c.id).slice().reverse();
  const [canal, setCanal] = useState(CANAIS[0]);
  const [meio, setMeio] = useState(MEIOS[0]);
  const [texto, setTexto] = useState("");
  const [data, setData] = useState(todayISO());

  function registrar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    const t = texto.trim();
    if (!t) { alert("Descreva a comunicação."); return; }
    const arr = [...loadComms(overrides, c.id), {
      id: "cm_" + Math.random().toString(36).slice(2, 9), canal, meio, date: data, text: t,
      who: (currentUser && currentUser.nome) || "—", at: new Date().toISOString(),
    }];
    actions.saveComms(c.id, arr);
    actions.logAudit(c.id, "Comunicação registrada", `Com ${canal} via ${meio}`);
    setTexto("");
  }
  function excluir(id) {
    // NOTA: o original não checava permissão aqui (só ao criar) — um usuário
    // "consulta" conseguia excluir comunicações pela UI. Adicionei a mesma
    // checagem usada em toda ação de escrita desta tela.
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    const arr = loadComms(overrides, c.id).filter((x) => x.id !== id);
    actions.saveComms(c.id, arr);
    actions.logAudit(c.id, "Comunicação excluída", "");
  }

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Registrar comunicação</h3>
        <div className="grid c3">
          <div className="field"><label>Com quem</label>
            <select value={canal} onChange={(e) => setCanal(e.target.value)}>{CANAIS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          </div>
          <div className="field"><label>Meio</label>
            <select value={meio} onChange={(e) => setMeio(e.target.value)}>{MEIOS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          </div>
          <div className="field"><label>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>
        <div className="field"><label>Descrição</label>
          <textarea rows={3} placeholder="Descreva a comunicação realizada..." value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <button className="btn" onClick={registrar}>Registrar comunicação</button>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Histórico de comunicações</h3>
          <span className="tag-manual">Registro manual preservado na sincronização</span>
        </div>
        {!list.length ? <EmptyState>Nenhuma comunicação registrada.</EmptyState> : list.map((m) => {
          const badgeCls = m.canal === "Cliente" ? "green" : m.canal === "Oficina" ? "amber" : "purple";
          return (
            <div key={m.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                <div>
                  <span className={"badge " + badgeCls}>{m.canal}</span>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{m.meio} • {fmtDateBR(m.date)}</span>
                </div>
                <button className="btn danger xs" onClick={() => excluir(m.id)}>Excluir</button>
              </div>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{m.text}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>por {txt(m.who)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

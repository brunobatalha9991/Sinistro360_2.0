import { useState } from "react";
import { uid } from "../../logic/format";
import { TIPOS_ATENDIMENTO } from "../../logic/solicitacaoAtendimento";
import { regrasDestAuto, ausenciaCfg, semInteracaoCfg, DEST_AUTO_MODOS } from "../../logic/ciAutomacao";

const TIPOS_PADRAO = ["Comunicação", "Lembrete", "Tarefa", "Mesa de Atendimento"];

// Automações da Comunicação Interna (a pedido do usuário) — destinatários
// automáticos por tipo de CI e generalização por ausência. Regras em
// config.corp_ci_dest_auto e config.corp_ci_ausencia (ver logic/ciAutomacao.js).
export function CiAutomacaoCard({ config, saveConfig, users, canEdit }) {
  const tipos = config.corp_task_types && config.corp_task_types.length ? config.corp_task_types : TIPOS_PADRAO;
  const [regras, setRegras] = useState(() => regrasDestAuto(config).map((r) => ({ ...r, userIds: [...(r.userIds || [])] })));
  const [aus, setAus] = useState(() => ausenciaCfg(config));
  const [semInt, setSemInt] = useState(() => semInteracaoCfg(config));
  const [status, setStatus] = useState(null);
  const operadores = (users || []).filter((u) => u.role !== "consulta");

  function atualizar(idx, patch) {
    setRegras((cur) => cur.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setStatus(null);
  }
  function alternarUsuario(idx, userId) {
    setRegras((cur) => cur.map((r, i) => {
      if (i !== idx) return r;
      const ids = r.userIds || [];
      return { ...r, userIds: ids.includes(userId) ? ids.filter((x) => x !== userId) : [...ids, userId] };
    }));
    setStatus(null);
  }
  function adicionar() {
    setRegras((cur) => [...cur, { id: uid("dra"), tipo: tipos[0], tipoAtendimento: "", modo: "usuarios", userIds: [] }]);
    setStatus(null);
  }
  function remover(idx) {
    setRegras((cur) => cur.filter((_, i) => i !== idx));
    setStatus(null);
  }

  function salvar() {
    if (!canEdit) { alert("Apenas administradores podem editar as automações da Comunicação Interna."); return; }
    const vazia = regras.find((r) => r.modo === "usuarios" && !(r.userIds || []).length);
    if (vazia) { alert(`A regra de "${vazia.tipo}" está sem nenhum usuário marcado. Marque ao menos um ou remova a regra.`); return; }
    if (!/^\d{2}:\d{2}$/.test(aus.horario || "")) { alert("Informe o horário de corte no formato HH:MM."); return; }
    if (!(Number(semInt.minutos) >= 1) || !(Number(semInt.minutosUrgente) >= 1)) { alert("Informe os minutos do alerta de CI sem interação (1 ou mais)."); return; }
    saveConfig("corp_ci_dest_auto", regras.map((r) => ({
      ...r,
      tipoAtendimento: r.tipo === "Mesa de Atendimento" ? (r.tipoAtendimento || "") : "",
      userIds: r.modo === "usuarios" ? r.userIds : [],
    })));
    saveConfig("corp_ci_ausencia", { ...aus });
    saveConfig("corp_ci_sem_interacao", { ...semInt, minutos: Number(semInt.minutos), minutosUrgente: Number(semInt.minutosUrgente) });
    setStatus("Salvo.");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Destinatários automáticos por tipo de CI</h3>
      <p className="muted">
        Ao criar uma CI, os usuários da regra correspondente já vêm marcados como destinatários (quem cria continua livre pra desmarcar). Em Mesa de Atendimento, a regra pode valer para um tipo de atendimento específico ou para qualquer um.
      </p>

      {!regras.length && <p className="muted" style={{ fontSize: 13 }}>Nenhuma regra. Clique em "+ Adicionar regra".</p>}
      {regras.map((r, idx) => (
        <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8, background: "var(--surface-2)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ flex: "1 1 160px", margin: 0 }}><label>Tipo de CI</label>
              <select value={r.tipo} onChange={(e) => atualizar(idx, { tipo: e.target.value })}>
                {(tipos.includes(r.tipo) ? tipos : [r.tipo, ...tipos]).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {r.tipo === "Mesa de Atendimento" && (
              <div className="field" style={{ flex: "1 1 160px", margin: 0 }}><label>Tipo de atendimento</label>
                <select value={r.tipoAtendimento || ""} onChange={(e) => atualizar(idx, { tipoAtendimento: e.target.value })}>
                  <option value="">Qualquer</option>
                  {TIPOS_ATENDIMENTO.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            )}
            <div className="field" style={{ flex: "1 1 160px", margin: 0 }}><label>Marcar</label>
              <select value={r.modo} onChange={(e) => atualizar(idx, { modo: e.target.value })}>
                {DEST_AUTO_MODOS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <button className="btn danger xs" onClick={() => remover(idx)}>Remover</button>
          </div>
          {r.modo === "usuarios" && (
            <div className="chips" style={{ marginTop: 8 }}>
              {(users || []).map((u) => (
                <div key={u.id} className={"chip-btn" + ((r.userIds || []).includes(u.id) ? " active" : "")} onClick={() => alternarUsuario(idx, u.id)}>{u.nome}</div>
              ))}
            </div>
          )}
          {r.modo === "todos_exceto_consulta" && (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Hoje: {operadores.map((u) => u.nome).join(", ") || "ninguém"}.</div>
          )}
        </div>
      ))}
      <button className="btn sec sm" onClick={adicionar}>+ Adicionar regra</button>

      <h3 style={{ marginTop: 22 }}>Generalização por ausência</h3>
      <p className="muted">
        A partir do horário de corte, quem não é Consulta e ainda não acessou o sistema no dia é tratado como possível ausente: as CIs abertas criadas naquele dia em que ele é destinatário passam a ter todos os usuários operadores (todos, exceto Consulta) como destinatários, com um comentário automático explicando o motivo.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className={"chip-btn" + (aus.ativo ? " active" : "")} onClick={() => { setAus((a) => ({ ...a, ativo: !a.ativo })); setStatus(null); }}>
          {aus.ativo ? "✓ Ativada" : "Desativada"}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          Horário de corte
          <input type="time" style={{ width: 120 }} value={aus.horario} onChange={(e) => { setAus((a) => ({ ...a, horario: e.target.value })); setStatus(null); }} />
        </label>
        <div className={"chip-btn" + (aus.soDiasUteis ? " active" : "")} onClick={() => { setAus((a) => ({ ...a, soDiasUteis: !a.soDiasUteis })); setStatus(null); }}>
          {aus.soDiasUteis ? "✓ Só de segunda a sexta" : "Todos os dias"}
        </div>
      </div>

      <h3 style={{ marginTop: 22 }}>Alerta de CI sem interação</h3>
      <p className="muted">
        CI aberta em que nenhum destinatário interagiu (ciente, comentário ou alteração) dentro do prazo gera notificação para Administradores e VIPs — uma vez por período parado; se alguém interagir e a CI voltar a ficar parada, avisa de novo.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className={"chip-btn" + (semInt.ativo ? " active" : "")} onClick={() => { setSemInt((a) => ({ ...a, ativo: !a.ativo })); setStatus(null); }}>
          {semInt.ativo ? "✓ Ativado" : "Desativado"}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          Prazo (min)
          <input type="number" min={1} style={{ width: 80 }} value={semInt.minutos} onChange={(e) => { setSemInt((a) => ({ ...a, minutos: e.target.value })); setStatus(null); }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          Se Urgente (min)
          <input type="number" min={1} style={{ width: 80 }} value={semInt.minutosUrgente} onChange={(e) => { setSemInt((a) => ({ ...a, minutosUrgente: e.target.value })); setStatus(null); }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn sm" onClick={salvar}>Salvar automações</button>
      </div>
      {status && <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{status}</p>}
    </div>
  );
}

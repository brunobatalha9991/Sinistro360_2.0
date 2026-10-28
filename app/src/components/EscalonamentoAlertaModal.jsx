import { useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataProvider.jsx";
import { useTasksActions } from "../hooks/useTasksActions";
import { ultimaInteracaoPorDestinatario, AUTOR_SISTEMA } from "../logic/ciAutomacao";

// Pedido de intervenção (escalonamento da CI sem interação — ver
// verificarAlertasCriador em logic/ciAutomacao.js). A pedido do usuário:
// tela cheia que não deixa seguir sem decidir — Intervir, Considerar (por
// um prazo) ou Dispensar com justificativa. Uma CI fica resolvida pra quem
// recebeu quando ele intervém nela, marca "Interação considerada" (aqui ou
// pelo sino) ou dispensa, sempre depois do pedido.
const MIN_CHARS = 5;
const UNIDADES = [["min", "minuto(s)", 1], ["h", "hora(s)", 60], ["d", "dia(s)", 1440]];

function fmtDataHora(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function escalonamentosPendentes(notifs, tasks, userId) {
  const porTask = {};
  (notifs || []).forEach((n) => {
    if (n.userId !== userId || n.tipo !== "escalonamento_ci" || n.avaliadoEm) return;
    const t = (tasks || []).find((x) => x.id === n.taskId);
    if (!t || t.status === "Concluído" || t.arquivadoManualmente) return;
    const consid = t.interacaoConsiderada || t.ultimaConsiderada;
    if (consid && String(consid.at) >= String(n.at)) return;
    if ((t.intervencoes || []).some((iv) => iv.autorId === userId && String(iv.at) >= String(n.at))) return;
    if (!porTask[t.id] || String(n.at) > String(porTask[t.id].n.at)) porTask[t.id] = { n, task: t };
  });
  return Object.values(porTask).sort((a, b) => String(a.n.at).localeCompare(String(b.n.at)));
}

// Visualização da CI dentro da própria tela cheia (a pedido do usuário) —
// dá pra avaliar a tarefa inteira sem sair da tela, que continua travada
// até a decisão.
function DetalheTarefa({ task, users, claims }) {
  const nomeDe = (id) => (id === AUTOR_SISTEMA ? "Sistema" : (users.find((u) => u.id === id) || { nome: "?" }).nome);
  const proc = task.processo ? (claims || []).find((c) => c.id === task.processo) : null;
  const msgs = task.comments || [];
  const linhas = [
    ["Status", task.status], ["Urgência", task.urgencia], ["Tipo", task.tipo + (task.tipoAtendimento ? ` • ${task.tipoAtendimento}` : "")],
    ["Criada em", task.createdAt ? fmtDataHora(task.createdAt) : "—"], ["Última ação", task.updatedAt ? fmtDataHora(task.updatedAt) : "—"],
    ["Próxima ação", task.proximaAcaoData ? task.proximaAcaoData.split("-").reverse().join("/") : "—"],
    ["Origem", nomeDe(task.origem)], ["Destinatários", (task.destinatarios || []).map(nomeDe).join(", ") || "—"],
    ["Processo", proc ? `${proc.numsin || "#" + proc.nosnum} — ${proc.segurado || ""}` : "—"],
    ["Sinalizadores", (task.flags || []).join(", ") || "—"],
  ];
  return (
    <div className="escalonamento-detalhe">
      <div className="escalonamento-detalhe-grid">
        {linhas.map(([k, v]) => <div key={k}><small>{k}</small><span>{v}</span></div>)}
      </div>
      {task.descricao && <div className="escalonamento-detalhe-bloco"><small>Descrição</small><div style={{ whiteSpace: "pre-wrap" }}>{task.descricao}</div></div>}
      {task.obs && <div className="escalonamento-detalhe-bloco"><small>Observação</small><div>{task.obs}</div></div>}
      {task.anexo && <div className="escalonamento-detalhe-bloco"><small>Anexo</small><div>{/^https?:\/\//.test(task.anexo) ? <a href={task.anexo} target="_blank" rel="noreferrer">{task.anexo}</a> : task.anexo}</div></div>}
      <div className="escalonamento-detalhe-bloco">
        <small>Histórico da conversa ({msgs.length})</small>
        {!msgs.length ? <div className="muted">Nenhum comentário.</div> : (
          <div className="escalonamento-chat">
            {msgs.map((m) => (
              <div key={m.id || m.at} className={"escalonamento-msg" + (m.userId === AUTOR_SISTEMA ? " sistema" : "") + (m.intervencaoId ? " intervencao" : "")}>
                <b>{m.intervencaoId ? "🚨 " : ""}{nomeDe(m.userId)}</b> <span className="muted">• {fmtDataHora(m.at)}</span>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TelaEscalonamento({ task, n, users, claims, restantes, onIntervir, onConsiderar, onDispensar }) {
  const [modo, setModo] = useState(null); // intervir | considerar | dispensar
  const [verTarefa, setVerTarefa] = useState(false);
  const [texto, setTexto] = useState("");
  const [qtd, setQtd] = useState("1");
  const [unidade, setUnidade] = useState("h");
  const nomeDe = (id) => (users.find((u) => u.id === id) || { nome: "?" }).nome;
  const ausentes = ultimaInteracaoPorDestinatario(task).filter((d) => {
    const u = users.find((x) => x.id === d.userId);
    return !u || u.role !== "admin";
  });
  const textoOk = texto.trim().length >= MIN_CHARS;
  const minutos = Math.round(Number(String(qtd).replace(",", ".")) * ((UNIDADES.find((u) => u[0] === unidade) || UNIDADES[0])[2]));

  return (
    <div className="alarme-geral-overlay" style={{ "--alarm-rgb": "var(--purple-rgb)" }} role="alertdialog" aria-modal="true">
      <div className="alarme-geral-box" style={{ maxWidth: 680 }}>
        <div className="alarme-geral-icone">🟣</div>
        <h2 className="alarme-geral-titulo">PEDIDO DE INTERVENÇÃO</h2>
        <p className="alarme-geral-sub">
          A {task.ci || "CI"} recebeu alertas seguidos sem interação dos destinatários (último em {fmtDataHora(n.at)}). Avalie e decida — a tela só sai com uma decisão.
        </p>
        <div className="conduta-alerta-corpo" style={{ "--alarm-rgb": "var(--purple-rgb)" }}>
          <div className="muted" style={{ fontSize: 12 }}>{task.ci ? task.ci + " • " : ""}{task.tipo} • {task.status}{task.urgencia === "Urgente" ? " • URGENTE" : ""} • criada por {nomeDe(task.origem)}</div>
          <div className="conduta-alerta-titulo">{task.titulo}</div>
          {task.descricao && <div className="conduta-alerta-texto muted">{task.descricao}</div>}
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <b>Sem interação:</b>{" "}
            {ausentes.length ? ausentes.map((d, i) => (
              <span key={d.userId}>{i ? ", " : ""}{nomeDe(d.userId)} <span className="muted">({d.ultima ? "última " + fmtDataHora(d.ultima) : "nenhuma ainda"})</span></span>
            )) : "—"}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <button type="button" className="btn sec sm" onClick={() => setVerTarefa((v) => !v)}>
            {verTarefa ? "▲ Ocultar tarefa" : "👁 Visualizar tarefa"}
          </button>
        </div>
        {verTarefa && <DetalheTarefa task={task} users={users} claims={claims} />}

        {!modo && (
          <div className="escalonamento-acoes">
            <button type="button" className="btn danger" onClick={() => setModo("intervir")}>🚨 Intervir</button>
            <button type="button" className="btn ok" onClick={() => setModo("considerar")}>✓ Considerar</button>
            <button type="button" className="btn sec" onClick={() => setModo("dispensar")}>Não é preciso intervir</button>
          </div>
        )}

        {modo === "intervir" && (
          <div style={{ textAlign: "left", marginTop: 16 }}>
            <label style={{ fontSize: 13 }}>Intervenção (os destinatários terão que responder em tela cheia)</label>
            <textarea autoFocus rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`Escreva pelo menos ${MIN_CHARS} caracteres...`} />
            <div className="escalonamento-acoes">
              <button type="button" className="btn danger" disabled={!textoOk} onClick={() => onIntervir(texto.trim())}>Enviar intervenção</button>
              <button type="button" className="btn sec" onClick={() => { setModo(null); setTexto(""); }}>Voltar</button>
            </div>
          </div>
        )}

        {modo === "considerar" && (
          <div style={{ textAlign: "left", marginTop: 16 }}>
            <label style={{ fontSize: 13 }}>Considerar a última interação por</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="number" min="1" autoFocus style={{ width: 90 }} value={qtd} onChange={(e) => setQtd(e.target.value)} />
              <select style={{ width: "auto" }} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                {UNIDADES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>Até lá, o criador da CI não recebe novos alertas; depois, se ainda não houver interação, eles voltam.</p>
            <div className="escalonamento-acoes">
              <button type="button" className="btn ok" disabled={!(minutos > 0)} onClick={() => onConsiderar(minutos)}>Confirmar</button>
              <button type="button" className="btn sec" onClick={() => setModo(null)}>Voltar</button>
            </div>
          </div>
        )}

        {modo === "dispensar" && (
          <div style={{ textAlign: "left", marginTop: 16 }}>
            <label style={{ fontSize: 13 }}>Por que não é preciso intervir? (fica na auditoria da CI)</label>
            <textarea autoFocus rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`Escreva pelo menos ${MIN_CHARS} caracteres...`} />
            <div className="escalonamento-acoes">
              <button type="button" className="btn" disabled={!textoOk} onClick={() => onDispensar(texto.trim())}>Confirmar</button>
              <button type="button" className="btn sec" onClick={() => { setModo(null); setTexto(""); }}>Voltar</button>
            </div>
          </div>
        )}

        {restantes > 0 && <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>+ {restantes} pedido(s) de intervenção na fila depois deste.</p>}
      </div>
    </div>
  );
}

export function EscalonamentoAlertaModal({ currentUser }) {
  const { records } = useData();
  const actions = useTasksActions();
  if (!currentUser) return null;
  const pendentes = escalonamentosPendentes(records.corp_notifs, records.corp_tasks, currentUser.id);
  if (!pendentes.length) return null;
  const { task, n } = pendentes[0];
  return createPortal(
    <TelaEscalonamento
      key={n.id} task={task} n={n} users={records.corp_users || []} claims={records.corp_claims || []} restantes={pendentes.length - 1}
      onIntervir={(texto) => { actions.intervir(task, texto, currentUser); actions.avaliarEscalonamento(task, currentUser, "intervencao"); }}
      onConsiderar={(min) => { actions.considerarInteracao(task, min, currentUser); actions.avaliarEscalonamento(task, currentUser, "considerada"); }}
      onDispensar={(texto) => actions.avaliarEscalonamento(task, currentUser, "dispensada", texto)}
    />,
    document.body,
  );
}

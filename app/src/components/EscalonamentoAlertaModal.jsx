import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataProvider.jsx";
import { useTasksActions } from "../hooks/useTasksActions";
import { isAdmin } from "../data/auth";
import { CampoMencao } from "./CampoMencao.jsx";
import { TASK_FLAGS_DEFAULT } from "../logic/tasks";
import { ultimaInteracaoPorDestinatario, AUTOR_SISTEMA, ehUsuarioAdministrador, interacaoConsideradaAtiva } from "../logic/ciAutomacao";

// Pedido de intervenção (escalonamento da CI sem interação — ver
// verificarAlertasCriador em logic/ciAutomacao.js). A pedido do usuário:
// tela cheia que não deixa seguir sem decidir — Intervir, Considerar (por
// um prazo) ou Dispensar com justificativa. Uma CI fica resolvida pra quem
// recebeu quando ele intervém nela, marca "Interação considerada" (aqui ou
// pelo sino) ou dispensa, sempre depois do pedido.
const MIN_CHARS = 5;
const UNIDADES = [["min", "minuto(s)", 1], ["h", "hora(s)", 60], ["d", "dia(s)", 1440]];

const ehAutomatico = (m) => m.userId === AUTOR_SISTEMA && !!m.sistema;

// Soneca: esconde TODOS os pedidos em aberto por um tempo (a pedido do
// usuário — às vezes ele precisa usar o sistema e a tela trava). É só uma
// conveniência deste navegador, guardada por usuário; não decide nada.
const SONECA_OPCOES = [[5, "5 min"], [15, "15 min"], [30, "30 min"], [60, "1 hora"]];
const chaveSoneca = (userId) => "sinistro360:soneca-escalonamento:" + userId;
function lerSoneca(userId) {
  try { return Number(localStorage.getItem(chaveSoneca(userId))) || 0; } catch { return 0; }
}
function gravarSoneca(userId, minutos) {
  const ate = Date.now() + minutos * 60000;
  try { localStorage.setItem(chaveSoneca(userId), String(ate)); } catch { /* sem armazenamento: vale só nesta sessão */ }
  return ate;
}

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
    if (interacaoConsideradaAtiva(t)) return; // pausa vigente: nenhum pedido aparece
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
function DetalheTarefa({ task, users, claims, actions, currentUser }) {
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
        {msgs.filter(ehAutomatico).length > 1 && (
          <button type="button" className="btn sec xs" style={{ marginLeft: 8 }}
            onClick={() => { if (window.confirm("Excluir todos os comentários automáticos desta CI?")) actions.excluirComentariosAutomaticos(task, null, currentUser); }}
          >🗑 Excluir todos os automáticos</button>
        )}
        {!msgs.length ? <div className="muted">Nenhum comentário.</div> : (
          <div className="escalonamento-chat">
            {msgs.map((m) => (
              <div key={m.id || m.at} className={"escalonamento-msg" + (m.userId === AUTOR_SISTEMA ? " sistema" : "") + (m.intervencaoId ? " intervencao" : "")}>
                <b>{m.intervencaoId ? "🚨 " : ""}{nomeDe(m.userId)}</b> <span className="muted">• {fmtDataHora(m.at)}</span>
                {ehAutomatico(m) && (
                  <button type="button" className="btn sec xs" style={{ float: "right" }} title="Excluir este comentário automático"
                    onClick={() => actions.excluirComentariosAutomaticos(task, [m.id], currentUser)}>🗑 Excluir</button>
                )}
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Editar a CI sem sair do pedido de intervenção (Admin/VIP/IA, a pedido do
// usuário): destinatários, status, data da próxima ação e sinalizadores.
// Usuário IA não aparece como destinatário, salvo se já estiver na CI (pra
// poder tirar). Concluir pede o comentário de conclusão, igual à tela da CI.
const STATUS_CI = ["Pendente", "Em andamento", "Concluído"];

function EditarCI({ task, users, flagsDisponiveis, onSalvar, onVoltar }) {
  const [sel, setSel] = useState(() => new Set(task.destinatarios || []));
  const [status, setStatus] = useState(task.status || "Pendente");
  const [proxima, setProxima] = useState(task.proximaAcaoData || "");
  const [flags, setFlags] = useState(() => new Set(task.flags || []));
  const [conclusao, setConclusao] = useState("");
  const concluindo = status === "Concluído" && task.status !== "Concluído";
  const lista = users.filter((u) => !u.ia || (task.destinatarios || []).includes(u.id))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const todasFlags = [...new Set([...(flagsDisponiveis || []), ...(task.flags || [])])];
  const alternar = (setter) => (id) => setter((s) => { const nx = new Set(s); if (nx.has(id)) nx.delete(id); else nx.add(id); return nx; });
  const podeSalvar = sel.size > 0 && (!concluindo || conclusao.trim().length >= MIN_CHARS);
  return (
    <div style={{ textAlign: "left", marginTop: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 160px" }}>
          <label style={{ fontSize: 13 }}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_CI.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label style={{ fontSize: 13 }}>Data da próxima ação</label>
          <input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} />
        </div>
      </div>
      {concluindo && (
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 13 }}>Comentário de conclusão (obrigatório — vira o feedback para todos os envolvidos)</label>
          <textarea rows={2} value={conclusao} onChange={(e) => setConclusao(e.target.value)} placeholder={`Escreva pelo menos ${MIN_CHARS} caracteres...`} />
        </div>
      )}
      <label style={{ fontSize: 13, display: "block", marginTop: 10 }}>Sinalizadores</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {todasFlags.map((f) => (
          <label key={f} className={"chip-btn" + (flags.has(f) ? " active" : "")} style={{ cursor: "pointer" }} onClick={() => alternar(setFlags)(f)}>{f}</label>
        ))}
      </div>
      <label style={{ fontSize: 13, display: "block", marginTop: 10 }}>Destinatários — clique para incluir ou remover</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {lista.map((u) => (
          <label key={u.id} className={"chip-btn" + (sel.has(u.id) ? " active" : "")} style={{ cursor: "pointer" }} onClick={() => alternar(setSel)(u.id)}>
            {u.nome}{u.ia ? " 🤖" : ""}
          </label>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>As alterações ficam na auditoria da CI e notificam os envolvidos; quem for incluído recebe um aviso próprio. O pedido continua aberto até você decidir.</p>
      <div className="escalonamento-acoes">
        <button type="button" className="btn" disabled={!podeSalvar}
          onClick={() => onSalvar({ destinatarios: [...sel], status, proximaAcaoData: proxima, flags: todasFlags.filter((f) => flags.has(f)), comentarioConclusao: conclusao.trim() })}
        >Salvar alterações</button>
        <button type="button" className="btn sec" onClick={onVoltar}>Voltar</button>
      </div>
    </div>
  );
}

function TelaEscalonamento({ task, n, users, claims, actions, currentUser, restantes, onIntervir, onConsiderar, onDispensar, onSoneca, onComentar, onEditar, flagsDisponiveis }) {
  const [modo, setModo] = useState(null); // intervir | considerar | dispensar | comentar | editar | soneca
  const [comentados, setComentados] = useState(0);
  const [editado, setEditado] = useState(false);
  const [verTarefa, setVerTarefa] = useState(false);
  const [texto, setTexto] = useState("");
  const [qtd, setQtd] = useState("1");
  const [unidade, setUnidade] = useState("h");
  const nomeDe = (id) => (users.find((u) => u.id === id) || { nome: "?" }).nome;
  const ausentes = ultimaInteracaoPorDestinatario(task).filter((d) => {
    const u = users.find((x) => x.id === d.userId);
    return !u || !ehUsuarioAdministrador(u);
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
        {verTarefa && <DetalheTarefa task={task} users={users} claims={claims} actions={actions} currentUser={currentUser} />}

        {!modo && comentados > 0 && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>✓ Comentário enviado para a CI. Agora decida o pedido de intervenção.</p>
        )}
        {!modo && editado && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>✓ CI atualizada. Agora decida o pedido de intervenção.</p>
        )}
        {modo === "editar" && (
          <EditarCI task={task} users={users} flagsDisponiveis={flagsDisponiveis} onVoltar={() => setModo(null)}
            onSalvar={(campos) => { if (onEditar(campos) !== false) { setEditado(true); setModo(null); } }} />
        )}
        {!modo && (
          <div className="escalonamento-acoes">
            <button type="button" className="btn sec" title="Deixar uma orientação no chat da CI antes de decidir" onClick={() => { setTexto(""); setModo("comentar"); }}>💬 Comentar</button>
            {onEditar && (
              <button type="button" className="btn sec" title="Alterar destinatários, status, próxima ação e sinalizadores" onClick={() => setModo("editar")}>✏️ Editar CI</button>
            )}
            <button type="button" className="btn danger" onClick={() => setModo("intervir")}>🚨 Intervir</button>
            <button type="button" className="btn ok" onClick={() => setModo("considerar")}>✓ Considerar</button>
            <button type="button" className="btn sec" onClick={() => setModo("dispensar")}>Não é preciso intervir</button>
            <button type="button" className="btn sec" title="Esconde TODOS os pedidos de intervenção por um tempo, sem decidir" onClick={() => setModo("soneca")}>💤 Soneca</button>
          </div>
        )}

        {modo === "soneca" && (
          <div style={{ textAlign: "left", marginTop: 16 }}>
            <label style={{ fontSize: 13 }}>Esconder todos os pedidos de intervenção em aberto por</label>
            <div className="escalonamento-acoes" style={{ justifyContent: "flex-start" }}>
              {SONECA_OPCOES.map(([min, rotulo]) => (
                <button key={min} type="button" className="btn sec" onClick={() => onSoneca(min)}>{rotulo}</button>
              ))}
              <button type="button" className="btn sec" onClick={() => setModo(null)}>Voltar</button>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>Nada é decidido: depois do tempo escolhido, os pedidos que continuarem em aberto voltam a aparecer aqui.</p>
          </div>
        )}

        {modo === "comentar" && (
          <div style={{ textAlign: "left", marginTop: 16 }}>
            <label style={{ fontSize: 13 }}>Comentário comum (vai para o chat da CI, sem resposta obrigatória — use @ para marcar alguém)</label>
            <CampoMencao autoFocus rows={3} value={texto} onChange={setTexto} users={users} currentUser={currentUser} placeholder="Ex.: @Maria Luiza, responda o cliente no WhatsApp e registre aqui." />
            <p className="muted" style={{ fontSize: 12 }}>Depois de comentar, este pedido continua aberto até você decidir (Intervir, Considerar, Não é preciso intervir ou Soneca).</p>
            <div className="escalonamento-acoes">
              <button type="button" className="btn" disabled={!texto.trim()} onClick={() => { onComentar(texto.trim()); setTexto(""); setComentados((c) => c + 1); setModo(null); }}>Enviar comentário</button>
              <button type="button" className="btn sec" onClick={() => { setModo(null); setTexto(""); }}>Voltar</button>
            </div>
          </div>
        )}

        {modo === "intervir" && (
          <div style={{ textAlign: "left", marginTop: 16 }}>
            <label style={{ fontSize: 13 }}>Intervenção (os destinatários terão que responder em tela cheia — use @ para marcar alguém)</label>
            <CampoMencao autoFocus rows={3} value={texto} onChange={setTexto} users={users} currentUser={currentUser} placeholder={`Escreva pelo menos ${MIN_CHARS} caracteres... (use @ para marcar alguém)`} />
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
            <label style={{ fontSize: 13, display: "block", marginTop: 8 }}>Não alertar de novo por</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="number" min="1" style={{ width: 90 }} value={qtd} onChange={(e) => setQtd(e.target.value)} />
              <select style={{ width: "auto" }} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                {UNIDADES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div className="escalonamento-acoes">
              <button type="button" className="btn" disabled={!textoOk || !(minutos > 0)} onClick={() => onDispensar(texto.trim(), minutos)}>Confirmar</button>
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
  const { records, config } = useData();
  const actions = useTasksActions();
  const userId = currentUser && currentUser.id;
  const [sonecaAte, setSonecaAte] = useState(() => lerSoneca(userId));
  // Quando a soneca acaba, os pedidos ainda abertos voltam sozinhos.
  useEffect(() => {
    if (!sonecaAte) return undefined;
    const falta = sonecaAte - Date.now();
    if (falta <= 0) { setSonecaAte(0); return undefined; }
    const timer = setTimeout(() => setSonecaAte(0), falta + 200);
    return () => clearTimeout(timer);
  }, [sonecaAte]);
  if (!currentUser) return null;
  const pendentes = escalonamentosPendentes(records.corp_notifs, records.corp_tasks, currentUser.id);
  if (!pendentes.length) return null;
  if (sonecaAte > Date.now()) return null;
  const { task, n } = pendentes[0];
  return createPortal(
    <TelaEscalonamento
      key={n.id} task={task} n={n} users={records.corp_users || []} claims={records.corp_claims || []} actions={actions} currentUser={currentUser} restantes={pendentes.length - 1}
      onIntervir={(texto) => { actions.intervir(task, texto, currentUser); actions.avaliarEscalonamento(task, currentUser, "intervencao"); }}
      onConsiderar={(min) => { actions.considerarInteracao(task, min, currentUser); actions.avaliarEscalonamento(task, currentUser, "considerada"); }}
      onDispensar={(texto, min) => { actions.considerarInteracao(task, min, currentUser); actions.avaliarEscalonamento(task, currentUser, "dispensada", texto); }}
      onSoneca={(min) => setSonecaAte(gravarSoneca(userId, min))}
      onComentar={(texto) => actions.comentarCI(task, texto, currentUser)}
      onEditar={isAdmin(currentUser) || currentUser.ia ? (campos) => actions.editarCIPeloPedido(task, campos, currentUser) : null}
      flagsDisponiveis={config.corp_task_flags && config.corp_task_flags.length ? config.corp_task_flags : TASK_FLAGS_DEFAULT}
    />,
    document.body,
  );
}

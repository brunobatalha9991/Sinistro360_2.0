import { useEffect, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "../hooks/useAuth";
import { useHashRoute } from "../hooks/useHashRoute";
import { useStore } from "../hooks/useStore";
import { useTasksActions } from "../hooks/useTasksActions";
import { useAgendaActions } from "../hooks/useAgendaActions";
import { notifPanelStore } from "../state/notifPanel";
import { myNotifs, myUnreadCount } from "../logic/tasks";
import { EmptyState } from "./EmptyState.jsx";
import { ComentariosFeedback } from "./agenda/FeedbacksPanel.jsx";
import { isAdmin } from "../data/auth";
import { rotuloDuracao } from "../hooks/useTasksActions";
import { interacaoConsideradaAtiva, ultimaInteracaoPorDestinatario } from "../logic/ciAutomacao";

const UNIDADES_DURACAO = [["min", "minuto(s)", 1], ["h", "hora(s)", 60], ["d", "dia(s)", 1440]];

// Alerta "⏱ CI sem interação" (Admin/VIP): mostra quem está sem interagir
// (e desde quando) e o botão "Interação considerada", que segura novos
// alertas da CI pelo tempo escolhido à mão.
function SemInteracaoAcoes({ n, task, users, currentUser, actions, podeConsiderar, rotuloBotao }) {
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState("1");
  const [unidade, setUnidade] = useState("h");
  if (!task) return null;
  const nomeDe = (id) => (users.find((u) => u.id === id) || { nome: "?" }).nome;
  const ids = n.ausentes && n.ausentes.length ? n.ausentes : ultimaInteracaoPorDestinatario(task).map((d) => d.userId);
  const ultimas = {};
  ultimaInteracaoPorDestinatario(task).forEach((d) => { ultimas[d.userId] = d.ultima; });
  const fmt = (iso) => { const d = new Date(iso); const p = (x) => String(x).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const consid = task.interacaoConsiderada;
  const ativa = interacaoConsideradaAtiva(task);

  function confirmar() {
    const q = Number(String(qtd).replace(",", "."));
    const mult = (UNIDADES_DURACAO.find((u) => u[0] === unidade) || UNIDADES_DURACAO[0])[2];
    const minutos = Math.round(q * mult);
    if (!(minutos > 0)) { alert("Informe por quanto tempo a interação deve ser considerada."); return; }
    actions.considerarInteracao(task, minutos, currentUser);
    actions.markNotifRead(n.id);
    setAberto(false);
  }

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 6, cursor: "default" }}>
      <div style={{ fontSize: 11.5 }}>
        <b>Sem interação:</b>{" "}
        {ids.map((id, i) => (
          <span key={id}>{i ? ", " : ""}{nomeDe(id)} <span className="muted">({ultimas[id] ? "última " + fmt(ultimas[id]) : "nenhuma ainda"})</span></span>
        ))}
      </div>
      {ativa && (
        <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
          ✓ Interação considerada até {fmt(consid.ate)} por {nomeDe(consid.por)} — alertas desta CI pausados até lá.
        </div>
      )}
      {!podeConsiderar ? null : !aberto ? (
        <button type="button" className="btn ok xs" style={{ marginTop: 6 }} onClick={() => setAberto(true)}>
          ✓ {rotuloBotao || "Interação considerada"}{ativa ? " (alterar prazo)" : ""}
        </button>
      ) : (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <span style={{ fontSize: 11.5 }}>Considerar por</span>
          <input type="number" min="1" className="inline" style={{ width: 64 }} value={qtd} autoFocus
            onChange={(e) => setQtd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
          />
          <select className="inline" style={{ width: "auto" }} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            {UNIDADES_DURACAO.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <button type="button" className="btn ok xs" onClick={confirmar}>Confirmar</button>
          <button type="button" className="btn sec xs" onClick={() => setAberto(false)}>Cancelar</button>
          <div className="muted" style={{ fontSize: 11, width: "100%" }}>
            Depois desse prazo ({rotuloDuracao(Math.max(1, Math.round(Number(qtd) * ((UNIDADES_DURACAO.find((u) => u[0] === unidade) || [0, 0, 1])[2])) || 1))}), se ainda não houver interação, os alertas desta CI voltam.
          </div>
        </div>
      )}
    </div>
  );
}

// Notificação de agenda → feedback de origem. As antigas (antes de gravar
// feedbackId) caem no feedback com o mesmo instante de registro.
function feedbackDaNotif(n, feedbacks) {
  if (n.feedbackId) return feedbacks.find((f) => f.id === n.feedbackId) || null;
  return n.tipo === "agenda_feedback" ? feedbacks.find((f) => f.at === n.at) || null : null;
}

// Lista de notificações (cards) — a mesma no painel do sino e no módulo
// Notificações (pages/Notificacoes.jsx). `onAbrir` roda depois de abrir um
// item (o sino usa pra se fechar).
export function NotifLista({ list, onAbrir }) {
  const { records } = useData();
  const { currentUser } = useAuth();
  const { navigate } = useHashRoute();
  const actions = useTasksActions();
  const agendaActions = useAgendaActions();
  const [comentandoId, setComentandoId] = useState(null);
  const feedbacks = records.corp_agenda_feedback || [];
  const tasks = records.corp_tasks || [];
  const porId = {};
  (records.corp_users || []).forEach((u) => { porId[u.id] = u; });

  function openItem(n) {
    actions.markNotifRead(n.id);
    if (onAbrir) onAbrir();
    if (n.tipo === "dica") return;
    if (n.tipo === "agenda_feedback" || n.tipo === "agenda_comentario") { navigate("agenda", "feedbacks"); return; }
    if (n.tipo === "conduta") { navigate("desempenho", n.userId); return; }
    if (n.tipo === "desempenho_mudanca") { navigate("desempenho", n.alvoId); return; }
    if (n.tipo === "desempenho_fechamento") { navigate("desempenho", "ritmo"); return; }
    if (n.tipo === "conduta_resposta") { navigate("desempenho", n.alvoId); return; }
    if (n.taskId === "__demanda__") { navigate("demandas"); return; }
    const t = tasks.find((x) => x.id === n.taskId);
    if (t) navigate("tarefas", "open-" + t.id);
  }

  return list.map((n) => {
    const isDemanda = n.taskId === "__demanda__";
    const isDica = n.tipo === "dica";
    const isAgenda = n.tipo === "agenda_feedback" || n.tipo === "agenda_comentario";
    const fb = isAgenda ? feedbackDaNotif(n, feedbacks) : null;
    const comentando = fb && comentandoId === n.id;
    const isEscalonamento = n.tipo === "escalonamento_ci";
    const isSemInteracao = isEscalonamento || n.tipo === "sem_interacao_criador" || (isAdmin(currentUser) && (n.tipo === "sem_interacao" || String(n.text || "").startsWith("⏱")));
    const isConduta = n.tipo === "conduta" || n.tipo === "conduta_resposta";
    const isDesempenho = n.tipo === "desempenho_mudanca" || n.tipo === "desempenho_fechamento";
    const t = (isDemanda || isDica || isAgenda || isConduta || isDesempenho) ? null : tasks.find((x) => x.id === n.taskId);
    const titulo = isDemanda ? "Nova demanda recebida" : isDica ? "💡 Dica do Assistente" : isAgenda ? (n.tipo === "agenda_comentario" ? "💬 Comentário na agenda" : "🗓 Feedback da agenda")
      : n.tipo === "desempenho_mudanca" ? "📊 Mudança no desempenho" : n.tipo === "desempenho_fechamento" ? "📋 Fechamento do dia — ritmo da equipe"
      : n.tipo === "conduta" ? "📋 Registro de desempenho" : n.tipo === "conduta_resposta" ? "✅ Ciente em registro de desempenho" : t ? t.titulo : "(tarefa removida)";
    const when = new Date(n.at);
    const w = `${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
    return (
      <div
        key={n.id}
        className={"notif-item " + (n.read ? "read" : "unread") + (isAgenda ? " agenda" : "") + (n.acompanhamento ? " acompanhamento" : "") + (n.tipo === "escalonamento_ci" ? " escalonamento" : "") + (isDesempenho ? " desempenho" : "") + (n.emergencia ? " neon-alert" : "")}
        style={n.emergencia ? { "--neon-rgb": "var(--danger-rgb)" } : undefined}
        onClick={() => openItem(n)}
      >
        <span className="nt-dot" />
        <div className="nt-body">
          <div className="nt-title">
            {n.emergencia && <span className="badge red" style={{ marginRight: 6, fontWeight: 700 }}>EMERGÊNCIA</span>}
            {n.acompanhamento && <span className="badge orange" style={{ marginRight: 6 }}>👁 Acompanhamento</span>}
            {n.tipo === "escalonamento_ci" && <span className="badge purple" style={{ marginRight: 6 }}>Pedido de intervenção</span>}
            {titulo}
          </div>
          <div className="nt-sub">{n.text} • {w}</div>
          {isSemInteracao && (
            <SemInteracaoAcoes n={n} task={t} users={records.corp_users || []} currentUser={currentUser} actions={actions}
              podeConsiderar={actions.podeConsiderarInteracao(currentUser)} rotuloBotao={isEscalonamento ? "Considerar" : null} />
          )}
          {fb && !comentando && (
            <button type="button" className="btn sec xs" style={{ marginTop: 6 }}
              onClick={(e) => { e.stopPropagation(); actions.markNotifRead(n.id); setComentandoId(n.id); }}
            >💬 Comentar{(fb.comentarios || []).length ? ` (${fb.comentarios.length})` : ""}</button>
          )}
          {comentando && (
            <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 6, cursor: "default" }}>
              <ComentariosFeedback feedback={fb} porId={porId} currentUser={currentUser} onComentar={agendaActions.comentarFeedback} autoFocus />
            </div>
          )}
        </div>
      </div>
    );
  });
}

// Quantas o painel do sino mostra de cada vez — "Ver mais" soma outro
// bloco; a lista completa (com filtros) fica no módulo Notificações.
const PASSO_SINO = 20;

// Porte 1:1 de notifPanel()/notif-btn do HTML original.
export function NotifBell() {
  const { records } = useData();
  const { currentUser } = useAuth();
  const { navigate } = useHashRoute();
  const actions = useTasksActions();
  const panel = useStore(notifPanelStore);
  const [limite, setLimite] = useState(PASSO_SINO);

  const notifs = records.corp_notifs || [];
  const todas = myNotifs(notifs, currentUser);
  const list = todas.slice(0, limite);
  const restantes = todas.length - list.length;
  const unread = myUnreadCount(notifs, currentUser);

  useEffect(() => {
    if (!panel.open) return;
    function onDocClick() { notifPanelStore.patch({ open: false }); }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [panel.open]);

  function toggle(e) {
    e.stopPropagation();
    if (!panel.open) setLimite(PASSO_SINO);
    notifPanelStore.patch({ open: !panel.open });
  }
  function fechar() { notifPanelStore.patch({ open: false }); }

  return (
    <div style={{ position: "relative" }}>
      <button className={"notif-btn" + (unread > 0 ? " has-unread" : "")} type="button" title="Notificações" onClick={toggle}>
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="notif-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {panel.open && (
        <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px 10px" }}>
            <strong style={{ fontSize: 14 }}>Notificações</strong>
            <button className="btn sec xs" onClick={() => actions.markAllNotifsRead()}>Marcar todas lidas</button>
          </div>
          {!list.length ? <EmptyState>Nenhuma notificação.</EmptyState> : <NotifLista list={list} onAbrir={fechar} />}
          {todas.length > 0 && (
            <div className="notif-rodape">
              {restantes > 0 && (
                <button type="button" className="btn sec xs" onClick={() => setLimite((l) => l + PASSO_SINO)}>
                  Ver mais ({restantes} restante{restantes > 1 ? "s" : ""})
                </button>
              )}
              <button type="button" className="btn ghost xs" onClick={() => { fechar(); navigate("notificacoes"); }}>
                Ver todas ({todas.length}) →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

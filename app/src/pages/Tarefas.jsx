import { useEffect } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { useStore } from "../hooks/useStore";
import { useTasksActions } from "../hooks/useTasksActions";
import { isAdmin } from "../data/auth";
import { taskFilterStore } from "../state/taskFilter";
import { openTaskModal } from "../state/taskModal";
import { EmptyState } from "../components/EmptyState.jsx";
import { TaskModal } from "../components/TaskModal.jsx";
import { visibleClaims } from "../logic/claims";
import { myTasks, taskIsStale, taskCienteByMe, isTarefaEmergencia, isTarefaArquivada, URG_ORDER, STATUS_ORDER } from "../logic/tasks";
import { checklistProgresso } from "../logic/checklistMesaAtendimento";

const STATUS_CHIPS = [["todas", "Todas"], ["Pendente", "Pendentes"], ["Em andamento", "Em andamento"], ["Concluído", "Concluídas"]];
const URG_CHIPS = [["todas", "Toda urgência"], ["Urgente", "Urgente"], ["Moderado", "Moderado"], ["Leve", "Leve"]];
const ATENDIMENTO_CHIPS = [
  ["todas", "Atendimento: todos"], ["sinistro", "Sinistro"],
  ["assistencia_24h", "Assistência 24h"], ["assistencia_vidros", "Vidros/pequenos reparos"],
];
const DEFAULT_TASK_TYPES = ["Comunicação", "Lembrete", "Tarefa", "Mesa de Atendimento"];

export function Tarefas() {
  const { records, config, saveConfig } = useData();
  const { param, navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const actions = useTasksActions();
  const filter = useStore(taskFilterStore);

  const claims = visibleClaims(records.corp_claims);
  const taskTypes = config.corp_task_types && config.corp_task_types.length ? config.corp_task_types : DEFAULT_TASK_TYPES;

  // Porte 1:1 dos parâmetros de rota "open-<id>" e "newfromdemanda" do original.
  useEffect(() => {
    actions.purgeOldTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Mesa de Atendimento" só entra automaticamente em corp_task_types de
  // instalações novas (mockData). Bancos já existentes (Firestore com
  // corp_task_types já configurado antes desta funcionalidade) precisam
  // ganhar o tipo novo uma vez — mesmo padrão de auto-completar já usado em
  // Configuracoes.jsx (ensureRamoTemplateInto para os templates de jornada).
  useEffect(() => {
    if (config.corp_task_types && config.corp_task_types.length && config.corp_task_types.indexOf("Mesa de Atendimento") < 0) {
      saveConfig("corp_task_types", (cur) => [...(cur || []), "Mesa de Atendimento"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.corp_task_types]);
  useEffect(() => {
    if (!param) return;
    if (param.indexOf("open-") === 0) {
      openTask(param.slice(5));
      navigate("tarefas");
    } else if (param === "newfromdemanda") {
      openTaskModal(null);
      navigate("tarefas");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  let tasks = myTasks(records.corp_tasks, currentUser);
  // Arquivadas (concluídas há mais de 4 dias) somem da visão normal mesmo
  // com todos os filtros marcados — só aparecem no modo "Arquivadas".
  tasks = tasks.filter((t) => (filter.verArquivadas ? isTarefaArquivada(t) : !isTarefaArquivada(t)));
  if (filter.status !== "todas") tasks = tasks.filter((t) => t.status === filter.status);
  if (filter.urg !== "todas") tasks = tasks.filter((t) => t.urgencia === filter.urg);
  if (filter.tipo !== "todas") tasks = tasks.filter((t) => t.tipo === filter.tipo);
  if (filter.tipoAtendimento !== "todas") tasks = tasks.filter((t) => t.tipoAtendimento === filter.tipoAtendimento);
  if (filter.stale) tasks = tasks.filter((t) => taskIsStale(t, currentUser));
  if (filter.q) {
    const q = filter.q.toLowerCase();
    tasks = tasks.filter((t) => (t.titulo + " " + t.descricao).toLowerCase().indexOf(q) >= 0);
  }
  tasks = [...tasks].sort((a, b) => {
    // Emergência (Assistência 24h) sempre primeiro, acima até de "Urgente".
    const eA = isTarefaEmergencia(a) ? 0 : 1;
    const eB = isTarefaEmergencia(b) ? 0 : 1;
    if (eA !== eB) return eA - eB;
    // Depois, por status: Pendente > Em andamento > Concluído.
    const sA = STATUS_ORDER[a.status] ?? 9;
    const sB = STATUS_ORDER[b.status] ?? 9;
    if (sA !== sB) return sA - sB;
    const u = (URG_ORDER[a.urgencia] || 9) - (URG_ORDER[b.urgencia] || 9);
    if (u !== 0) return u;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });

  const staleCount = myTasks(records.corp_tasks, currentUser).filter((t) => !isTarefaArquivada(t) && taskIsStale(t, currentUser)).length;
  const arquivadasCount = myTasks(records.corp_tasks, currentUser).filter(isTarefaArquivada).length;

  function openTask(taskId) {
    // marca notificações desta tarefa como lidas para o usuário atual
    const notifsToRead = (records.corp_notifs || []).filter((n) => n.taskId === taskId && n.userId === currentUser.id && !n.read);
    notifsToRead.forEach((n) => actions.markNotifRead(n.id));
    openTaskModal(taskId);
  }

  // Substitui o antigo botão "Remover" (a pedido do usuário): nunca apaga a
  // tarefa, só arquiva manualmente com motivo obrigatório — motivo esse que
  // fica registrado na auditoria interna (visível só pro admin, dentro da
  // própria tarefa).
  function arquivarTarefa(t) {
    const motivo = prompt(`Motivo do arquivamento da tarefa "${t.titulo}":`);
    if (motivo === null) return;
    if (!motivo.trim()) { alert("Informe o motivo do arquivamento."); return; }
    actions.arquivarManualmente(t, motivo.trim(), currentUser.id);
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>Comunicação interna</h1><p>Tarefas, lembretes e comunicações entre a equipe</p></div>
        <button className="btn" onClick={() => openTaskModal(null)}>+ Nova tarefa</button>
      </div>

      <div className="card">
        <div className="chips">
          {STATUS_CHIPS.map(([k, label]) => (
            <div key={k} className={"chip-btn" + (filter.status === k ? " active" : "")} onClick={() => taskFilterStore.patch({ status: k })}>{label}</div>
          ))}
        </div>
        <div className="chips">
          {URG_CHIPS.map(([k, label]) => (
            <div key={k} className={"chip-btn" + (filter.urg === k ? " active" : "")} onClick={() => taskFilterStore.patch({ urg: k })}>{label}</div>
          ))}
        </div>
        <div className="chips">
          <div className={"chip-btn" + (filter.tipo === "todas" ? " active" : "")} onClick={() => taskFilterStore.patch({ tipo: "todas" })}>Todos os tipos</div>
          {taskTypes.map((tp) => (
            <div key={tp} className={"chip-btn" + (filter.tipo === tp ? " active" : "")} onClick={() => taskFilterStore.patch({ tipo: tp })}>{tp}</div>
          ))}
        </div>
        <div className="chips">
          {ATENDIMENTO_CHIPS.map(([k, label]) => (
            <div key={k} className={"chip-btn" + (filter.tipoAtendimento === k ? " active" : "")} onClick={() => taskFilterStore.patch({ tipoAtendimento: k })}>{label}</div>
          ))}
        </div>
        <div className="chips">
          <div className={"chip-btn" + (filter.stale ? " active" : "")} onClick={() => taskFilterStore.patch({ stale: !filter.stale })}>⚠ Pendente interação ({staleCount})</div>
          <div className={"chip-btn" + (filter.verArquivadas ? " active" : "")} onClick={() => taskFilterStore.patch({ verArquivadas: !filter.verArquivadas })}>Arquivadas ({arquivadasCount})</div>
          <input className="inline" style={{ minWidth: 200, marginLeft: 8 }} placeholder="Buscar por título..." value={filter.q} onChange={(e) => taskFilterStore.patch({ q: e.target.value })} />
        </div>
        {filter.verArquivadas && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Mostrando só tarefas arquivadas (concluídas há mais de 4 dias) — elas não aparecem na visão normal, mesmo com os outros filtros em "todas".
          </p>
        )}
        {isAdmin(currentUser) && <TaskTypeManager taskTypes={taskTypes} saveConfig={saveConfig} />}
      </div>

      {!tasks.length ? <EmptyState>Nenhuma tarefa para este recorte.</EmptyState> : tasks.map((t) => {
        const stale = taskIsStale(t, currentUser);
        const origem = (records.corp_users || []).find((u) => u.id === t.origem) || { nome: "—" };
        const dests = (t.destinatarios || []).map((id) => ((records.corp_users || []).find((u) => u.id === id) || { nome: "?" }).nome).join(", ");
        const proc = t.processo ? claims.find((c) => c.id === t.processo) : null;
        const emergencia = isTarefaEmergencia(t);
        return (
          <div
            key={t.id}
            className={"task-card " + (t.urgencia || "").toLowerCase() + (stale ? " stale" : "") + (emergencia ? " neon-alert" : "")}
            style={emergencia ? { "--neon-rgb": "var(--danger-rgb)" } : undefined}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  {emergencia && <span className="badge red" style={{ fontWeight: 700 }}>EMERGÊNCIA</span>}
                  <span className={"badge-mini urg-badge " + (t.urgencia || "").toLowerCase()}>{t.urgencia}</span>
                  <span className="badge gray">{t.tipo}</span>
                  <span className={"badge " + (t.status === "Concluído" ? "green" : t.status === "Em andamento" ? "amber" : "blue")}>{t.status}</span>
                  {t.tipoAtendimento === "sinistro" && <span className="badge blue">Sinistro</span>}
                  {t.tipoAtendimento === "assistencia_24h" && <span className="badge purple">Assistência 24h</span>}
                  {t.tipoAtendimento === "assistencia_vidros" && <span className="badge purple">Vidros/pequenos reparos</span>}
                  {t.tipo === "Mesa de Atendimento" && (() => {
                    const p = checklistProgresso(t.checklistMesa, config);
                    return <span className={"badge " + (p.total && p.feitos === p.total ? "green" : "amber")}>Checklist {p.feitos}/{p.total}</span>;
                  })()}
                  {t.tipo === "Mesa de Atendimento" && t.solicitacao && <span className="badge blue">Solicitação preenchida</span>}
                  {stale && <span className="badge red">⚠ +2h sem interação</span>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{t.titulo}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>De {origem.nome} → {dests}</div>
                {t.descricao && <div style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{t.descricao}</div>}
                {proc && <div style={{ marginTop: 6 }}><a className="badge purple" onClick={() => navigate("sinistro", proc.id)}>🔗 {proc.numsin || "#" + proc.nosnum}</a></div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button className="btn sec xs" onClick={() => openTask(t.id)}>Abrir / editar</button>
                {t.status !== "Concluído" && !taskCienteByMe(t, currentUser) && (
                  <button className="btn ok xs" title="Marcar que você viu esta tarefa (para o alerta parar)" onClick={() => actions.markTaskCiente(t.id)}>✓ Ciente</button>
                )}
                {t.status !== "Concluído" && taskCienteByMe(t, currentUser) && <span className="badge green" style={{ justifyContent: "center" }}>✓ Ciente</span>}
                {(t.origem === currentUser.id || isAdmin(currentUser)) && !isTarefaArquivada(t) && (
                  <button className="btn sec xs" onClick={() => arquivarTarefa(t)}>Arquivar</button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <TaskModal />
    </div>
  );
}

function TaskTypeManager({ taskTypes, saveConfig }) {
  function withDefault(cur) { return cur && cur.length ? cur : DEFAULT_TASK_TYPES; }
  function editar(tp) {
    const nv = prompt("Editar tipo:", tp);
    if (nv) saveConfig("corp_task_types", (cur) => withDefault(cur).map((x) => (x === tp ? nv.trim() : x)));
  }
  function remover(tp) {
    if (confirm(`Remover tipo "${tp}"?`)) saveConfig("corp_task_types", (cur) => withDefault(cur).filter((x) => x !== tp));
  }
  function adicionar(v) {
    if (v.trim()) saveConfig("corp_task_types", (cur) => [...withDefault(cur), v.trim()]);
  }
  let addInput;
  return (
    <div className="chips" style={{ alignItems: "center", borderTop: "1px dashed var(--line)", paddingTop: 10, marginTop: 4 }}>
      <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Tipos:</span>
      {taskTypes.map((tp) => (
        <span key={tp} className="badge gray" style={{ gap: 6 }}>
          <span>{tp}</span>
          <a onClick={() => editar(tp)}>✎</a>
          <a style={{ color: "var(--danger)" }} onClick={() => remover(tp)}>✕</a>
        </span>
      ))}
      <input className="inline" placeholder="Novo tipo..." style={{ minWidth: 130 }} ref={(el) => { addInput = el; }} />
      <button className="btn sec xs" onClick={() => { adicionar(addInput.value || ""); if (addInput) addInput.value = ""; }}>+ Tipo</button>
    </div>
  );
}

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
import { myTasks, taskIsStale, taskCienteByMe, URG_ORDER } from "../logic/tasks";

const STATUS_CHIPS = [["todas", "Todas"], ["Pendente", "Pendentes"], ["Em andamento", "Em andamento"], ["Concluído", "Concluídas"]];
const URG_CHIPS = [["todas", "Toda urgência"], ["Urgente", "Urgente"], ["Moderado", "Moderado"], ["Leve", "Leve"]];
const DEFAULT_TASK_TYPES = ["Comunicação", "Lembrete", "Tarefa"];

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
  if (filter.status !== "todas") tasks = tasks.filter((t) => t.status === filter.status);
  if (filter.urg !== "todas") tasks = tasks.filter((t) => t.urgencia === filter.urg);
  if (filter.tipo !== "todas") tasks = tasks.filter((t) => t.tipo === filter.tipo);
  if (filter.stale) tasks = tasks.filter((t) => taskIsStale(t, currentUser));
  if (filter.q) {
    const q = filter.q.toLowerCase();
    tasks = tasks.filter((t) => (t.titulo + " " + t.descricao).toLowerCase().indexOf(q) >= 0);
  }
  tasks = [...tasks].sort((a, b) => {
    const u = (URG_ORDER[a.urgencia] || 9) - (URG_ORDER[b.urgencia] || 9);
    if (u !== 0) return u;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });

  const staleCount = myTasks(records.corp_tasks, currentUser).filter((t) => taskIsStale(t, currentUser)).length;

  function openTask(taskId) {
    // marca notificações desta tarefa como lidas para o usuário atual
    const notifsToRead = (records.corp_notifs || []).filter((n) => n.taskId === taskId && n.userId === currentUser.id && !n.read);
    notifsToRead.forEach((n) => actions.markNotifRead(n.id));
    openTaskModal(taskId);
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
          <div className={"chip-btn" + (filter.stale ? " active" : "")} onClick={() => taskFilterStore.patch({ stale: !filter.stale })}>⚠ Pendente interação ({staleCount})</div>
          <input className="inline" style={{ minWidth: 200, marginLeft: 8 }} placeholder="Buscar por título..." value={filter.q} onChange={(e) => taskFilterStore.patch({ q: e.target.value })} />
        </div>
        {isAdmin(currentUser) && <TaskTypeManager taskTypes={taskTypes} saveConfig={saveConfig} />}
      </div>

      {!tasks.length ? <EmptyState>Nenhuma tarefa para este recorte.</EmptyState> : tasks.map((t) => {
        const stale = taskIsStale(t, currentUser);
        const origem = (records.corp_users || []).find((u) => u.id === t.origem) || { nome: "—" };
        const dests = (t.destinatarios || []).map((id) => ((records.corp_users || []).find((u) => u.id === id) || { nome: "?" }).nome).join(", ");
        const proc = t.processo ? claims.find((c) => c.id === t.processo) : null;
        return (
          <div key={t.id} className={"task-card " + (t.urgencia || "").toLowerCase() + (stale ? " stale" : "")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  <span className={"badge-mini urg-badge " + (t.urgencia || "").toLowerCase()}>{t.urgencia}</span>
                  <span className="badge gray">{t.tipo}</span>
                  <span className={"badge " + (t.status === "Concluído" ? "green" : t.status === "Em andamento" ? "amber" : "blue")}>{t.status}</span>
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
                {(t.origem === currentUser.id || isAdmin(currentUser)) && (
                  <button className="btn danger xs" onClick={() => { if (confirm(`Remover a tarefa "${t.titulo}"?`)) actions.removeTask(t.id); }}>Remover</button>
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

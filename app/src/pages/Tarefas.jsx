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
import { oficinaNomeFromId } from "../logic/oficinas";
import { seguradoraNomeFromId } from "../logic/seguradoras";
import { clienteNomeFromId } from "../logic/clientes";
import { fmtDateHoraBR } from "../logic/format";
import {
  taskIsStale, taskCienteByMe, isTarefaEmergencia, isTarefaArquivada,
  tarefasNoEscopo, tarefaTemPapel, compararTarefasAuto, TASK_FLAGS_DEFAULT,
} from "../logic/tasks";
import { checklistProgresso } from "../logic/checklistMesaAtendimento";

const STATUS_CHIPS = [["todas", "Todas"], ["Pendente", "Pendentes"], ["Em andamento", "Em andamento"], ["Concluído", "Concluídas"]];
const URG_CHIPS = [["todas", "Toda urgência"], ["Urgente", "Urgente"], ["Moderado", "Moderado"], ["Leve", "Leve"]];
const ATENDIMENTO_CHIPS = [
  ["todas", "Atendimento: todos"], ["sinistro", "Sinistro"],
  ["assistencia_24h", "Assistência 24h"], ["assistencia_vidros", "Vidros/pequenos reparos"],
];
const PAPEL_CHIPS = [["ambos", "Origem/Destinatário"], ["origem", "Só origem"], ["destinatario", "Só destinatário"]];
const DEFAULT_TASK_TYPES = ["Comunicação", "Lembrete", "Tarefa", "Mesa de Atendimento"];

export function Tarefas() {
  const { records, config, saveConfig, saveRecord } = useData();
  const { param, navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const actions = useTasksActions();
  const filter = useStore(taskFilterStore);

  const claims = visibleClaims(records.corp_claims);
  const users = records.corp_users || [];
  const taskTypes = config.corp_task_types && config.corp_task_types.length ? config.corp_task_types : DEFAULT_TASK_TYPES;
  const taskFlags = config.corp_task_flags && config.corp_task_flags.length ? config.corp_task_flags : TASK_FLAGS_DEFAULT;
  const podeVerTodos = isAdmin(currentUser);

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

  // Escopo de visibilidade (a pedido do usuário): qualquer um só via as
  // próprias tarefas (origem OU destinatário); admin/VIP podem trocar pra
  // "Todos" ou por um colega específico — "Eu mesmo" continua o padrão, o
  // comportamento não muda sozinho pra quem já usava a tela.
  const usuarioFiltroId = !podeVerTodos ? currentUser.id
    : filter.usuarioId === "eu" ? currentUser.id
    : filter.usuarioId === "todos" ? null
    : filter.usuarioId;

  let tasks = tarefasNoEscopo(records.corp_tasks, usuarioFiltroId);
  if (usuarioFiltroId != null && filter.papel !== "ambos") {
    tasks = tasks.filter((t) => tarefaTemPapel(t, usuarioFiltroId, filter.papel));
  }
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

  // Ordenação: automática (emergência > urgência > criação mais recente) por
  // padrão; "Ordem manual" (a pedido do usuário) troca pra ordemManual, que
  // é carimbada 0,1,2... na ordem automática atual no momento em que o modo
  // é ligado — "Reorganizar" só desliga o modo, voltando pra automática.
  const tasksAutoOrdenadas = [...tasks].sort(compararTarefasAuto);
  tasks = filter.ordemManual
    ? [...tasks].sort((a, b) => (a.ordemManual ?? Number.MAX_SAFE_INTEGER) - (b.ordemManual ?? Number.MAX_SAFE_INTEGER))
    : tasksAutoOrdenadas;

  const escopoBase = tarefasNoEscopo(records.corp_tasks, usuarioFiltroId);
  const staleCount = escopoBase.filter((t) => !isTarefaArquivada(t) && taskIsStale(t, currentUser)).length;
  const arquivadasCount = escopoBase.filter(isTarefaArquivada).length;

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
    alert("O arquivamento acontece para todos os usuários envolvidos.");
    const motivo = prompt(`Motivo do arquivamento da tarefa "${t.titulo}":`);
    if (motivo === null) return;
    if (!motivo.trim()) { alert("Informe o motivo do arquivamento."); return; }
    actions.arquivarManualmente(t, motivo.trim(), currentUser.id);
  }

  // Exclusão de verdade — só admin/VIP (a pedido do usuário), diferente do
  // arquivamento acima (que qualquer envolvido pode fazer e não apaga nada).
  function excluirTarefa(t) {
    if (!confirm(`Excluir definitivamente a tarefa "${t.titulo}" (${t.ci || "sem protocolo"})? Esta ação NÃO pode ser desfeita — considere Arquivar em vez de excluir.`)) return;
    actions.excluirTarefa(t.id);
  }

  function toggleOrdemManual() {
    if (filter.ordemManual) { taskFilterStore.patch({ ordemManual: false }); return; }
    actions.definirOrdemManual(tasksAutoOrdenadas);
    taskFilterStore.patch({ ordemManual: true });
  }
  function moverTarefa(t, direcao) {
    const idx = tasks.findIndex((x) => x.id === t.id);
    const vizIdx = idx + direcao;
    if (vizIdx < 0 || vizIdx >= tasks.length) return;
    const viz = tasks[vizIdx];
    const ordemT = t.ordemManual ?? idx;
    const ordemV = viz.ordemManual ?? vizIdx;
    saveRecord("corp_tasks", (current) => (current || []).map((x) => {
      if (x.id === t.id) return { ...x, ordemManual: ordemV };
      if (x.id === viz.id) return { ...x, ordemManual: ordemT };
      return x;
    }));
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>Comunicação interna</h1><p>Tarefas, lembretes e comunicações entre a equipe</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={"btn" + (filter.showFilters ? "" : " sec")} onClick={() => taskFilterStore.patch({ showFilters: !filter.showFilters })}>
            {filter.showFilters ? "▲ Ocultar filtros" : "▼ Filtros"}
          </button>
          <button className="btn" onClick={() => openTaskModal(null)}>+ Nova tarefa</button>
        </div>
      </div>

      {filter.showFilters && (
        <div className="card">
          {podeVerTodos && (
            <div className="chips" style={{ alignItems: "center" }}>
              <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Usuário:</span>
              <div className={"chip-btn" + (filter.usuarioId === "eu" ? " active" : "")} onClick={() => taskFilterStore.patch({ usuarioId: "eu" })}>Eu mesmo</div>
              <div className={"chip-btn" + (filter.usuarioId === "todos" ? " active" : "")} onClick={() => taskFilterStore.patch({ usuarioId: "todos" })}>Todos</div>
              {users.filter((u) => u.id !== currentUser.id).map((u) => (
                <div key={u.id} className={"chip-btn" + (filter.usuarioId === u.id ? " active" : "")} onClick={() => taskFilterStore.patch({ usuarioId: u.id })}>{u.nome}</div>
              ))}
            </div>
          )}
          {usuarioFiltroId != null && (
            <div className="chips" style={{ alignItems: "center" }}>
              <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Papel:</span>
              {PAPEL_CHIPS.map(([k, label]) => (
                <div key={k} className={"chip-btn" + (filter.papel === k ? " active" : "")} onClick={() => taskFilterStore.patch({ papel: k })}>{label}</div>
              ))}
            </div>
          )}
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
          <div className="chips" style={{ alignItems: "center" }}>
            <div className={"chip-btn" + (filter.stale ? " active" : "")} onClick={() => taskFilterStore.patch({ stale: !filter.stale })}>⚠ Pendente interação ({staleCount})</div>
            <div className={"chip-btn" + (filter.verArquivadas ? " active" : "")} onClick={() => taskFilterStore.patch({ verArquivadas: !filter.verArquivadas })}>Arquivadas ({arquivadasCount})</div>
            <div className={"chip-btn" + (filter.ordemManual ? " active" : "")} onClick={toggleOrdemManual}>🔀 Ordem manual</div>
            {filter.ordemManual && <div className="chip-btn" onClick={() => taskFilterStore.patch({ ordemManual: false })}>↺ Reorganizar (ordem padrão)</div>}
            <input className="inline" style={{ minWidth: 200, marginLeft: 8 }} placeholder="Buscar por título..." value={filter.q} onChange={(e) => taskFilterStore.patch({ q: e.target.value })} />
          </div>
          {filter.verArquivadas && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Mostrando só tarefas arquivadas (concluídas há mais de 4 dias) — elas não aparecem na visão normal, mesmo com os outros filtros em "todas".
            </p>
          )}
          {isAdmin(currentUser) && <TaskTypeManager taskTypes={taskTypes} saveConfig={saveConfig} />}
          {isAdmin(currentUser) && <TaskFlagManager taskFlags={taskFlags} saveConfig={saveConfig} />}
        </div>
      )}

      {!tasks.length ? <EmptyState>Nenhuma tarefa para este recorte.</EmptyState> : tasks.map((t) => {
        const stale = taskIsStale(t, currentUser);
        const origem = users.find((u) => u.id === t.origem) || { nome: "—" };
        const dests = (t.destinatarios || []).map((id) => (users.find((u) => u.id === id) || { nome: "?" }).nome).join(", ");
        const proc = t.processo ? claims.find((c) => c.id === t.processo) : null;
        const oficinaNome = t.oficinaId ? oficinaNomeFromId(claims, records.corp_overrides, t.oficinaId) : "";
        const seguradoraNome = t.seguradoraId ? seguradoraNomeFromId(claims, records.corp_overrides, t.seguradoraId) : "";
        const clienteNome = t.clienteId ? clienteNomeFromId(claims, records.corp_overrides, t.clienteId) : "";
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
                  {t.ci && <span className="badge gray mono" title="Número de protocolo">{t.ci}</span>}
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
                  {(t.flags || []).map((f) => <span key={f} className="badge amber">{f}</span>)}
                  {stale && <span className="badge red">⚠ +2h sem interação</span>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{t.titulo}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>De {origem.nome} → {dests}</div>
                {t.descricao && <div style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{t.descricao}</div>}
                {(proc || oficinaNome || seguradoraNome || clienteNome) && (
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {proc && <a className="badge purple" onClick={() => navigate("sinistro", proc.id)}>🔗 {proc.numsin || "#" + proc.nosnum}</a>}
                    {oficinaNome && <a className="badge amber" onClick={() => navigate("oficina", t.oficinaId)}>🔧 {oficinaNome}</a>}
                    {seguradoraNome && <a className="badge blue" onClick={() => navigate("seguradora", t.seguradoraId)}>🏢 {seguradoraNome}</a>}
                    {clienteNome && <a className="badge green" onClick={() => navigate("cliente", t.clienteId)}>👤 {clienteNome}</a>}
                  </div>
                )}
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  Criada em {fmtDateHoraBR(t.createdAt)} • Última ação em {fmtDateHoraBR(t.updatedAt)}
                  {t.concludedAt && <> • Concluída em {fmtDateHoraBR(t.concludedAt)}</>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {filter.ordemManual && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn ghost xs" title="Mover para cima" onClick={() => moverTarefa(t, -1)}>↑</button>
                    <button className="btn ghost xs" title="Mover para baixo" onClick={() => moverTarefa(t, 1)}>↓</button>
                  </div>
                )}
                <button className="btn sec xs" onClick={() => openTask(t.id)}>Abrir / editar</button>
                {t.status !== "Concluído" && !taskCienteByMe(t, currentUser) && (
                  <button className="btn ok xs" title="Marcar que você viu esta tarefa (para o alerta parar)" onClick={() => actions.markTaskCiente(t.id)}>✓ Ciente</button>
                )}
                {t.status !== "Concluído" && taskCienteByMe(t, currentUser) && <span className="badge green" style={{ justifyContent: "center" }}>✓ Ciente</span>}
                {(t.origem === currentUser.id || isAdmin(currentUser)) && !isTarefaArquivada(t) && (
                  <button className="btn sec xs" onClick={() => arquivarTarefa(t)}>Arquivar</button>
                )}
                {isAdmin(currentUser) && (
                  <button className="btn danger xs" onClick={() => excluirTarefa(t)}>Excluir</button>
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

// Sinalizadores configuráveis (a pedido do usuário: "Aguard. cliente",
// "Aguard. corretora" e o que o admin quiser adicionar) — mesmo padrão de
// TaskTypeManager acima, só que grava em corp_task_flags.
function TaskFlagManager({ taskFlags, saveConfig }) {
  function withDefault(cur) { return cur && cur.length ? cur : TASK_FLAGS_DEFAULT; }
  function editar(f) {
    const nv = prompt("Editar sinalizador:", f);
    if (nv) saveConfig("corp_task_flags", (cur) => withDefault(cur).map((x) => (x === f ? nv.trim() : x)));
  }
  function remover(f) {
    if (confirm(`Remover sinalizador "${f}"?`)) saveConfig("corp_task_flags", (cur) => withDefault(cur).filter((x) => x !== f));
  }
  function adicionar(v) {
    if (v.trim()) saveConfig("corp_task_flags", (cur) => [...withDefault(cur), v.trim()]);
  }
  let addInput;
  return (
    <div className="chips" style={{ alignItems: "center", borderTop: "1px dashed var(--line)", paddingTop: 10, marginTop: 4 }}>
      <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Sinalizadores:</span>
      {taskFlags.map((f) => (
        <span key={f} className="badge amber" style={{ gap: 6 }}>
          <span>{f}</span>
          <a onClick={() => editar(f)}>✎</a>
          <a style={{ color: "var(--danger)" }} onClick={() => remover(f)}>✕</a>
        </span>
      ))}
      <input className="inline" placeholder="Novo sinalizador..." style={{ minWidth: 130 }} ref={(el) => { addInput = el; }} />
      <button className="btn sec xs" onClick={() => { adicionar(addInput.value || ""); if (addInput) addInput.value = ""; }}>+ Sinalizador</button>
    </div>
  );
}

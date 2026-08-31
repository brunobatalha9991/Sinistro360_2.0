import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";
import { taskParticipants, proximoCI, recorrenciaVencida, recorrenciaEncerrada, gerarOcorrenciaRecorrente } from "../logic/tasks";

// Central de gravação em corp_tasks/corp_notifs/corp_demandas — porte 1:1
// das funções de escrita do HTML original (pushNotif, taskInteract,
// markTaskCiente, markNotifRead, markAllNotifsRead, purgeOldTasks...),
// todas usando a forma "updater" do saveRecord (current => next) pelo
// mesmo motivo do useOverrideActions: evitar que duas gravações no mesmo
// clique se percam uma à outra.
export function useTasksActions() {
  const { saveRecord } = useData();
  const { currentUser } = useAuth();

  // `emergencia` marca a notificação como Assistência 24h — só diferencial
  // visual (NotifBell.jsx), não muda o fluxo de leitura/marcação. `criacao`
  // marca que esta notificação é da CRIAÇÃO da tarefa (não de uma edição/
  // comentário posterior) — usado pelo alarme em tela cheia de Mesa de
  // Atendimento (useTarefaAlarme.js), que só deve disparar uma vez, na
  // criação, não a cada interação seguinte na mesma tarefa.
  function pushNotif(taskId, userIds, texto, exceptUserId, emergencia, criacao) {
    saveRecord("corp_notifs", (current) => {
      const arr = [...(current || [])];
      (userIds || []).forEach((uid) => {
        if (uid === exceptUserId) return;
        arr.push({ id: "ntf_" + Math.random().toString(36).slice(2, 9), taskId, userId: uid, text: texto, at: new Date().toISOString(), read: false, emergencia: !!emergencia, criacao: !!criacao });
      });
      return arr;
    });
  }

  function saveTask(task) {
    saveRecord("corp_tasks", (current) => (current || []).map((x) => (x.id === task.id ? task : x)));
  }
  function createTask(task) {
    saveRecord("corp_tasks", (current) => [...(current || []), task]);
  }

  // `acoes` pode ser uma string única (compatibilidade) ou uma lista — cada
  // item vira uma linha própria na auditoria interna da tarefa (log),
  // visível só pro admin (ver TaskAuditPanel em TaskModal.jsx). A
  // notificação enviada aos participantes usa `notifTexto` se informado,
  // senão cai pro primeiro item da lista.
  function taskInteract(task, acoes, exceptUserId, emergencia, notifTexto) {
    const lista = Array.isArray(acoes) ? acoes : [acoes];
    const updatedAt = new Date().toISOString();
    const novasEntradas = lista.map((acao) => ({ at: updatedAt, who: exceptUserId, acao }));
    const next = { ...task, updatedAt, log: [...(task.log || []), ...novasEntradas] };
    saveTask(next);
    pushNotif(task.id, taskParticipants(task), notifTexto || lista[0], exceptUserId, emergencia);
    return next;
  }

  // Arquivamento manual — substitui o antigo botão "Remover" (a pedido do
  // usuário): nunca apaga a tarefa nem seu histórico, só marca como
  // arquivada com motivo obrigatório, registrado na auditoria interna.
  function arquivarManualmente(task, motivo, userId) {
    const agora = new Date().toISOString();
    const next = {
      ...task,
      arquivadoManualmente: { motivo, at: agora, userId },
      updatedAt: agora,
      log: [...(task.log || []), { at: agora, who: userId, acao: `Tarefa arquivada manualmente — Motivo: "${motivo}"` }],
    };
    saveTask(next);
  }

  // Exclusão de verdade (admin/VIP) — diferente do arquivamento (que
  // qualquer envolvido pode fazer e mantém tudo). A pedido do usuário:
  // "admin/VIP podem excluir também". Remove também as notificações da
  // tarefa (mesma limpeza que purgeOldTasks já faz).
  function excluirTarefa(taskId) {
    saveRecord("corp_tasks", (current) => (current || []).filter((t) => t.id !== taskId));
    saveRecord("corp_notifs", (current) => (current || []).filter((n) => n.taskId !== taskId));
  }

  // Grava `ordemManual` (0,1,2...) na ordem em que as tarefas aparecem em
  // `tasksNaOrdem` — usado ao ligar o modo "Ordem manual" (parte da ordem
  // automática atual) e a cada ↑/↓ (troca de posição com a vizinha).
  function definirOrdemManual(tasksNaOrdem) {
    const mapa = {};
    (tasksNaOrdem || []).forEach((t, i) => { mapa[t.id] = i; });
    saveRecord("corp_tasks", (current) => (current || []).map((t) => (mapa[t.id] != null ? { ...t, ordemManual: mapa[t.id] } : t)));
  }

  function markTaskCiente(taskId) {
    if (!currentUser) return;
    saveRecord("corp_tasks", (current) => (current || []).map((t) => {
      if (t.id !== taskId) return t;
      return { ...t, ciente: { ...(t.ciente || {}), [currentUser.id]: new Date().toISOString() } };
    }));
    saveRecord("corp_notifs", (current) => (current || []).map((n) => (
      n.taskId === taskId && n.userId === currentUser.id ? { ...n, read: true } : n
    )));
  }

  function markNotifRead(id) {
    saveRecord("corp_notifs", (current) => (current || []).map((n) => (n.id === id ? { ...n, read: true } : n)));
  }
  // Dispensa só o ALARME em tela cheia de Mesa de Atendimento
  // (TarefaAlarmeModal.jsx/useTarefaAlarme.js) — de propósito, um campo
  // próprio (`alarmeDispensado`), separado de `read`: cada notificação já é
  // um registro individual por destinatário (ver pushNotif acima), então
  // isso nunca afeta outros destinatários da mesma tarefa; e como não mexe
  // em `read`, dispensar o alarme não faz o badge de não lidas do sininho
  // sumir sozinho — só abrir a tarefa de fato marca como lida.
  function dismissAlarmeMesa(id) {
    saveRecord("corp_notifs", (current) => (current || []).map((n) => (n.id === id ? { ...n, alarmeDispensado: true } : n)));
  }
  function markAllNotifsRead() {
    if (!currentUser) return;
    saveRecord("corp_notifs", (current) => (current || []).map((n) => (n.userId === currentUser.id ? { ...n, read: true } : n)));
  }

  // Apaga tarefas concluídas há mais de 15 dias — porte 1:1 de purgeOldTasks().
  function purgeOldTasks() {
    saveRecord("corp_tasks", (current) => {
      const all = current || [];
      const lim = Date.now() - 15 * 24 * 60 * 60 * 1000;
      const keep = all.filter((t) => {
        if (t.status !== "Concluído") return true;
        const d = new Date(t.concludedAt || t.updatedAt || t.createdAt).getTime();
        return d > lim;
      });
      if (keep.length !== all.length) {
        const keepIds = {};
        keep.forEach((t) => { keepIds[t.id] = true; });
        saveRecord("corp_notifs", (curNotifs) => (curNotifs || []).filter((n) => keepIds[n.taskId]));
        return keep;
      }
      return all;
    });
  }

  // Gera as ocorrências vencidas de tarefas recorrentes (a pedido do
  // usuário) — sem backend/cron aqui, então roda no cliente sempre que
  // alguém abre o módulo Comunicação (ver Tarefas.jsx). Cada tarefa
  // original pode estar atrasada por mais de um intervalo (app fica dias
  // sem ser aberto) — o `while` interno gera todas as ocorrências
  // pendentes de uma vez, com um teto de segurança pra nunca travar a tela
  // por uma recorrência mal configurada (ex.: intervalo 0).
  function gerarOcorrenciasRecorrentes() {
    const hoje = new Date().toISOString().slice(0, 10);
    const agora = new Date().toISOString();
    saveRecord("corp_tasks", (current) => {
      const all = current || [];
      const novas = [];
      const atualizadas = all.map((t) => {
        if (!recorrenciaVencida(t, hoje)) return t;
        let atual = t;
        let seguranca = 0;
        while (recorrenciaVencida(atual, hoje) && seguranca < 60) {
          const nova = gerarOcorrenciaRecorrente(atual, agora);
          nova.ci = proximoCI([...all, ...novas]);
          novas.push(nova);
          atual = { ...atual, recorrencia: { ...atual.recorrencia, ocorrenciasGeradas: (atual.recorrencia.ocorrenciasGeradas || 0) + 1 } };
          seguranca++;
        }
        if (recorrenciaEncerrada(atual)) atual = { ...atual, recorrencia: { ...atual.recorrencia, ativa: false } };
        return atual;
      });
      return novas.length ? [...atualizadas, ...novas] : all;
    });
  }

  return {
    pushNotif, saveTask, createTask, taskInteract, arquivarManualmente, excluirTarefa, definirOrdemManual,
    markTaskCiente, markNotifRead, dismissAlarmeMesa, markAllNotifsRead, purgeOldTasks, gerarOcorrenciasRecorrentes,
  };
}

import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";
import { taskParticipants } from "../logic/tasks";

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
  // visual (NotifBell.jsx), não muda o fluxo de leitura/marcação.
  function pushNotif(taskId, userIds, texto, exceptUserId, emergencia) {
    saveRecord("corp_notifs", (current) => {
      const arr = [...(current || [])];
      (userIds || []).forEach((uid) => {
        if (uid === exceptUserId) return;
        arr.push({ id: "ntf_" + Math.random().toString(36).slice(2, 9), taskId, userId: uid, text: texto, at: new Date().toISOString(), read: false, emergencia: !!emergencia });
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

  return { pushNotif, saveTask, createTask, taskInteract, arquivarManualmente, markTaskCiente, markNotifRead, markAllNotifsRead, purgeOldTasks };
}

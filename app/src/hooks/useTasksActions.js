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

  function pushNotif(taskId, userIds, texto, exceptUserId) {
    saveRecord("corp_notifs", (current) => {
      const arr = [...(current || [])];
      (userIds || []).forEach((uid) => {
        if (uid === exceptUserId) return;
        arr.push({ id: "ntf_" + Math.random().toString(36).slice(2, 9), taskId, userId: uid, text: texto, at: new Date().toISOString(), read: false });
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
  function removeTask(taskId) {
    saveRecord("corp_tasks", (current) => (current || []).filter((x) => x.id !== taskId));
    saveRecord("corp_notifs", (current) => (current || []).filter((n) => n.taskId !== taskId));
  }

  function taskInteract(task, acao, exceptUserId) {
    const updatedAt = new Date().toISOString();
    const next = { ...task, updatedAt, log: [...(task.log || []), { at: updatedAt, who: exceptUserId, acao }] };
    saveTask(next);
    pushNotif(task.id, taskParticipants(task), acao, exceptUserId);
    return next;
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

  return { pushNotif, saveTask, createTask, removeTask, taskInteract, markTaskCiente, markNotifRead, markAllNotifsRead, purgeOldTasks };
}

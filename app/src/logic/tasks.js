// Porte 1:1 das regras de Comunicação interna (tarefas/notificações) do
// HTML original. Funções puras recebem os dados como parâmetro.
export const URG_ORDER = { Urgente: 0, Moderado: 1, Leve: 2 };

export function taskParticipants(t) {
  const ids = [t.origem].concat(t.destinatarios || []);
  const seen = {};
  const out = [];
  ids.forEach((i) => { if (i && !seen[i]) { seen[i] = true; out.push(i); } });
  return out;
}
export function myTasks(tasks, currentUser) {
  if (!currentUser) return [];
  return (tasks || []).filter((t) => taskParticipants(t).indexOf(currentUser.id) >= 0);
}
export function taskCienteByMe(t, currentUser) {
  if (!currentUser) return false;
  const c = t.ciente && t.ciente[currentUser.id];
  if (!c) return false;
  const last = t.updatedAt || t.createdAt;
  return String(c) >= String(last);
}
export function taskIsStale(t, currentUser) {
  if (t.status === "Concluído") return false;
  if (taskCienteByMe(t, currentUser)) return false;
  const last = new Date(t.updatedAt || t.createdAt).getTime();
  return Date.now() - last > 2 * 60 * 60 * 1000;
}

export function myNotifs(notifs, currentUser) {
  if (!currentUser) return [];
  return (notifs || []).filter((n) => n.userId === currentUser.id).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
export function myUnreadCount(notifs, currentUser) {
  return myNotifs(notifs, currentUser).filter((n) => !n.read).length;
}

export function demandaUnreadCount(demandas) {
  return (demandas || []).filter((d) => !d.lida).length;
}

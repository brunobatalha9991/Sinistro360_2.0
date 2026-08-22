import { createStore } from "./createStore";

// Porte 1:1 de _taskModalEl/openTaskModal/closeTaskModal e _demandaPrefill
// do HTML original — qual tarefa (se alguma) está aberta no modal, e o
// preenchimento inicial quando a tarefa nasce de uma demanda.
export const taskModalStore = createStore({ open: false, taskId: null });
export const demandaPrefillStore = createStore({ value: null });
// Qual tarefa (se alguma) está aguardando vínculo automático com o próximo
// processo criado no módulo Abertura — usado pelo atalho "abrir novo
// atendimento" dentro da tarefa de Mesa de Atendimento.
export const pendingTaskLinkStore = createStore({ taskId: null });

export function openTaskModal(taskId) { taskModalStore.set({ open: true, taskId: taskId || null }); }
export function closeTaskModal() { taskModalStore.set({ open: false, taskId: null }); }
export function setDemandaPrefill(v) { demandaPrefillStore.set({ value: v }); }
export function takeDemandaPrefill() {
  const v = demandaPrefillStore.state.value;
  demandaPrefillStore.set({ value: null });
  return v;
}
export function setPendingTaskLink(taskId) { pendingTaskLinkStore.set({ taskId: taskId || null }); }
export function takePendingTaskLink() {
  const v = pendingTaskLinkStore.state.taskId;
  pendingTaskLinkStore.set({ taskId: null });
  return v;
}

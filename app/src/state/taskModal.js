import { createStore } from "./createStore";

// Porte 1:1 de _taskModalEl/openTaskModal/closeTaskModal e _demandaPrefill
// do HTML original — qual tarefa (se alguma) está aberta no modal, e o
// preenchimento inicial quando a tarefa nasce de uma demanda.
export const taskModalStore = createStore({ open: false, taskId: null });
export const demandaPrefillStore = createStore({ value: null });

export function openTaskModal(taskId) { taskModalStore.set({ open: true, taskId: taskId || null }); }
export function closeTaskModal() { taskModalStore.set({ open: false, taskId: null }); }
export function setDemandaPrefill(v) { demandaPrefillStore.set({ value: v }); }
export function takeDemandaPrefill() {
  const v = demandaPrefillStore.state.value;
  demandaPrefillStore.set({ value: null });
  return v;
}

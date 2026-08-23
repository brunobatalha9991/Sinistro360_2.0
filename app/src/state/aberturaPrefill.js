import { createStore } from "./createStore";

// Preenchimento inicial do módulo Abertura quando ele nasce a partir de
// outra tela (vínculo com o módulo Clientes, a pedido do usuário) — mesmo
// padrão de demandaPrefillStore em state/taskModal.js.
export const aberturaPrefillStore = createStore({ value: null });
export function setAberturaPrefill(v) { aberturaPrefillStore.set({ value: v }); }
export function takeAberturaPrefill() {
  const v = aberturaPrefillStore.state.value;
  aberturaPrefillStore.set({ value: null });
  return v;
}

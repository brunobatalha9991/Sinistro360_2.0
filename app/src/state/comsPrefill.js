import { createStore } from "./createStore";

// Pré-preenchimento da caixa "Comunicação com o Cliente" (aba Histórico de
// um processo) a partir de um e-mail — usado pelo botão "Transformar em
// atualização" do alerta de e-mail (ver DetailHeader.jsx). Só preenche o
// campo; quem decide se registra é o usuário (nada é salvo sozinho).
export const comsPrefillStore = createStore({ value: null });

export function setComsPrefill(v) { comsPrefillStore.set({ value: v }); }
export function takeComsPrefill() {
  const v = comsPrefillStore.state.value;
  comsPrefillStore.set({ value: null });
  return v;
}

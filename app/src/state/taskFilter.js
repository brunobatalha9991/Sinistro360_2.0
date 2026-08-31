import { createStore } from "./createStore";

// Porte 1:1 de "var taskFilter" do HTML original, ampliado a pedido do
// usuário: `usuarioId` ("eu" = o próprio usuário logado, "todos" = todo
// mundo — só admin/VIP conseguem trocar de "eu"; qualquer outro valor é um
// id de usuário específico), `papel` (origem/destinatario/ambos, só entra
// em efeito com um usuário de referência definido, não em "todos"),
// `showFilters` (ver/ocultar o card de filtros) e `ordemManual` (alterna
// entre a ordenação automática e a reordenação manual por arrasto ↑/↓).
export const taskFilterStore = createStore({
  status: "todas", urg: "todas", tipo: "todas", tipoAtendimento: "todas", stale: false, verArquivadas: false, q: "",
  usuarioId: "eu", papel: "ambos", showFilters: true, ordemManual: false, proximaAcaoAte: "",
});

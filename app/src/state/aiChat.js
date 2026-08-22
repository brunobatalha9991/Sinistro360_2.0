import { createStore } from "./createStore";

// Estado do chat do Assistente IA — igual ao padrão de taskModal.js: store
// reativa (createStore) + funções auxiliares exportadas ao lado.
//
// messages: histórico exibido na UI. Cada item:
//   { id, role: "user"|"model"|"error", type: "text"|"action_proposal",
//     text?, proposal?: { toolName, args, summary, after, status: "pending"|"confirmed"|"cancelled" } }
// contents: histórico no formato bruto da API do Gemini (role/parts), usado
//   internamente por useAiChatActions.js para manter o ciclo de function
//   calling — não é renderizado diretamente.
//
// Conversa vive só em memória (reseta ao recarregar a página) — decisão do
// MVP para não gravar conteúdo de conversa (potencialmente sensível) em
// registro sincronizado entre usuários.
export const aiChatStore = createStore({ messages: [], contents: [], busy: false, error: null });

// apply() de cada proposta de escrita pendente de confirmação — não é
// estado reativo (só o clique de Confirmar/Cancelar precisa), por isso fica
// fora do createStore, indexado pelo id da mensagem de proposta.
const pendingApplies = {};

export function pushMessage(msg) {
  aiChatStore.patch({ messages: [...aiChatStore.state.messages, msg] });
}
export function pushContent(content) {
  aiChatStore.patch({ contents: [...aiChatStore.state.contents, content] });
}
export function setBusy(busy) { aiChatStore.patch({ busy }); }
export function setError(error) { aiChatStore.patch({ error }); }

export function registerPendingApply(messageId, entry) { pendingApplies[messageId] = entry; }
export function takePendingApply(messageId) {
  const entry = pendingApplies[messageId];
  delete pendingApplies[messageId];
  return entry || null;
}

export function resolveProposal(messageId, status) {
  aiChatStore.patch({
    messages: aiChatStore.state.messages.map((m) =>
      m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, status } } : m
    ),
  });
}

import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";
import { generateContent, isGeminiConfigured } from "../ai/geminiApi";
import { buildSystemInstruction } from "../ai/systemPrompt";
import { getTool, toGeminiFunctionDeclarations } from "../ai/tools";
import {
  aiChatStore, pushMessage, pushContent, setBusy, setError,
  resolveProposal, registerPendingApply, takePendingApply,
} from "../state/aiChat";
import { uid } from "../logic/format";

// Limite de iterações do ciclo de function calling numa mesma resposta —
// evita loop infinito se o modelo insistir em chamar tools sem nunca
// fechar com texto.
const MAX_TOOL_ITERATIONS = 5;

export function useAiChatActions() {
  const data = useData();
  const { currentUser } = useAuth();
  const ctx = { ...data, currentUser };

  // Orquestra o ciclo: chama o Gemini, executa as tools de leitura
  // automaticamente e repete; para numa tool de escrita (aguardando
  // confirmação do usuário) ou quando o modelo responde só com texto.
  async function runLoop() {
    let iterations = 0;
    try {
      while (iterations < MAX_TOOL_ITERATIONS) {
        iterations++;
        const result = await generateContent({
          systemInstruction: buildSystemInstruction(ctx),
          contents: aiChatStore.state.contents,
          tools: toGeminiFunctionDeclarations(),
        });

        if (result.parts.length) pushContent({ role: "model", parts: result.parts });

        if (!result.functionCalls.length) {
          pushMessage({ id: uid("msg"), role: "model", type: "text", text: result.text || "Não obtive uma resposta." });
          setBusy(false);
          return;
        }

        let paused = false;
        for (const call of result.functionCalls) {
          const tool = getTool(call.name);
          if (!tool) {
            pushContent({ role: "user", parts: [{ functionResponse: { name: call.name, id: call.id, response: { error: "Ferramenta desconhecida." } } }] });
            continue;
          }

          const outcome = tool.run(call.args || {}, ctx) || {};
          if (tool.requiresConfirmation && !outcome.error) {
            const messageId = uid("msg");
            registerPendingApply(messageId, { apply: outcome.apply, callName: call.name, callId: call.id });
            pushMessage({
              id: messageId, role: "model", type: "action_proposal",
              proposal: { toolName: tool.name, args: call.args || {}, summary: outcome.summary, after: outcome.after, status: "pending" },
            });
            paused = true;
          } else {
            pushContent({ role: "user", parts: [{ functionResponse: { name: call.name, id: call.id, response: outcome } }] });
          }
        }
        if (paused) { setBusy(false); return; }
      }
      pushMessage({ id: uid("msg"), role: "error", type: "text", text: "O assistente entrou em um ciclo muito longo sem concluir. Tente reformular o pedido." });
      setBusy(false);
    } catch (e) {
      const msg = e.message || "Erro ao falar com o Gemini.";
      setError(msg);
      pushMessage({ id: uid("msg"), role: "error", type: "text", text: msg });
      setBusy(false);
    }
  }

  async function sendMessage(text) {
    const t = String(text || "").trim();
    if (!t) return;
    if (!isGeminiConfigured()) { setError("Configure VITE_GEMINI_API_KEY para usar o assistente."); return; }
    setError(null);
    pushMessage({ id: uid("msg"), role: "user", type: "text", text: t });
    pushContent({ role: "user", parts: [{ text: t }] });
    setBusy(true);
    await runLoop();
  }

  async function confirmProposal(messageId) {
    const entry = takePendingApply(messageId);
    resolveProposal(messageId, "confirmed");
    if (entry) {
      try {
        entry.apply();
        pushContent({ role: "user", parts: [{ functionResponse: { name: entry.callName, id: entry.callId, response: { status: "confirmed" } } }] });
      } catch (e) {
        pushContent({ role: "user", parts: [{ functionResponse: { name: entry.callName, id: entry.callId, response: { status: "error", error: e.message } } }] });
      }
    }
    setBusy(true);
    await runLoop();
  }

  async function cancelProposal(messageId) {
    const entry = takePendingApply(messageId);
    resolveProposal(messageId, "cancelled");
    pushContent({ role: "user", parts: [{ functionResponse: { name: entry ? entry.callName : "", id: entry ? entry.callId : undefined, response: { status: "cancelled", reason: "Usuário cancelou a ação." } } }] });
    setBusy(true);
    await runLoop();
  }

  return { sendMessage, confirmProposal, cancelProposal };
}

import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";
import { useIaMemoria } from "./useIaMemoria";
import { canEdit } from "../data/auth";
import { generateContent, isGeminiConfigured } from "../ai/geminiApi";
import { buildSystemInstruction } from "../ai/systemPrompt";
import { buildEnvelope } from "../ai/responseEnvelope";
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

// Orquestrador de IA (Fase 3 — docs/ia-sinistros/arquitetura-ia.md). Não há
// backend/servidor neste projeto (decisão registrada na auditoria), então
// este hook É o único ponto por onde toda chamada ao Gemini e toda
// execução de tool passa — é aqui, e só aqui, que autorização, evidências e
// auditoria são aplicadas, nunca confiando no que o modelo "promete" fazer.
export function useAiChatActions() {
  const data = useData();
  const { currentUser } = useAuth();
  const { memoriasAtivas } = useIaMemoria();
  const ctx = { ...data, currentUser, memoriasAtivas };

  function registrarAuditoria(entry) {
    const registro = {
      id: uid("aia"), at: new Date().toISOString(),
      usuarioId: currentUser ? currentUser.id : null,
      usuarioNome: currentUser ? currentUser.nome : null,
      ...entry,
    };
    // Sem backend: gravação direta na mesma coleção que o resto do app já
    // usa (Firestore/localStorage) — não é à prova de adulteração via
    // console do navegador, mas fica centralizada em vez de só em memória.
    // Ver "Risco aceito" em docs/ia-sinistros/regras-responsabilidade.md.
    data.saveRecord("corp_ai_auditoria", (current) => [...(current || []), registro]);
  }

  // Orquestra o ciclo: chama o Gemini, autoriza e executa as tools de
  // leitura automaticamente e repete; para numa tool de escrita (aguardando
  // confirmação do usuário) ou quando o modelo responde só com texto.
  // `pergunta` é só um rótulo para a auditoria (a pergunta original do
  // usuário, ou "[confirmação]"/"[cancelamento]" quando o ciclo continua
  // depois de uma proposta resolvida).
  async function runLoop(pergunta) {
    let iterations = 0;
    const ferramentasChamadas = [];
    const fontesDoTurno = [];
    const metodologiasDoTurno = [];
    const filtrosDoTurno = {};
    let bloqueadoPorPermissao = false;

    function auditarEFinalizar(extra) {
      registrarAuditoria({
        pergunta, ferramentasChamadas, fontesIds: fontesDoTurno.map((f) => f.id),
        bloqueadoPorPermissao, memoriasUsadasIds: (ctx.memoriasAtivas || []).map((m) => m.id),
        ...extra,
      });
      setBusy(false);
    }

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
          const envelope = buildEnvelope({
            texto: result.text || "Não obtive uma resposta.",
            ferramentasChamadas, fontes: fontesDoTurno, metodologias: metodologiasDoTurno,
            filtrosAplicados: filtrosDoTurno,
          });
          pushMessage({ id: uid("msg"), role: "model", type: "text", text: envelope.resposta, envelope });
          auditarEFinalizar({ tipoResposta: envelope.tipo_resposta, confianca: envelope.confianca, requerConfirmacao: false });
          return;
        }

        let paused = false;
        for (const call of result.functionCalls) {
          const tool = getTool(call.name);
          if (!tool) {
            pushContent({ role: "user", parts: [{ functionResponse: { name: call.name, id: call.id, response: { error: "Ferramenta desconhecida." } } }] });
            continue;
          }
          ferramentasChamadas.push({ nome: tool.name, args: call.args || {} });
          Object.assign(filtrosDoTurno, call.args || {});

          // Autorização: ações de escrita exigem exatamente a mesma regra
          // (canEdit) já aplicada na interface para humanos (ResponsavelBox,
          // TaskModal) — a IA nunca pode fazer mais do que o usuário logado
          // já poderia fazer manualmente.
          if (tool.requiresConfirmation && !canEdit(currentUser)) {
            bloqueadoPorPermissao = true;
            pushContent({ role: "user", parts: [{ functionResponse: { name: call.name, id: call.id, response: { error: `Perfil "${currentUser?.role || "consulta"}" não tem permissão para executar ações de escrita neste sistema.` } } }] });
            continue;
          }

          const outcome = tool.run(call.args || {}, ctx) || {};
          if (outcome.fontes) fontesDoTurno.push(...outcome.fontes);
          if (outcome.metodologia) metodologiasDoTurno.push(outcome.metodologia);

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
        if (paused) { auditarEFinalizar({ requerConfirmacao: true }); return; }
      }
      pushMessage({ id: uid("msg"), role: "error", type: "text", text: "O assistente entrou em um ciclo muito longo sem concluir. Tente reformular o pedido." });
      auditarEFinalizar({ erro: "ciclo_longo_sem_conclusao" });
    } catch (e) {
      const msg = e.message || "Erro ao falar com o Gemini.";
      setError(msg);
      pushMessage({ id: uid("msg"), role: "error", type: "text", text: msg });
      auditarEFinalizar({ erro: msg });
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
    await runLoop(t);
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
    await runLoop(`[confirmação de ação: ${entry ? entry.callName : "desconhecida"}]`);
  }

  async function cancelProposal(messageId) {
    const entry = takePendingApply(messageId);
    resolveProposal(messageId, "cancelled");
    pushContent({ role: "user", parts: [{ functionResponse: { name: entry ? entry.callName : "", id: entry ? entry.callId : undefined, response: { status: "cancelled", reason: "Usuário cancelou a ação." } } }] });
    setBusy(true);
    await runLoop(`[cancelamento de ação: ${entry ? entry.callName : "desconhecida"}]`);
  }

  return { sendMessage, confirmProposal, cancelProposal };
}

import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";
import { uid } from "../logic/format";

// Feedback do usuário sobre uma resposta da IA (Fase 6) — sempre uma ação
// humana explícita (botão na UI), nunca inferido automaticamente.
export function useIaFeedback() {
  const { records, saveRecord } = useData();
  const { currentUser } = useAuth();

  function registrarFeedback({ respostaId, avaliacao, comentario, correcaoSugerida }) {
    if (!currentUser || !respostaId || !avaliacao) return;
    const registro = {
      id: uid("fbk"), respostaId, usuarioId: currentUser.id,
      avaliacao, comentario: comentario || "", correcaoSugerida: correcaoSugerida || "",
      createdAt: new Date().toISOString(),
    };
    saveRecord("corp_ai_feedback", (current) => [...(current || []), registro]);
  }

  function feedbackDeUsuario(respostaId) {
    return (records.corp_ai_feedback || []).find((f) => f.respostaId === respostaId && f.usuarioId === (currentUser && currentUser.id)) || null;
  }

  return { registrarFeedback, feedbackDeUsuario };
}

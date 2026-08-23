import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";

// Gravações do módulo Seguradoras (Fase 2) — mesmo estilo de
// useOverrideActions.js (updater na forma current => next, pra sobreviver
// a gravações em sequência no mesmo clique). Três coleções próprias
// (ver src/data/schema.js): corp_seguradoras (cadastro, keyed por id),
// corp_seguradora_ocorrencias e corp_seguradora_comunicacoes (arrays).
export function useSeguradoraActions() {
  const { records, saveRecord } = useData();
  const { currentUser } = useAuth();

  return {
    seguradoras: records.corp_seguradoras || {},
    ocorrencias: records.corp_seguradora_ocorrencias || [],
    comunicacoes: records.corp_seguradora_comunicacoes || [],

    saveCadastro(seguradoraId, patch) {
      saveRecord("corp_seguradoras", (current) => {
        const cur = current || {};
        return { ...cur, [seguradoraId]: { ...(cur[seguradoraId] || {}), ...patch } };
      });
    },

    // tipo: "reclamacao" | "feedback". claimId é opcional (vínculo com
    // processo existente).
    addOcorrencia(seguradoraId, { tipo, titulo, descricao, data, claimId }) {
      saveRecord("corp_seguradora_ocorrencias", (current) => {
        const atuais = current || [];
        const nova = {
          id: "ocr_" + Math.random().toString(36).slice(2, 9),
          seguradoraId, tipo, titulo: (titulo || "").trim(), descricao: (descricao || "").trim(),
          data: data || "", claimId: claimId || null, status: "aberta",
          who: (currentUser && currentUser.nome) || "—", at: new Date().toISOString(),
        };
        return [...atuais, nova];
      });
    },
    resolverOcorrencia(ocorrenciaId) {
      saveRecord("corp_seguradora_ocorrencias", (current) => (current || []).map((o) => (
        o.id === ocorrenciaId ? { ...o, status: "resolvida" } : o
      )));
    },
    excluirOcorrencia(ocorrenciaId) {
      saveRecord("corp_seguradora_ocorrencias", (current) => (current || []).filter((o) => o.id !== ocorrenciaId));
    },

    // tipo: "Ligação" | "Reunião" | "Visita" | "WhatsApp" | "Presencial".
    addComunicacaoGestor(seguradoraId, { tipo, data, resumo }) {
      saveRecord("corp_seguradora_comunicacoes", (current) => {
        const atuais = current || [];
        const nova = {
          id: "com_" + Math.random().toString(36).slice(2, 9),
          seguradoraId, tipo, data: data || "", resumo: (resumo || "").trim(),
          who: (currentUser && currentUser.nome) || "—", at: new Date().toISOString(),
        };
        return [...atuais, nova];
      });
    },
    excluirComunicacaoGestor(comunicacaoId) {
      saveRecord("corp_seguradora_comunicacoes", (current) => (current || []).filter((x) => x.id !== comunicacaoId));
    },
  };
}

import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";

// Gravações do módulo Clientes (Fase 3) — mesmo estilo de
// useOverrideActions.js (updater na forma current => next, pra sobreviver
// a gravações em sequência no mesmo clique). Três coleções próprias
// (ver src/data/schema.js): corp_clientes (cadastro, keyed por id),
// corp_cliente_ocorrencias e corp_cliente_comunicacoes (arrays).
export function useClienteActions() {
  const { records, saveRecord } = useData();
  const { currentUser } = useAuth();

  return {
    clientes: records.corp_clientes || {},
    ocorrencias: records.corp_cliente_ocorrencias || [],
    comunicacoes: records.corp_cliente_comunicacoes || [],

    saveCadastro(clienteId, patch) {
      saveRecord("corp_clientes", (current) => {
        const cur = current || {};
        return { ...cur, [clienteId]: { ...(cur[clienteId] || {}), ...patch } };
      });
    },

    // tipo: "reclamacao" | "feedback". claimId é opcional (vínculo com
    // processo existente).
    addOcorrencia(clienteId, { tipo, titulo, descricao, data, claimId }) {
      saveRecord("corp_cliente_ocorrencias", (current) => {
        const atuais = current || [];
        const nova = {
          id: "ocr_" + Math.random().toString(36).slice(2, 9),
          clienteId, tipo, titulo: (titulo || "").trim(), descricao: (descricao || "").trim(),
          data: data || "", claimId: claimId || null, status: "aberta",
          who: (currentUser && currentUser.nome) || "—", at: new Date().toISOString(),
        };
        return [...atuais, nova];
      });
    },
    resolverOcorrencia(ocorrenciaId) {
      saveRecord("corp_cliente_ocorrencias", (current) => (current || []).map((o) => (
        o.id === ocorrenciaId ? { ...o, status: "resolvida" } : o
      )));
    },
    excluirOcorrencia(ocorrenciaId) {
      saveRecord("corp_cliente_ocorrencias", (current) => (current || []).filter((o) => o.id !== ocorrenciaId));
    },

    // tipo: "Ligação" | "Reunião" | "Visita" | "WhatsApp" | "Presencial".
    addComunicacaoGestor(clienteId, { tipo, data, resumo }) {
      saveRecord("corp_cliente_comunicacoes", (current) => {
        const atuais = current || [];
        const nova = {
          id: "com_" + Math.random().toString(36).slice(2, 9),
          clienteId, tipo, data: data || "", resumo: (resumo || "").trim(),
          who: (currentUser && currentUser.nome) || "—", at: new Date().toISOString(),
        };
        return [...atuais, nova];
      });
    },
    excluirComunicacaoGestor(comunicacaoId) {
      saveRecord("corp_cliente_comunicacoes", (current) => (current || []).filter((x) => x.id !== comunicacaoId));
    },
  };
}

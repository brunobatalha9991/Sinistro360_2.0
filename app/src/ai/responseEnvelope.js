import { TIMEZONE_OFICIAL } from "../logic/responsabilidade";

// Envelope de resposta estruturado (Fase 3 — docs/ia-sinistros/arquitetura-ia.md).
// Construído pelo ORQUESTRADOR (useAiChatActions.js), nunca pelo texto que o
// modelo devolve — "fontes"/"metodologia"/"confiança" vêm do que as tools
// realmente executaram nesta resposta, não de uma autodeclaração do Gemini.
const TIPO_POR_TOOL = {
  report_claims_summary: "analise",
  search_claims: "lista",
};

const TITULO_POR_TIPO = {
  analise: "Análise",
  lista: "Lista de sinistros",
  resposta: "Resposta do assistente",
};

export function buildEnvelope({ texto, ferramentasChamadas, fontes, metodologias, filtrosAplicados }) {
  const nomes = (ferramentasChamadas || []).map((f) => f.nome);
  const tipo_resposta = nomes.reduce((acc, nome) => TIPO_POR_TOOL[nome] || acc, "resposta");

  const fontesUnicas = [];
  const vistos = new Set();
  (fontes || []).forEach((f) => {
    const chave = f.tipo + ":" + f.id;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    fontesUnicas.push(f);
  });

  const limitacoes = [];
  if (!fontesUnicas.length) {
    limitacoes.push("Esta resposta não consultou nenhuma ferramenta de dados do sistema — pode não refletir informações reais e atualizadas.");
  }

  return {
    tipo_resposta,
    titulo: TITULO_POR_TIPO[tipo_resposta] || "Resposta do assistente",
    resposta: texto,
    dados_estruturados: {},
    fontes: fontesUnicas,
    filtros_aplicados: filtrosAplicados || {},
    periodo_analisado: { inicio: null, fim: null, timezone: TIMEZONE_OFICIAL },
    metodologia: (metodologias || []).filter(Boolean).join(" "),
    confianca: fontesUnicas.length ? "alta" : "baixa",
    limitacoes,
    requer_confirmacao: false,
  };
}

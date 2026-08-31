import { visibleClaims, campoEfetivo, situacaoEfetiva, getTemp } from "../../logic/claims";

// Tool de leitura: agregação (contagem) de sinistros, mesmo padrão de
// src/pages/Relatorios.jsx. O agrupamento é sempre calculado em JS a partir
// dos dados reais — nunca inventado pelo modelo.
export const reportClaimsTool = {
  name: "report_claims_summary",
  description:
    "Gera um relatório agregado (contagem) de sinistros agrupados por situação, seguradora ou temperatura. Use para perguntas de análise/relatório (ex.: 'quantos sinistros por seguradora?').",
  parameters: {
    type: "OBJECT",
    properties: {
      groupBy: { type: "STRING", description: "Campo de agrupamento.", enum: ["situacao", "cia", "temperatura"] },
      filterCia: { type: "STRING", description: "Opcional: restringe o relatório a uma seguradora específica antes de agrupar." },
    },
    required: ["groupBy"],
  },
  requiresConfirmation: false,
  run(args, ctx) {
    const { records, config, currentUser } = ctx;
    const overrides = records.corp_overrides || {};
    const atendTemplateCfg = config && config.corp_atendimento_template;
    const templates = (config && config.corp_journey_templates) || {};
    const groupBy = args.groupBy === "cia" || args.groupBy === "temperatura" ? args.groupBy : "situacao";
    const filtroCia = String(args.filterCia || "").trim().toLowerCase();

    let claims = visibleClaims(records.corp_claims, overrides, currentUser);
    if (filtroCia) {
      claims = claims.filter((c) => String(campoEfetivo(overrides, c, "cia") || "").toLowerCase().indexOf(filtroCia) >= 0);
    }

    const grupos = {};
    claims.forEach((c) => {
      let chave;
      if (groupBy === "cia") chave = campoEfetivo(overrides, c, "cia") || "Sem seguradora";
      else if (groupBy === "temperatura") chave = getTemp(overrides, c.id) || "Não definida";
      else chave = situacaoEfetiva(overrides, c, atendTemplateCfg, templates).label;
      grupos[chave] = (grupos[chave] || 0) + 1;
    });

    return {
      groupBy, totalGeral: claims.length, grupos,
      metodologia: `Contagem de corp_claims (visibleClaims) agrupada por ${groupBy === "cia" ? "seguradora efetiva (campoEfetivo cia)" : groupBy === "temperatura" ? "temperatura (overrides.temperatura, 'Não definida' quando ausente)" : "situação efetiva (situacaoEfetiva)"}${filtroCia ? `, restrito à seguradora "${args.filterCia}"` : ""}.`,
      fontes: [{
        tipo: "regra", id: "report_claims_summary",
        descricao: `Agregação de ${claims.length} sinistro(s) por ${groupBy}`,
        data_hora: new Date().toISOString(), url_interna: "#/relatorios",
      }],
    };
  },
};

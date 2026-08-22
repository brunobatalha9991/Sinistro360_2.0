import { explicarIndicador } from "../catalog/dashboards";

export const explicarDashboardTool = {
  name: "explicar_dashboard",
  description: "Explica um dashboard ou um indicador/card específico: fórmula de cálculo, fonte dos dados e limitações conhecidas. Use quando o usuário perguntar 'como é calculado este card?', 'de onde vem este número?' ou similar.",
  parameters: {
    type: "OBJECT",
    properties: {
      dashboard: { type: "STRING", description: "Chave do dashboard: 'dashboard', 'relatorios' ou 'desempenho'.", enum: ["dashboard", "relatorios", "desempenho"] },
      indicador: { type: "STRING", description: "Opcional: chave ou nome do indicador específico dentro do dashboard. Omita para listar todos os indicadores do dashboard." },
    },
    required: ["dashboard"],
  },
  requiresConfirmation: false,
  run(args) {
    const explicacao = explicarIndicador(args.dashboard, args.indicador);
    if (!explicacao) return { error: `Dashboard "${args.dashboard}" não encontrado no catálogo.` };
    return {
      explicacao,
      metodologia: "Catálogo funcional mantido em src/ai/catalog/dashboards.js, com fórmula conferida linha a linha contra o código das telas (ver docs/ia-sinistros/catalogo-dashboards.md).",
      fontes: [{ tipo: "regra", id: "catalogo_dashboards:" + args.dashboard, descricao: `Catálogo do dashboard "${explicacao.nome || args.dashboard}"`, data_hora: null, url_interna: "#/" + args.dashboard }],
    };
  },
};

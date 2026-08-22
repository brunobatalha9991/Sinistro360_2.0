import { listarCatalogoFiltros } from "../catalog/filtros";

export const listarFiltrosTool = {
  name: "listar_filtros_modulo",
  description: "Lista os filtros disponíveis num módulo do sistema (sinistros, dashboard, desempenho), com o significado de cada um. Use quando o usuário perguntar 'quais filtros existem em...' ou precisar entender como filtrar uma tela.",
  parameters: {
    type: "OBJECT",
    properties: {
      modulo: { type: "STRING", description: "Chave do módulo: 'sinistros', 'dashboard' ou 'desempenho'. Omita para listar todos." },
    },
  },
  requiresConfirmation: false,
  run(args) {
    const catalogo = listarCatalogoFiltros(args.modulo);
    if (args.modulo && !Object.keys(catalogo).length) {
      return { error: `Módulo "${args.modulo}" não encontrado no catálogo de filtros.` };
    }
    return {
      catalogo,
      metodologia: "Catálogo funcional mantido em src/ai/catalog/filtros.js, conferido contra o código das telas na auditoria inicial (docs/ia-sinistros/catalogo-filtros.md).",
      fontes: [{ tipo: "regra", id: "catalogo_filtros", descricao: "Catálogo funcional de filtros", data_hora: null, url_interna: null }],
    };
  },
};

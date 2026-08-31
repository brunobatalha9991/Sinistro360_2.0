// Catálogo funcional de filtros — Fase 4 (IA Sinistros). Fonte única de
// verdade usada tanto pela tool listar_filtros_modulo quanto por
// docs/ia-sinistros/catalogo-filtros.md (mantidos em sincronia manualmente:
// não há introspecção automática de schema possível neste projeto — ver
// auditoria-inicial.md, seção D). Atualizar aqui sempre que um filtro for
// adicionado/alterado nas telas.
export const CATALOGO_FILTROS = {
  sinistros: {
    modulo: "Sinistros", rota: "sinistros", arquivo: "src/pages/Sinistros.jsx",
    filtros: [
      { campo: "q", label: "Busca por texto", tipo: "texto livre", detalhe: "segurado, placa, nº sinistro, nº apólice, seguradora, tipo, oficina, ramo (campos efetivos)" },
      { campo: "tipo", label: "Tipo de parte", tipo: "chip único", opcoes: "Todos, Segurado, Terceiro, Atendimento" },
      { campo: "status", label: "Situação do processo", tipo: "chip único", opcoes: "Todos, Em andamento, Pendente, Indenizado, Constatação, Sem indenização", detalhe: "usa a situação EFETIVA (jornada do usuário), não o campo bruto da API CORP. \"Constatação\" = atendimento aberto só pra cobertura ao terceiro, sem indenização ao segurado; conta como desfecho positivo (ver taxa_desfecho_positivo no catálogo de dashboards)" },
      { campo: "etapa", label: "Etapa da jornada", tipo: "chip único dinâmico", detalhe: "gerado a partir de todos os templates de jornada configurados" },
      { campo: "caminho", label: "Caminho (Perda Parcial/Integral)", tipo: "chip único", opcoes: "Todos, Parcial, Integral" },
      { campo: "ocoDe / ocoAte", label: "Data de ocorrência (intervalo)", tipo: "intervalo de data" },
      { campo: "aviDe / aviAte", label: "Data de aviso (intervalo)", tipo: "intervalo de data" },
      { campo: "pa", label: "Próxima ação até", tipo: "data" },
      { campo: "atrasado", label: "Atrasados", tipo: "booleano (chip toggle)", detalhe: "próxima ação vencida" },
      { campo: "semAtu", label: "Sem atualização", tipo: "booleano (chip toggle)", detalhe: "sem interação há mais de 3 dias corridos" },
      { campo: "manual", label: "Criados manualmente", tipo: "booleano (chip toggle)", detalhe: "processos abertos via módulo Abertura, não vindos da API CORP" },
      { campo: "aberto", label: "Em aberto", tipo: "booleano (chip toggle)", detalhe: "situação efetiva Pendente ou Em andamento" },
      { campo: "responsavel", label: "Responsável", tipo: "seleção", detalhe: "só considera processos Pendente/Em andamento; opção 'sem responsável' disponível para atendente/admin" },
      { campo: "sitatend", label: "Situação de atendimento", tipo: "seleção configurável (corp_sit_options)" },
      { campo: "termometro", label: "Termômetro (temperatura)", tipo: "seleção configurável (corp_temp_options)" },
    ],
    observacao: "Todos os filtros são client-side, em memória (não persistem entre sessões), aplicados sobre o array completo de sinistros já carregado. Sem filtros salvos e sem diferença de filtros por perfil.",
  },
  dashboard: {
    modulo: "Dashboard", rota: "dashboard", arquivo: "src/pages/Dashboard.jsx",
    filtros: [
      { campo: "ocoDe / ocoAte", label: "Data de ocorrência (intervalo)", tipo: "intervalo de data", detalhe: "atalhos rápidos: 7/30/90/180/365 dias, 'Este ano', 'Tudo'" },
      { campo: "cia", label: "Seguradora", tipo: "seleção" },
      { campo: "ramo", label: "Ramo", tipo: "seleção" },
      { campo: "oficina", label: "Oficina", tipo: "seleção" },
      { campo: "tipo", label: "Tipo de parte", tipo: "seleção" },
      { campo: "status", label: "Situação (efetiva)", tipo: "seleção" },
      { campo: "caminho", label: "Caminho", tipo: "seleção" },
      { campo: "manual", label: "Criados manualmente", tipo: "booleano" },
      { campo: "aberto", label: "Em aberto", tipo: "booleano" },
    ],
    observacao: "Estado local da página (não compartilhado com o filtro de Sinistros), exceto pelo drill-down: clicar num gráfico/linha navega para Sinistros já com parte do filtro aplicado (dashGoToSinistros).",
  },
  desempenho: {
    modulo: "Desempenho", rota: "desempenho", arquivo: "src/pages/Desempenho.jsx",
    filtros: [
      { campo: "periodoDe / periodoAte", label: "Período (intervalo de data)", tipo: "intervalo de data", detalhe: "usa o timezone oficial America/Sao_Paulo para exibição" },
      { campo: "usuarioId", label: "Usuário", tipo: "seleção", detalhe: "vazio = todos os usuários" },
    ],
    observacao: "Fase 5 (IA Sinistros). Métricas calculadas a partir de corp_responsabilidade_historico — ver docs/ia-sinistros/metricas-desempenho.md.",
  },
};

export function listarCatalogoFiltros(moduloChave) {
  if (moduloChave && CATALOGO_FILTROS[moduloChave]) return { [moduloChave]: CATALOGO_FILTROS[moduloChave] };
  if (moduloChave) return {};
  return CATALOGO_FILTROS;
}

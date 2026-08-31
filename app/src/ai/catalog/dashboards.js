// Catálogo funcional de dashboards/KPIs — Fase 4 (IA Sinistros). Fonte
// única de verdade usada pela tool explicar_dashboard e por
// docs/ia-sinistros/catalogo-dashboards.md — mantidos em sincronia manual.
// Toda fórmula aqui foi conferida linha a linha contra src/pages/Dashboard.jsx
// e src/logic/claims.js (buildAggregation) na auditoria inicial.
export const CATALOGO_DASHBOARDS = {
  dashboard: {
    nome: "Dashboard", rota: "dashboard", arquivo: "src/pages/Dashboard.jsx",
    indicadores: [
      { chave: "sinistros_no_recorte", label: "Sinistros no recorte", formula: "rows.length (após aplicar dashFilter)", fonte: "corp_claims (visibleClaims)" },
      { chave: "por_situacao", label: "Em andamento / Indenizados / Contatação / Sem indenização / Pendentes / Negados", formula: "contagem por situacaoEfetiva(overrides, c).label", fonte: "corp_claims + corp_overrides" },
      { chave: "taxa_indenizacao", label: "Taxa de indenização", formula: "indenizados / total * 100", fonte: "calculado sobre o recorte" },
      { chave: "contatacoes", label: "Contatações", formula: "contagem de situacaoEfetiva == 'Contatação' — atendimento aberto só pra cobertura ao terceiro, sem indenização ao segurado", fonte: "corp_claims + corp_overrides" },
      { chave: "taxa_desfecho_positivo", label: "Taxa de desfecho positivo", formula: "(indenizados + contatações) / total * 100", fonte: "calculado sobre o recorte", limitacoes: "Contatação não entra nos valores financeiros (Total indenizado/ticket médio), só nesta taxa combinada" },
      { chave: "atrasados", label: "Atrasados", formula: "isAtrasado(): nextAction.date < hoje", fonte: "corp_overrides.nextAction" },
      { chave: "sem_atualizacao", label: "Sem atualização", formula: "isSemAtualizacao(): sem comms OU último comm com mais de 3 dias corridos", fonte: "corp_overrides.comms", limitacoes: "3 dias corridos fixos no código, não dias úteis nem calendário de feriados" },
      { chave: "financeiro", label: "Total avaliado / indenizado / franquias / ticket médio", formula: "soma de valavi/valind/franquia do recorte; ticket médio = totalIndenizado / indenizados", fonte: "corp_claims" },
      { chave: "tma", label: "Tempo médio de abertura (TMA)", formula: "média de diasEntre(datoco, datavi)", fonte: "corp_claims" },
      { chave: "tme", label: "Tempo médio de encerramento (TME)", formula: "média de diasEntre(datavi, datenc)", fonte: "corp_claims" },
      { chave: "tmr", label: "Tempo médio de reparo (TMR)", formula: "média de diasEntre(datavi, data de conclusão da etapa), só caminho Perda Parcial", fonte: "corp_overrides.journeyUser" },
      { chave: "distribuicao_situacao_tipo", label: "Distribuição por Situação / Tipo (donut)", formula: "contagem por situacaoEfetiva / partyType", fonte: "corp_claims + corp_overrides" },
      { chave: "funil_etapa", label: "Funil por Etapa da Jornada", formula: "contagem por currentStage()", fonte: "corp_claims + corp_overrides + templates de jornada" },
      { chave: "evolucao_mensal", label: "Evolução mensal (12 meses) — Abertos x Encerrados", formula: "contagem por mês de datoco (abertos) e datenc (encerrados), últimos 12 meses corridos", fonte: "corp_claims" },
      { chave: "top_oficinas_seguradoras", label: "Top 10 Oficinas/Seguradoras por volume", formula: "buildAggregation() por oficina/seguradora efetiva, ordenado por contagem", fonte: "corp_claims + corp_overrides" },
      { chave: "desempenho_oficina_seguradora_ramo", label: "Tabela de desempenho por Oficina/Seguradora/Ramo", formula: "buildAggregation(): count, TMA, TME, TMR, valores, % atraso, taxa de indenização", fonte: "corp_claims + corp_overrides" },
      { chave: "criticos", label: "Sinistros mais críticos (atrasados)", formula: "rows.filter(isAtrasado), ordenado por data da próxima ação (mais atrasado primeiro), limitado a 8", fonte: "corp_claims + corp_overrides" },
    ],
    observacao: "Todo indicador tem fórmula rastreável no código-fonte — nenhum valor 'mágico' foi encontrado na auditoria. Todo gráfico/linha tem drill-down: clicar navega para Sinistros com o filtro correspondente já aplicado.",
  },
  relatorios: {
    nome: "Relatórios", rota: "relatorios", arquivo: "src/pages/Relatorios.jsx",
    indicadores: [
      { chave: "por_situacao", label: "Contagem por situação", formula: "contagem por mapSituacao(c.situacao).label (situação BRUTA da API, não a efetiva)", fonte: "corp_claims" },
      { chave: "por_seguradora", label: "Contagem por seguradora", formula: "contagem por c.cia (valor bruto, não campoEfetivo)", fonte: "corp_claims" },
    ],
    observacao: "Módulo mais simples do sistema — sem gráficos, sem drill-down, sem filtro de período. Nota: usa situação/seguradora BRUTAS da API, diferente do Dashboard (que usa os valores efetivos, considerando overrides). Diferença real registrada aqui para a IA nunca confundir os dois.",
  },
  desempenho: {
    nome: "Desempenho", rota: "desempenho", arquivo: "src/pages/Desempenho.jsx",
    indicadores: [
      { chave: "processos_assumidos", label: "Processos assumidos no período", formula: "nº de intervalos de corp_responsabilidade_historico do usuário com início dentro do período", fonte: "corp_responsabilidade_historico" },
      { chave: "processos_sob_responsabilidade", label: "Processos sob responsabilidade no período", formula: "nº de sinistros distintos com pelo menos 1 intervalo do usuário sobrepondo o período", fonte: "corp_responsabilidade_historico" },
      { chave: "estoque_atual", label: "Estoque atual (carga de trabalho)", formula: "sinistros com responsável VIGENTE = usuário e situação efetiva não finalizada", fonte: "corp_overrides.responsavelUser" },
      { chave: "atrasados_atual", label: "Atrasados no estoque atual", formula: "subconjunto do estoque atual com isAtrasado()", fonte: "corp_overrides" },
      { chave: "tempo_medio_responsabilidade", label: "Tempo médio de responsabilidade (intervalos encerrados no período)", formula: "média de (fimResponsabilidadeEm - inicioResponsabilidadeEm) em dias, só intervalos já fechados", fonte: "corp_responsabilidade_historico" },
      { chave: "sem_historico", label: "Processos do estoque atual sem histórico estruturado", formula: "contagem de sinistros do estoque atual sem nenhum intervalo em corp_responsabilidade_historico", fonte: "corp_responsabilidade_historico", limitacoes: "sinaliza qualidade de dado incompleta — rode a migração em Configurações" },
    ],
    observacao: "Fase 5. Respeita o histórico de responsabilidade por intervalo — um usuário nunca é penalizado por atraso/tempo anterior ao início da sua responsabilidade sobre o processo (ver regras-responsabilidade.md).",
  },
};

export function explicarIndicador(dashboardChave, indicadorChave) {
  const dash = CATALOGO_DASHBOARDS[dashboardChave];
  if (!dash) return null;
  if (!indicadorChave) return dash;
  const ind = dash.indicadores.find((i) => i.chave === indicadorChave || i.label.toLowerCase() === String(indicadorChave).toLowerCase());
  return ind ? { ...dash, indicadores: [ind] } : { ...dash, indicadores: [], aviso: `Indicador "${indicadorChave}" não encontrado neste dashboard.` };
}

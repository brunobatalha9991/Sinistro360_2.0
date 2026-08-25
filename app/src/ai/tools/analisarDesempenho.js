import { calcularMetricasUsuario, calcularMetricasTodosUsuarios, gerarFeedbackEPlanoDeAcao } from "../../logic/desempenho";

export const analisarDesempenhoTool = {
  name: "analisar_desempenho_usuario",
  description: "Calcula métricas de desempenho (volume, carga de trabalho atual, atrasados, tempo médio de responsabilidade, tempo médio em Pendente/Em andamento) de um usuário ou de todos, num período. Quando `usuarioNome` é informado, também devolve um feedback e um plano de ação já gerados pelo sistema (pontos fortes/atenção comparando com a média do time, e ações sugeridas) — use isso pra responder perguntas como 'como está o desempenho de fulano' ou 'me dá um feedback do fulano' sem precisar redigir a análise você mesmo, só apresentar o que a ferramenta devolveu. Usa o histórico de responsabilidade por intervalo — nunca atribui a um usuário tempo/atraso anterior ao início da responsabilidade dele sobre o processo.",
  parameters: {
    type: "OBJECT",
    properties: {
      usuarioNome: { type: "STRING", description: "Nome do usuário (opcional). Se omitido, calcula para todos os usuários." },
      periodoInicio: { type: "STRING", description: "Data inicial do período, formato AAAA-MM-DD. Opcional — sem isso, considera todo o histórico disponível." },
      periodoFim: { type: "STRING", description: "Data final do período, formato AAAA-MM-DD. Opcional." },
    },
  },
  requiresConfirmation: false,
  run(args, ctx) {
    const { records, config } = ctx;
    const users = records.corp_users || [];
    const claims = records.corp_claims || [];
    const overrides = records.corp_overrides || {};
    const historico = records.corp_responsabilidade_historico || [];
    const tasks = records.corp_tasks || [];
    const templates = config && config.corp_journey_templates;
    const atendTemplateCfg = config && config.corp_atendimento_template;

    const inicioISO = args.periodoInicio ? args.periodoInicio + "T00:00:00.000Z" : null;
    const fimISO = args.periodoFim ? args.periodoFim + "T23:59:59.999Z" : null;
    const metodologia = "Métricas calculadas a partir de corp_responsabilidade_historico (intervalos de vigência de responsável) — tempo/atraso anterior ao início da responsabilidade de cada usuário nunca é atribuído a ele. Feedback/plano de ação são gerados por regras (comparação com a média do time), não pelo modelo de IA. Ver docs/ia-sinistros/metricas-desempenho.md.";

    const todos = calcularMetricasTodosUsuarios({ users, claims, overrides, historico, periodoInicioISO: inicioISO, periodoFimISO: fimISO, atendTemplateCfg, templates, tasks });

    if (args.usuarioNome) {
      const q = String(args.usuarioNome).trim().toLowerCase();
      const usuario = users.find((u) => u.nome.toLowerCase().indexOf(q) >= 0);
      if (!usuario) return { error: `Usuário "${args.usuarioNome}" não encontrado.` };
      const m = todos.find((x) => x.usuarioId === usuario.id) || calcularMetricasUsuario({ claims, overrides, historico, usuarioId: usuario.id, periodoInicioISO: inicioISO, periodoFimISO: fimISO, atendTemplateCfg, templates, tasks });
      const analise = gerarFeedbackEPlanoDeAcao(m, todos);
      return {
        usuario: usuario.nome, metricas: m, feedback: analise, metodologia,
        fontes: [{ tipo: "regra", id: "analise_desempenho:" + usuario.id, descricao: `Métricas e feedback de desempenho de ${usuario.nome}`, data_hora: new Date().toISOString(), url_interna: "#/desempenho/" + usuario.id }],
      };
    }

    return {
      usuarios: todos, metodologia,
      fontes: [{ tipo: "regra", id: "analise_desempenho:todos", descricao: "Métricas de desempenho de todos os usuários", data_hora: new Date().toISOString(), url_interna: "#/desempenho" }],
    };
  },
};

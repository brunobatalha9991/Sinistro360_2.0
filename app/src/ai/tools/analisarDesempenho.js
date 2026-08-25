import { calcularMetricasUsuario, calcularMetricasTodosUsuarios } from "../../logic/desempenho";

export const analisarDesempenhoTool = {
  name: "analisar_desempenho_usuario",
  description: "Calcula métricas de desempenho (volume, carga de trabalho atual, atrasados, tempo médio de responsabilidade) de um usuário ou de todos, num período. Usa o histórico de responsabilidade por intervalo — nunca atribui a um usuário tempo/atraso anterior ao início da responsabilidade dele sobre o processo.",
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
    const atendTemplateCfg = config && config.corp_atendimento_template;

    const inicioISO = args.periodoInicio ? args.periodoInicio + "T00:00:00.000Z" : null;
    const fimISO = args.periodoFim ? args.periodoFim + "T23:59:59.999Z" : null;
    const metodologia = "Métricas calculadas a partir de corp_responsabilidade_historico (intervalos de vigência de responsável) — tempo/atraso anterior ao início da responsabilidade de cada usuário nunca é atribuído a ele. Ver docs/ia-sinistros/metricas-desempenho.md.";

    if (args.usuarioNome) {
      const q = String(args.usuarioNome).trim().toLowerCase();
      const usuario = users.find((u) => u.nome.toLowerCase().indexOf(q) >= 0);
      if (!usuario) return { error: `Usuário "${args.usuarioNome}" não encontrado.` };
      const m = calcularMetricasUsuario({ claims, overrides, historico, usuarioId: usuario.id, periodoInicioISO: inicioISO, periodoFimISO: fimISO, atendTemplateCfg });
      return {
        usuario: usuario.nome, metricas: m, metodologia,
        fontes: [{ tipo: "regra", id: "analise_desempenho:" + usuario.id, descricao: `Métricas de desempenho de ${usuario.nome}`, data_hora: new Date().toISOString(), url_interna: "#/desempenho" }],
      };
    }

    const todos = calcularMetricasTodosUsuarios({ users, claims, overrides, historico, periodoInicioISO: inicioISO, periodoFimISO: fimISO, atendTemplateCfg });
    return {
      usuarios: todos, metodologia,
      fontes: [{ tipo: "regra", id: "analise_desempenho:todos", descricao: "Métricas de desempenho de todos os usuários", data_hora: new Date().toISOString(), url_interna: "#/desempenho" }],
    };
  },
};

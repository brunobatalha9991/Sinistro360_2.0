// Tool de LEITURA: demandas recebidas de formulários externos (Nova
// Demanda) — a pedido do usuário, o Assistente não tinha nenhum acesso a
// esse módulo. Só resume os campos (nunca despeja o objeto inteiro) pra não
// estourar o payload quando o formulário tiver muitos campos.
export const listarDemandasTool = {
  name: "listar_demandas",
  description:
    "Lista demandas recebidas dos formulários externos (módulo 'Nova Demanda') — solicitações que ainda não viraram tarefa. Use para perguntas como 'quantas demandas não lidas', 'o que chegou pelo formulário X'.",
  parameters: {
    type: "OBJECT",
    properties: {
      apenasNaoLidas: { type: "BOOLEAN", description: "Opcional (padrão false): se true, só traz demandas ainda não marcadas como lidas." },
      origem: { type: "STRING", description: "Opcional: nome do formulário de origem (ex.: nome configurado em Configurações → Nova Demanda)." },
      limit: { type: "INTEGER", description: "Máximo de resultados (padrão 15, máximo 30)." },
    },
  },
  requiresConfirmation: false,
  run(args, ctx) {
    const { records } = ctx;
    const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 30);
    const origemFiltro = String(args.origem || "").trim().toLowerCase();

    let demandas = [...(records.corp_demandas || [])].sort((a, b) => String(b.recebidoEm).localeCompare(String(a.recebidoEm)));
    if (args.apenasNaoLidas) demandas = demandas.filter((d) => !d.lida);
    if (origemFiltro) demandas = demandas.filter((d) => String(d.formNome || "").toLowerCase().indexOf(origemFiltro) >= 0);

    const total = demandas.length;
    const naoLidas = demandas.filter((d) => !d.lida).length;
    const pagina = demandas.slice(0, limit);
    const resultados = pagina.map((d) => {
      const campos = d.campos || {};
      const resumo = Object.keys(campos).slice(0, 6).map((k) => `${k}: ${campos[k]}`).join(" | ");
      return { id: d.id, formulario: d.formNome || "—", lida: !!d.lida, recebidoEm: d.recebidoEm, resumo };
    });

    return {
      total, naoLidas, mostrando: resultados.length, resultados,
      metodologia: `Lista de corp_demandas${args.apenasNaoLidas ? ", só não lidas" : ""}${origemFiltro ? `, formulário "${args.origem}"` : ""} — resumo limitado aos 6 primeiros campos de cada demanda.`,
      fontes: pagina.map((d) => ({
        tipo: "demanda", id: d.id, descricao: `Demanda de ${d.formNome || "formulário"}${d.lida ? "" : " (não lida)"}`,
        data_hora: d.recebidoEm, url_interna: "#/demandas",
      })),
    };
  },
};

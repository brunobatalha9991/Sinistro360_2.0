import { visibleClaims, campoEfetivo, situacaoEfetiva, currentStage } from "../../logic/claims";
import { txt } from "../../logic/format";

// Tool de leitura: busca/filtra sinistros e devolve uma lista resumida —
// nunca despeja o array inteiro de corp_claims para o modelo.
export const searchClaimsTool = {
  name: "search_claims",
  description:
    "Busca sinistros/processos do sistema por texto (segurado, placa ou número do sinistro) e/ou situação/seguradora, devolvendo uma lista resumida (máx. 20 itens). Use antes de responder qualquer pergunta sobre um sinistro específico ou uma lista de sinistros.",
  parameters: {
    type: "OBJECT",
    properties: {
      query: { type: "STRING", description: "Texto livre: nome do segurado, placa ou número do sinistro." },
      situacao: { type: "STRING", description: "Filtra pela situação efetiva, ex.: 'Em andamento', 'Indenizado', 'Contatação', 'Pendente', 'Encerrado sem Indenização'." },
      cia: { type: "STRING", description: "Filtra pela seguradora (campo 'cia')." },
      limit: { type: "INTEGER", description: "Máximo de resultados (padrão 10, máximo 20)." },
    },
  },
  requiresConfirmation: false,
  run(args, ctx) {
    const { records, config, currentUser } = ctx;
    const overrides = records.corp_overrides || {};
    const templates = config.corp_journey_templates || {};
    const atendTemplate = config.corp_atendimento_template;

    const q = String(args.query || "").trim().toLowerCase();
    const situacaoFiltro = String(args.situacao || "").trim().toLowerCase();
    const ciaFiltro = String(args.cia || "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 20);

    let claims = visibleClaims(records.corp_claims, overrides, currentUser);
    if (q) {
      claims = claims.filter((c) => [c.segurado, c.placa, c.numsin].join(" ").toLowerCase().indexOf(q) >= 0);
    }
    if (ciaFiltro) {
      claims = claims.filter((c) => String(campoEfetivo(overrides, c, "cia") || "").toLowerCase().indexOf(ciaFiltro) >= 0);
    }
    if (situacaoFiltro) {
      claims = claims.filter((c) => situacaoEfetiva(overrides, c, atendTemplate, templates).label.toLowerCase().indexOf(situacaoFiltro) >= 0);
    }

    const total = claims.length;
    const pagina = claims.slice(0, limit);
    const resultados = pagina.map((c) => ({
      id: c.id,
      numsin: c.numsin || "#" + c.nosnum,
      segurado: txt(campoEfetivo(overrides, c, "segurado")),
      placa: txt(campoEfetivo(overrides, c, "placa")),
      cia: txt(campoEfetivo(overrides, c, "cia")),
      situacao: situacaoEfetiva(overrides, c, atendTemplate, templates).label,
      etapaAtual: currentStage(overrides, templates, atendTemplate, c) || "—",
    }));

    return {
      total, mostrando: resultados.length, resultados,
      metodologia: "Busca em corp_claims (visibleClaims), filtrando por texto/situação/seguradora efetivos; lista limitada a " + limit + " item(ns).",
      fontes: pagina.map((c) => ({
        tipo: "sinistro", id: c.id,
        descricao: (c.numsin || "#" + c.nosnum) + " — " + txt(campoEfetivo(overrides, c, "segurado")),
        data_hora: null, url_interna: "#/sinistro/" + c.id,
      })),
    };
  },
};

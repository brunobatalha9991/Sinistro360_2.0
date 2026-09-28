import { describe, it, expect } from "vitest";
import {
  usuarioTemVinculoRestrito, claimVisivelParaUsuario, visibleClaims,
  distinctAgentes, distinctProdutores, getAgentesEfetivo,
  grupoProdutor, distinctGruposProdutores, emailAlertaDispensado,
  gruposProdutoresDoClaim, agentesDoClaim, buildAggregation,
  getPesquisaSatisfacao, pesquisaSatisfacaoCompleta,
  situacaoEfetiva, isFinalizado, currentStage, isAtrasado,
  isSemAtualizacao, getHistoricoSnoozeAte,
} from "./claims";

const overrides = {
  c1: { agenteProdutor: { agentes: ["AGENTE A"], produtores: ["PRODUTOR X"] } },
  c2: { agenteProdutor: { agentes: ["AGENTE B"], produtores: ["PRODUTOR Y"] } },
  // c3 sem agenteProdutor (nunca buscado)
};
const claims = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];

describe("usuarioTemVinculoRestrito", () => {
  it("admin nunca é restrito", () => {
    expect(usuarioTemVinculoRestrito({ role: "admin", agentesVinculados: ["X"] })).toBe(false);
  });
  it("consulta sem vínculo não é restrito", () => {
    expect(usuarioTemVinculoRestrito({ role: "consulta" })).toBe(false);
    expect(usuarioTemVinculoRestrito({ role: "consulta", agentesVinculados: [], produtoresVinculados: [] })).toBe(false);
  });
  it("consulta com agente ou produtor vinculado é restrito", () => {
    expect(usuarioTemVinculoRestrito({ role: "consulta", agentesVinculados: ["AGENTE A"] })).toBe(true);
    expect(usuarioTemVinculoRestrito({ role: "consulta", produtoresVinculados: ["PRODUTOR X"] })).toBe(true);
  });
});

describe("claimVisivelParaUsuario", () => {
  it("sem restrição, tudo é visível", () => {
    expect(claimVisivelParaUsuario(overrides, { id: "c3" }, { role: "consulta" })).toBe(true);
    expect(claimVisivelParaUsuario(overrides, { id: "c1" }, { role: "admin" })).toBe(true);
  });
  it("consulta restrito só vê processo do agente vinculado", () => {
    const u = { role: "consulta", agentesVinculados: ["AGENTE A"] };
    expect(claimVisivelParaUsuario(overrides, { id: "c1" }, u)).toBe(true);
    expect(claimVisivelParaUsuario(overrides, { id: "c2" }, u)).toBe(false);
  });
  it("consulta restrito só vê processo do produtor vinculado", () => {
    const u = { role: "consulta", produtoresVinculados: ["PRODUTOR Y"] };
    expect(claimVisivelParaUsuario(overrides, { id: "c2" }, u)).toBe(true);
    expect(claimVisivelParaUsuario(overrides, { id: "c1" }, u)).toBe(false);
  });
  it("consulta restrito não vê processo sem agenteProdutor buscado ainda", () => {
    const u = { role: "consulta", agentesVinculados: ["AGENTE A"] };
    expect(claimVisivelParaUsuario(overrides, { id: "c3" }, u)).toBe(false);
  });
  it("consulta restrito só vê processo do grupo de produtores vinculado", () => {
    const ovr = { c5: { agenteProdutor: { agentes: ["AGENTE C"], produtores: ["LORENA / DANIELA DE SÁ - GRAND ROSA"] } } };
    const u = { role: "consulta", gruposProdutoresVinculados: ["LORENA / DANIELA DE SÁ"] };
    expect(claimVisivelParaUsuario(ovr, { id: "c5" }, u)).toBe(true);
    expect(claimVisivelParaUsuario(overrides, { id: "c1" }, u)).toBe(false);
  });
  // Bug relatado 2026-08-26: c1 e c2 são do mesmo agente ("AGENTE A"), mas
  // com produtores diferentes ("PRODUTOR X" e "PRODUTOR Z"). Um usuário com
  // Agente E Produtor marcados ao mesmo tempo só pode ver o processo do
  // produtor específico — o Agente marcado junto não pode "vazar" acesso
  // aos demais produtores do mesmo agente.
  it("agente E produtor marcados juntos: produtor restringe, agente não amplia", () => {
    const ovr = {
      c1: { agenteProdutor: { agentes: ["AGENTE A"], produtores: ["PRODUTOR X"] } },
      c2: { agenteProdutor: { agentes: ["AGENTE A"], produtores: ["PRODUTOR Z"] } },
    };
    const u = { role: "consulta", agentesVinculados: ["AGENTE A"], produtoresVinculados: ["PRODUTOR X"] };
    expect(claimVisivelParaUsuario(ovr, { id: "c1" }, u)).toBe(true);
    expect(claimVisivelParaUsuario(ovr, { id: "c2" }, u)).toBe(false);
  });
  it("agente E grupo marcados juntos: grupo restringe, agente não amplia", () => {
    const ovr = {
      c1: { agenteProdutor: { agentes: ["AGENTE C"], produtores: ["LORENA / DANIELA DE SÁ - GRAND ROSA"] } },
      c2: { agenteProdutor: { agentes: ["AGENTE C"], produtores: ["OUTRO PRODUTOR - BATALHA"] } },
    };
    const u = { role: "consulta", agentesVinculados: ["AGENTE C"], gruposProdutoresVinculados: ["LORENA / DANIELA DE SÁ"] };
    expect(claimVisivelParaUsuario(ovr, { id: "c1" }, u)).toBe(true);
    expect(claimVisivelParaUsuario(ovr, { id: "c2" }, u)).toBe(false);
  });
});

describe("visibleClaims", () => {
  it("sem currentUser, retrocompatível (não filtra por vínculo)", () => {
    expect(visibleClaims(claims).map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });
  it("com consulta restrito, filtra pelos processos vinculados", () => {
    const u = { role: "consulta", agentesVinculados: ["AGENTE B"] };
    expect(visibleClaims(claims, overrides, u).map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("distinctAgentes / distinctProdutores", () => {
  it("lista agentes/produtores distintos vistos nos processos", () => {
    expect(distinctAgentes(overrides, claims)).toEqual(["AGENTE A", "AGENTE B"]);
    expect(distinctProdutores(overrides, claims)).toEqual(["PRODUTOR X", "PRODUTOR Y"]);
  });
});

describe("getAgentesEfetivo", () => {
  it("une catálogo manual com agentes descobertos, sem duplicar", () => {
    const config = { corp_agentes_catalogo: ["AGENTE A", "AGENTE MANUAL"] };
    expect(getAgentesEfetivo(config, overrides, claims)).toEqual(["AGENTE A", "AGENTE B", "AGENTE MANUAL"]);
  });
});

describe("grupoProdutor", () => {
  it("remove o sufixo de unidade (tudo depois do último ' - ')", () => {
    expect(grupoProdutor("LORENA / DANIELA DE SÁ - BATALHA")).toBe("LORENA / DANIELA DE SÁ");
    expect(grupoProdutor("LORENA / DANIELA DE SÁ - GRAND ROSA")).toBe("LORENA / DANIELA DE SÁ");
  });
  it("mantém o nome intacto quando ele mesmo contém a palavra da unidade", () => {
    expect(grupoProdutor("LORENA BATALHA - BATALHA")).toBe("LORENA BATALHA");
    expect(grupoProdutor("LORENA BATALHA - GRAND ROSA")).toBe("LORENA BATALHA");
  });
  it("sem separador, o grupo é o próprio nome", () => {
    expect(grupoProdutor("JESSICA SILVA DOS SANTOS")).toBe("JESSICA SILVA DOS SANTOS");
    expect(grupoProdutor("MAGNO SUED")).toBe("MAGNO SUED");
  });
  it("nome vazio/indefinido não quebra", () => {
    expect(grupoProdutor("")).toBe("");
    expect(grupoProdutor(null)).toBe("");
    expect(grupoProdutor(undefined)).toBe("");
  });
});

describe("distinctGruposProdutores", () => {
  it("agrupa produtores com o mesmo nome base, sem duplicar", () => {
    const ovr = {
      c1: { agenteProdutor: { produtores: ["LORENA / DANIELA DE SÁ - BATALHA"] } },
      c2: { agenteProdutor: { produtores: ["LORENA / DANIELA DE SÁ - GRAND ROSA"] } },
      c3: { agenteProdutor: { produtores: ["MAGNO SUED"] } },
    };
    const cl = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
    expect(distinctGruposProdutores(ovr, cl)).toEqual(["LORENA / DANIELA DE SÁ", "MAGNO SUED"]);
  });
});

// Bug relatado 2026-08-31: um caminho (Perda Parcial/Integral) cuja etapa
// final foi renomeada/reordenada em Configurações → Jornadas (ex.:
// "Encerramento" em vez de "Conclusão", com id próprio em vez de
// "conclusao") nunca era detectado como Indenizado/Sem Indenização — a
// checagem antiga só olhava o step de id fixo "conclusao". Agora usa
// sempre a ÚLTIMA etapa de fato do caminho escolhido.
describe("situacaoEfetiva / isFinalizado — etapa final com id/nome customizado", () => {
  const templates = {
    Auto: {
      parcial: [
        { id: "rep", title: "Reparo", statusOptions: ["Aguardando", "Concluído"] },
        {
          id: "encerramento", title: "Encerramento",
          statusOptions: ["Aguard. pesquisa", "Indenizado", "Sem Indenização"],
          doneStatuses: ["Indenizado"], negativoStatuses: ["Sem Indenização"],
        },
      ],
    },
  };

  it("última etapa marcada verde (Indenizado) vira 'Indenizado', mesmo com id/nome customizado", () => {
    const c = { id: "c1", ramo: "Auto" };
    const overrides = { c1: { journeyUser: { caminho: "parcial", steps: { encerramento: { status: "Indenizado" } } } } };
    expect(situacaoEfetiva(overrides, c, null, templates)).toEqual({ label: "Indenizado", cls: "green" });
    expect(isFinalizado(overrides, c, null, templates)).toBe(true);
  });

  it("última etapa marcada vermelha (Sem Indenização) vira 'Encerrado sem Indenização'", () => {
    const c = { id: "c1", ramo: "Auto" };
    const overrides = { c1: { journeyUser: { caminho: "parcial", steps: { encerramento: { status: "Sem Indenização" } } } } };
    expect(situacaoEfetiva(overrides, c, null, templates)).toEqual({ label: "Encerrado sem Indenização", cls: "gray" });
    expect(isFinalizado(overrides, c, null, templates)).toBe(true);
  });

  it("última etapa ainda sem desfecho fica 'Em andamento'", () => {
    const c = { id: "c1", ramo: "Auto" };
    const overrides = { c1: { journeyUser: { caminho: "parcial", steps: { encerramento: { status: "Aguard. pesquisa" } } } } };
    expect(situacaoEfetiva(overrides, c, null, templates).label).toBe("Em andamento");
    expect(isFinalizado(overrides, c, null, templates)).toBe(false);
  });

  it("sem caminho escolhido ainda, fica 'Pendente'", () => {
    const c = { id: "c1", ramo: "Auto" };
    const overrides = { c1: { journeyUser: { caminho: "", steps: { encerramento: { status: "Indenizado" } } } } };
    expect(situacaoEfetiva(overrides, c, null, templates).label).toBe("Pendente");
  });

  it("template padrão (sem admin configurar nada) também reconhece Indenizado/Sem Indenização pelo texto", () => {
    const c = { id: "c1", ramo: "SemTemplateConfigurado" };
    const ovrInd = { c1: { journeyUser: { caminho: "parcial", steps: { conclusao: { status: "Indenizado" } } } } };
    const ovrSemInd = { c1: { journeyUser: { caminho: "parcial", steps: { conclusao: { status: "Sem Indenização" } } } } };
    expect(situacaoEfetiva(ovrInd, c, null, {}).label).toBe("Indenizado");
    expect(situacaoEfetiva(ovrSemInd, c, null, {}).label).toBe("Encerrado sem Indenização");
  });
});

// "Constatação" (a pedido do usuário, 2026-08-31): 3º desfecho de Perda
// Parcial/Integral, ao lado de Indenizado/Sem Indenização — atendimento
// aberto só pra cobertura ao terceiro, sem indenização ao segurado. Não é
// negativo: isFinalizado/currentStage tratam como um desfecho já concluído,
// e entra como "positivo" nas métricas de Dashboard/Desempenho.
describe("situacaoEfetiva / isFinalizado — Constatação", () => {
  const templatesConfigurados = {
    Auto: {
      parcial: [
        {
          id: "encerramento", title: "Encerramento",
          statusOptions: ["Aguard. pesquisa", "Indenizado", "Constatação", "Sem Indenização"],
          doneStatuses: ["Indenizado"], negativoStatuses: ["Sem Indenização"], constatacaoStatuses: ["Constatação"],
        },
      ],
    },
  };

  it("última etapa marcada azul (Constatação) vira 'Constatação', badge azul, e conta como finalizado", () => {
    const c = { id: "c1", ramo: "Auto" };
    const overrides = { c1: { journeyUser: { caminho: "parcial", steps: { encerramento: { status: "Constatação" } } } } };
    expect(situacaoEfetiva(overrides, c, null, templatesConfigurados)).toEqual({ label: "Constatação", cls: "blue" });
    expect(isFinalizado(overrides, c, null, templatesConfigurados)).toBe(true);
  });

  it("template padrão (sem admin configurar nada) também reconhece Constatação pelo texto", () => {
    const c = { id: "c1", ramo: "SemTemplateConfigurado" };
    const overrides = { c1: { journeyUser: { caminho: "parcial", steps: { conclusao: { status: "Constatação" } } } } };
    expect(situacaoEfetiva(overrides, c, null, {}).label).toBe("Constatação");
    expect(isFinalizado(overrides, c, null, {})).toBe(true);
  });

  it("currentStage some (\"\") quando o processo chegou em Constatação, igual Indenizado/Sem Indenização", () => {
    const c = { id: "c1", ramo: "Auto" };
    const overrides = { c1: { journeyUser: { caminho: "parcial", steps: { encerramento: { status: "Constatação" } } } } };
    expect(currentStage(overrides, templatesConfigurados, null, c)).toBe("");
  });

  // Bug relatado 2026-08-31: caminho "Outros" com etapa de Encerramento
  // customizada marcada como Constatação continuava contando como atrasado
  // e o assistente pedia "próxima ação" mesmo com o processo já fechado —
  // isAtrasado nunca olhava pra isFinalizado.
  it("vale pra QUALQUER ramo/caminho (inclusive Outros) e some do isAtrasado", () => {
    const templatesOutros = {
      Auto: {
        outros: [
          { id: "doc", title: "Documentação Inicial", statusOptions: ["Aguardando", "Concluído"] },
          {
            id: "encerramento", title: "Encerramento",
            statusOptions: ["Aguard. pesquisa", "Constatação"],
            constatacaoStatuses: ["Constatação"],
          },
        ],
      },
    };
    const c = { id: "c1", ramo: "Auto" };
    const overrides = {
      c1: {
        journeyUser: { caminho: "outros", steps: { encerramento: { status: "Constatação" } } },
        nextAction: { date: "2020-01-01" }, // bem no passado — venceria se o processo não estivesse encerrado
      },
    };
    expect(situacaoEfetiva(overrides, c, null, templatesOutros)).toEqual({ label: "Constatação", cls: "blue" });
    expect(isFinalizado(overrides, c, null, templatesOutros)).toBe(true);
    expect(isAtrasado(overrides, c, null, templatesOutros)).toBe(false);
  });

  it("isAtrasado continua true pra processo em aberto com próxima ação vencida", () => {
    const c = { id: "c1", ramo: "Auto" };
    const overrides = { c1: { nextAction: { date: "2020-01-01" } } };
    expect(isAtrasado(overrides, c, null, {})).toBe(true);
  });
});

describe("isSemAtualizacao / getHistoricoSnoozeAte (botão \"Dentro do prazo\")", () => {
  const c = { id: "c1", ramo: "Auto" };
  const passado = { date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10) };
  const recente = { date: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10) };

  it("sem histórico algum, conta como sem atualização", () => {
    expect(isSemAtualizacao({ c1: {} }, c, null, {})).toBe(true);
  });
  it("histórico recente (< 3 dias), não conta como sem atualização", () => {
    expect(isSemAtualizacao({ c1: { comms: [recente] } }, c, null, {})).toBe(false);
  });
  it("histórico antigo (> 3 dias) sem snooze, conta como sem atualização", () => {
    expect(isSemAtualizacao({ c1: { comms: [passado] } }, c, null, {})).toBe(true);
  });
  it("histórico antigo com snooze futuro (\"Dentro do prazo\" recém-clicado), não conta como sem atualização", () => {
    const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const overrides = { c1: { comms: [passado], historicoSnoozeAte: amanha } };
    expect(getHistoricoSnoozeAte(overrides, "c1")).toBe(amanha);
    expect(isSemAtualizacao(overrides, c, null, {})).toBe(false);
  });
  it("snooze já vencido volta a contar como sem atualização", () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const overrides = { c1: { comms: [passado], historicoSnoozeAte: ontem } };
    expect(isSemAtualizacao(overrides, c, null, {})).toBe(true);
  });
  it("processo finalizado nunca conta como sem atualização, mesmo sem snooze", () => {
    const templatesOutros = {
      Auto: {
        outros: [{
          id: "encerramento", title: "Encerramento",
          statusOptions: ["Aguard. pesquisa", "Constatação"],
          constatacaoStatuses: ["Constatação"],
        }],
      },
    };
    const overrides = {
      c1: { comms: [passado], journeyUser: { caminho: "outros", steps: { encerramento: { status: "Constatação" } } } },
    };
    expect(isFinalizado(overrides, c, null, templatesOutros)).toBe(true);
    expect(isSemAtualizacao(overrides, c, null, templatesOutros)).toBe(false);
  });
});

describe("emailAlertaDispensado", () => {
  it("falso quando não há nenhum alerta pra esse e-mail", () => {
    expect(emailAlertaDispensado({}, "c1", "gmail:1")).toBe(false);
  });
  it("falso quando o alerta existe mas não foi dispensado", () => {
    const ovr = { c1: { emailAlertas: [{ emailId: "gmail:1", dismissed: false }] } };
    expect(emailAlertaDispensado(ovr, "c1", "gmail:1")).toBe(false);
  });
  it("verdadeiro quando o vínculo foi removido manualmente", () => {
    const ovr = { c1: { emailAlertas: [{ emailId: "gmail:1", dismissed: true }] } };
    expect(emailAlertaDispensado(ovr, "c1", "gmail:1")).toBe(true);
  });
});

describe("getPesquisaSatisfacao + pesquisaSatisfacaoCompleta", () => {
  it("sem pesquisa registrada, retorna null e incompleta", () => {
    expect(getPesquisaSatisfacao({}, "c1")).toBeNull();
    expect(pesquisaSatisfacaoCompleta({}, "c1")).toBe(false);
  });
  it("incompleta enquanto faltar decisão (nota ou não se aplica) em algum dos 3 alvos", () => {
    const ovr = { c1: { pesquisaSatisfacao: { corretora: { nota: 5 }, seguradora: { naoAplica: true } } } };
    expect(pesquisaSatisfacaoCompleta(ovr, "c1")).toBe(false);
  });
  it("completa quando os 3 alvos têm nota > 0 ou não se aplica", () => {
    const ovr = {
      c1: {
        pesquisaSatisfacao: {
          corretora: { nota: 5 }, seguradora: { naoAplica: true }, oficina: { nota: 3 },
        },
      },
    };
    expect(pesquisaSatisfacaoCompleta(ovr, "c1")).toBe(true);
  });
  it("nota zero sem naoAplica não conta como decisão", () => {
    const ovr = { c1: { pesquisaSatisfacao: { corretora: { nota: 0 }, seguradora: { naoAplica: true }, oficina: { nota: 3 } } } };
    expect(pesquisaSatisfacaoCompleta(ovr, "c1")).toBe(false);
  });
});

// Métrica de quantidade por Grupo de Produtores / Agente no Dashboard (a
// pedido do usuário). O ponto delicado: um processo normalmente tem VÁRIOS
// pares de agente/produtor, então ele conta em cada grupo/agente — mas não
// pode contar duas vezes no MESMO grupo quando duas unidades do mesmo
// produtor estão vinculadas.
describe("gruposProdutoresDoClaim / agentesDoClaim", () => {
  const ovr = {
    c1: {
      agenteProdutor: {
        agentes: ["AGENTE A", "AGENTE B", "AGENTE A"],
        produtores: ["LORENA / DANIELA DE SÁ - BATALHA", "LORENA / DANIELA DE SÁ - GRAND ROSA", "MAGNO SUED"],
      },
    },
    c2: { agenteProdutor: { agentes: [], produtores: [] } },
  };

  it("colapsa as unidades do mesmo produtor num grupo só", () => {
    expect(gruposProdutoresDoClaim(ovr, "c1")).toEqual(["LORENA / DANIELA DE SÁ", "MAGNO SUED"]);
  });
  it("não repete agente vinculado duas vezes no mesmo processo", () => {
    expect(agentesDoClaim(ovr, "c1")).toEqual(["AGENTE A", "AGENTE B"]);
  });
  it("devolve lista vazia quando o processo não tem vínculo buscado", () => {
    expect(gruposProdutoresDoClaim(ovr, "c2")).toEqual([]);
    expect(agentesDoClaim(ovr, "c2")).toEqual([]);
    expect(gruposProdutoresDoClaim(ovr, "c9")).toEqual([]);
    expect(agentesDoClaim(ovr, "c9")).toEqual([]);
  });
});

describe("buildAggregation — chave única e chave múltipla", () => {
  const rows = [
    { id: "c1", cia: "PORT" },
    { id: "c2", cia: "PORT" },
    { id: "c3", cia: "TOKIO" },
  ];

  it("continua agrupando por uma chave só (oficina/seguradora/ramo)", () => {
    const agg = buildAggregation({}, rows, (c) => c.cia, undefined, {});
    expect(agg.map((a) => [a.key, a.count])).toEqual([["PORT", 2], ["TOKIO", 1]]);
  });

  it("conta o processo em cada chave quando keyFn devolve lista", () => {
    const keys = { c1: ["G1", "G2"], c2: ["G2"], c3: [] };
    const agg = buildAggregation({}, rows, (c) => keys[c.id], undefined, {});
    expect(agg.map((a) => [a.key, a.count])).toEqual([["G2", 2], ["G1", 1]]);
  });

  it("ignora chave repetida dentro do mesmo processo", () => {
    const agg = buildAggregation({}, rows, () => ["G1", "G1"], undefined, {});
    expect(agg).toHaveLength(1);
    expect(agg[0].count).toBe(3);
  });

  it("ignora chave vazia", () => {
    const agg = buildAggregation({}, rows, (c) => (c.id === "c3" ? ["", null] : ["G1"]), undefined, {});
    expect(agg.map((a) => [a.key, a.count])).toEqual([["G1", 2]]);
  });
});

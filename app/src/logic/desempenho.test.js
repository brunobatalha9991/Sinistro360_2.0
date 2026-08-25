import { describe, it, expect } from "vitest";
import { calcularMetricasUsuario, estoqueAtualDoUsuario, intervalosDoUsuarioNoPeriodo, gerarFeedbackEPlanoDeAcao } from "./desempenho";

function metricaBase(overrides) {
  return {
    usuarioId: "usr_x", estoqueAtual: 10, atrasadosAtual: 0, semAtualizacaoAtual: 0,
    tempoMedioAndamentoDias: null, tempoMedioPendenteDias: null, avaliacaoMediaHistorico: null,
    finalizadosNoPeriodo: 0, pendentesAtual: 0,
    ...overrides,
  };
}

const CLAIM_A = { id: "clm_a", situacao: "Em andamento" };
const CLAIM_B = { id: "clm_b", situacao: "Em andamento" };

describe("intervalosDoUsuarioNoPeriodo", () => {
  it("inclui intervalo que começou antes do período mas ainda estava vigente no início dele", () => {
    const historico = [
      { claimId: "clm_a", usuarioResponsavelId: "usr_a", inicioResponsabilidadeEm: "2026-07-01T00:00:00.000Z", fimResponsabilidadeEm: "2026-08-15T00:00:00.000Z" },
    ];
    const r = intervalosDoUsuarioNoPeriodo(historico, "usr_a", "2026-08-01T00:00:00.000Z", "2026-08-31T00:00:00.000Z");
    expect(r).toHaveLength(1);
  });

  it("não inclui intervalo que terminou antes do período começar", () => {
    const historico = [
      { claimId: "clm_a", usuarioResponsavelId: "usr_a", inicioResponsabilidadeEm: "2026-06-01T00:00:00.000Z", fimResponsabilidadeEm: "2026-06-15T00:00:00.000Z" },
    ];
    const r = intervalosDoUsuarioNoPeriodo(historico, "usr_a", "2026-08-01T00:00:00.000Z", "2026-08-31T00:00:00.000Z");
    expect(r).toHaveLength(0);
  });
});

describe("calcularMetricasUsuario — regra de justiça", () => {
  it("processo recebido antes da responsabilidade do usuário não conta tempo anterior a ele", () => {
    // usr_a foi responsável de clm_a só de 10/08 a 20/08 — o processo existia
    // desde antes (outro responsável), mas isso não deve aparecer nas
    // métricas de usr_a.
    const historico = [
      { claimId: "clm_a", usuarioResponsavelId: "usr_x", inicioResponsabilidadeEm: "2026-08-01T00:00:00.000Z", fimResponsabilidadeEm: "2026-08-10T00:00:00.000Z" },
      { claimId: "clm_a", usuarioResponsavelId: "usr_a", inicioResponsabilidadeEm: "2026-08-10T00:00:00.000Z", fimResponsabilidadeEm: "2026-08-20T00:00:00.000Z" },
    ];
    const m = calcularMetricasUsuario({
      claims: [CLAIM_A], overrides: {}, historico, usuarioId: "usr_a",
      periodoInicioISO: "2026-08-01T00:00:00.000Z", periodoFimISO: "2026-08-31T00:00:00.000Z",
    });
    expect(m.tempoMedioResponsabilidadeDias).toBe(10); // só os 10 dias dele, não os 9 do usr_x antes
    expect(m.processosSobResponsabilidadeNoPeriodo).toBe(1);
  });

  it("estoque atual só conta processos com responsável VIGENTE = usuário e não finalizados", () => {
    const overrides = {
      clm_a: { responsavelUser: { id: "usr_a", nome: "A" } },
      clm_b: { responsavelUser: { id: "usr_a", nome: "A" }, journeyUser: { caminho: "parcial", steps: { conclusao: { status: "Indenizado" } } } },
    };
    const estoque = estoqueAtualDoUsuario([CLAIM_A, CLAIM_B], overrides, "usr_a");
    expect(estoque.map((c) => c.id)).toEqual(["clm_a"]); // clm_b está finalizado, não conta
  });

  it("sem nenhum histórico, todas as métricas de período ficam zeradas (não inventa dado)", () => {
    const m = calcularMetricasUsuario({
      claims: [], overrides: {}, historico: [], usuarioId: "usr_a",
      periodoInicioISO: "2026-08-01T00:00:00.000Z", periodoFimISO: "2026-08-31T00:00:00.000Z",
    });
    expect(m.processosAssumidosNoPeriodo).toBe(0);
    expect(m.tempoMedioResponsabilidadeDias).toBeNull();
  });
});

describe("calcularMetricasUsuario — tempo médio Pendente / Em andamento", () => {
  const historicoFechado = (usuarioId, claimId) => [
    { claimId, usuarioResponsavelId: usuarioId, inicioResponsabilidadeEm: "2026-08-01T00:00:00.000Z", fimResponsabilidadeEm: "2026-08-20T00:00:00.000Z" },
  ];

  it("Atendimento: divide o intervalo pela conclusão da 1ª e da última etapa efetiva", () => {
    const claim = {
      id: "clm_at", partyType: "Aviso", situacao: "Em andamento",
    };
    const overrides = {
      clm_at: { journeyUser: { caminho: "", steps: {
        at_inicial: { status: "Concluído", concludedAt: "2026-08-05T00:00:00.000Z" },
        at_conclusao: { status: "Concluído", concludedAt: "2026-08-15T00:00:00.000Z" },
      } } },
    };
    const m = calcularMetricasUsuario({
      claims: [claim], overrides, historico: historicoFechado("usr_a", "clm_at"), usuarioId: "usr_a",
      periodoInicioISO: "2026-08-01T00:00:00.000Z", periodoFimISO: "2026-08-31T00:00:00.000Z",
    });
    expect(m.tempoMedioPendenteDias).toBe(4); // 01/08 -> 05/08
    expect(m.tempoMedioAndamentoDias).toBe(10); // 05/08 -> 15/08
    expect(m.processosTransicaoAproximada).toBe(0);
    expect(m.processosTransicaoIndisponivel).toBe(0);
  });

  it("Por ramo, com caminhoDefinidoEm gravado: usa a data exata, sem aproximação", () => {
    const claim = { id: "clm_rm", situacao: "Em andamento", ramo: "auto" };
    const overrides = {
      clm_rm: { journeyUser: { caminho: "parcial", caminhoDefinidoEm: "2026-08-03T00:00:00.000Z", steps: {
        conclusao: { status: "Indenizado", concludedAt: "2026-08-18T00:00:00.000Z" },
      } } },
    };
    const m = calcularMetricasUsuario({
      claims: [claim], overrides, historico: historicoFechado("usr_b", "clm_rm"), usuarioId: "usr_b",
      periodoInicioISO: "2026-08-01T00:00:00.000Z", periodoFimISO: "2026-08-31T00:00:00.000Z",
    });
    expect(m.tempoMedioPendenteDias).toBe(2); // 01/08 -> 03/08
    expect(m.tempoMedioAndamentoDias).toBe(15); // 03/08 -> 18/08
    expect(m.processosTransicaoAproximada).toBe(0);
  });

  it("Por ramo, sem caminhoDefinidoEm (legado): aproxima pela 1ª data encontrada nas etapas do caminho", () => {
    const claim = { id: "clm_rm2", situacao: "Em andamento", ramo: "auto" };
    const overrides = {
      clm_rm2: { journeyUser: { caminho: "parcial", steps: {
        rep_autorizados: { status: "Em andamento", firstSetAt: "2026-08-04T00:00:00.000Z" },
        conclusao: { status: "Indenizado", concludedAt: "2026-08-16T00:00:00.000Z" },
      } } },
    };
    const m = calcularMetricasUsuario({
      claims: [claim], overrides, historico: historicoFechado("usr_c", "clm_rm2"), usuarioId: "usr_c",
      periodoInicioISO: "2026-08-01T00:00:00.000Z", periodoFimISO: "2026-08-31T00:00:00.000Z",
    });
    expect(m.tempoMedioPendenteDias).toBe(3); // 01/08 -> 04/08 (aproximado)
    expect(m.tempoMedioAndamentoDias).toBe(12); // 04/08 -> 16/08
    expect(m.processosTransicaoAproximada).toBe(1);
  });

  it("Por ramo, caminho escolhido sem nenhuma evidência de data: fica de fora da média (não inventa 'ainda pendente')", () => {
    const claim = { id: "clm_rm3", situacao: "Em andamento", ramo: "auto" };
    const overrides = { clm_rm3: { journeyUser: { caminho: "integral", steps: {} } } };
    const m = calcularMetricasUsuario({
      claims: [claim], overrides, historico: historicoFechado("usr_d", "clm_rm3"), usuarioId: "usr_d",
      periodoInicioISO: "2026-08-01T00:00:00.000Z", periodoFimISO: "2026-08-31T00:00:00.000Z",
    });
    expect(m.tempoMedioPendenteDias).toBeNull();
    expect(m.tempoMedioAndamentoDias).toBeNull();
    expect(m.processosTransicaoIndisponivel).toBe(1);
  });
});

describe("gerarFeedbackEPlanoDeAcao", () => {
  it("com time comparável, sinaliza quem está pior/melhor que a média (não limiar fixo)", () => {
    const pior = metricaBase({ usuarioId: "usr_pior", estoqueAtual: 10, atrasadosAtual: 5 }); // 50%
    const melhor = metricaBase({ usuarioId: "usr_melhor", estoqueAtual: 10, atrasadosAtual: 0 }); // 0%
    const todos = [pior, melhor];

    const fbPior = gerarFeedbackEPlanoDeAcao(pior, todos);
    expect(fbPior.comparavel).toBe(true);
    expect(fbPior.pontosAtencao.some((t) => t.includes("atrasados"))).toBe(true);

    const fbMelhor = gerarFeedbackEPlanoDeAcao(melhor, todos);
    expect(fbMelhor.pontosFortes.some((t) => t.includes("atrasados"))).toBe(true);
  });

  it("dentro da margem de tolerância (diferença pequena), não sinaliza nada", () => {
    const a = metricaBase({ usuarioId: "usr_a", estoqueAtual: 10, atrasadosAtual: 1 }); // 10%
    const b = metricaBase({ usuarioId: "usr_b", estoqueAtual: 10, atrasadosAtual: 1 }); // 10%
    const fb = gerarFeedbackEPlanoDeAcao(a, [a, b]);
    expect(fb.pontosAtencao).toHaveLength(0);
    expect(fb.pontosFortes).toHaveLength(0);
  });

  it("time de 1 pessoa só: cai em regras absolutas, não em comparação", () => {
    const solo = metricaBase({ usuarioId: "usr_solo", estoqueAtual: 5, atrasadosAtual: 2 });
    const fb = gerarFeedbackEPlanoDeAcao(solo, [solo]);
    expect(fb.comparavel).toBe(false);
    expect(fb.pontosAtencao.some((t) => t.includes("atrasado"))).toBe(true);
  });

  it("plano de ação: sem nenhuma pendência, devolve mensagem positiva única", () => {
    const ok = metricaBase({ usuarioId: "usr_ok" });
    const fb = gerarFeedbackEPlanoDeAcao(ok, [ok]);
    expect(fb.planoDeAcao).toHaveLength(1);
    expect(fb.planoDeAcao[0].texto).toMatch(/nenhuma pendência crítica/i);
  });

  it("plano de ação: atrasados geram item acionável com filtro pra drill-down", () => {
    const m = metricaBase({ usuarioId: "usr_m", atrasadosAtual: 3 });
    const fb = gerarFeedbackEPlanoDeAcao(m, [m]);
    const item = fb.planoDeAcao.find((i) => i.texto.indexOf("atrasado") >= 0);
    expect(item).toBeTruthy();
    expect(item.filtro).toEqual({ atrasado: true });
  });
});

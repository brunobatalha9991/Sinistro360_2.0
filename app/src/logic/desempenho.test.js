import { describe, it, expect } from "vitest";
import { calcularMetricasUsuario, estoqueAtualDoUsuario, intervalosDoUsuarioNoPeriodo } from "./desempenho";

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

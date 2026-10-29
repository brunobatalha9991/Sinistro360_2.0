import { describe, it, expect } from "vitest";
import { calcularMetricasUsuario, atuouNoProcesso } from "./desempenho";
import { metricasExtras } from "./desempenhoPainel";
import { feitoPor } from "./autoria";

// Produção conta pra QUEM FEZ (a pedido do usuário, 2026-10-29) — mesmo
// sem ser o responsável pelo processo, e mesmo em registro antigo que só
// tem o nome do autor.
const CLAIM = { id: "clm_a", situacao: "Em andamento" };
const DE = "2026-10-29T00:00:00.000Z";
const ATE = "2026-10-29T23:59:59.999Z";
const AT = "2026-10-29T13:00:00.000Z";
const historico = [
  { claimId: "clm_a", usuarioResponsavelId: "usr_dono", inicioResponsabilidadeEm: "2026-10-01T00:00:00.000Z", fimResponsabilidadeEm: null },
];

function metricas(overrides, usuarioId = "usr_novo", usuarioNome = "Usuário Novo") {
  return calcularMetricasUsuario({ claims: [CLAIM], overrides, historico, usuarioId, usuarioNome, periodoInicioISO: DE, periodoFimISO: ATE });
}

describe("feitoPor", () => {
  it("usa o id quando o registro tem, e o nome (sem acento/caixa) quando não tem", () => {
    const u = { id: "usr_1", nome: "José Silva" };
    expect(feitoPor("usr_1", "Outro nome", u)).toBe(true);
    expect(feitoPor("usr_2", "José Silva", u)).toBe(false);
    expect(feitoPor(null, " jose silva ", u)).toBe(true);
    expect(feitoPor(null, "—", { id: "x", nome: "—" })).toBe(false);
  });
});

describe("Desempenho — produção de quem fez", () => {
  const overrides = {
    clm_a: {
      responsavelUser: { id: "usr_dono", nome: "Dono" },
      comms: [
        { id: "cm1", canal: "Cliente", who: "Usuário Novo", at: AT },
        { id: "cm2", canal: "Cliente", who: "Usuário Novo", whoId: "usr_novo", at: AT },
        { id: "cm3", canal: "Dados importado", who: "Usuário Novo", at: AT },
      ],
      audit: [
        { at: AT, who: "Usuário Novo", whoId: "usr_novo", acao: "Próxima ação definida" },
        { at: AT, who: "Usuário Novo", whoId: "usr_novo", acao: "Comunicação registrada" },
        { at: AT, who: "Usuário Novo", whoId: "usr_novo", acao: "Temperatura alterada" },
        { at: AT, who: "Usuário Novo", whoId: "usr_novo", acao: "Jornada: status alterado" },
      ],
    },
  };

  it("conta histórico, próxima ação, jornada e outras atualizações pra quem não é o responsável", () => {
    const m = metricas(overrides);
    expect(m.historicosRegistrados).toBe(2); // importado em lote não conta
    expect(m.proximasAcoesRegistradas).toBe(1);
    expect(m.interacoesJornada).toBe(1);
    expect(m.outrasAtualizacoes).toBe(1); // só a temperatura — o resto já tem contagem própria
    expect(m.processosAtualizados).toBe(1);
    expect(m.estoqueAtual).toBe(0); // carteira continua sendo do responsável
  });

  it("o responsável não ganha pelo que outro fez", () => {
    const m = metricas(overrides, "usr_dono", "Dono");
    expect(m.historicosRegistrados).toBe(0);
    expect(m.proximasAcoesRegistradas).toBe(0);
    expect(m.estoqueAtual).toBe(1);
  });

  it("jornada antiga sem auditoria cai na última interação de cada etapa", () => {
    const ov = { clm_a: { journeyUser: { steps: { s1: { status: "Ok", lastInteractionAt: AT, lastInteractionBy: "Usuário Novo" }, s2: { status: "Ok", lastInteractionAt: AT, lastInteractionBy: "Outro" } } } } };
    expect(metricas(ov).interacoesJornada).toBe(1);
  });

  it("metricasExtras atribui histórico e etapa concluída pelo autor", () => {
    const ov = { clm_a: { ...overrides.clm_a, journeyUser: { steps: { s1: { concludedAt: AT, concludedBy: "Usuário Novo" } } } } };
    const ex = metricasExtras({ claims: [CLAIM], overrides: ov, historico, userId: "usr_novo", userNome: "Usuário Novo", deISO: "2026-10-29", ateISO: "2026-10-29" });
    expect(ex.historicos).toBe(2);
    expect(ex.historicosCliente).toBe(2);
    expect(ex.etapasConcluidas).toBe(1);
  });
});

describe("atuouNoProcesso", () => {
  it("reconhece quem já registrou algo no processo em qualquer data", () => {
    const ov = { clm_a: { comms: [{ who: "Ana", at: "2026-01-01T10:00:00.000Z" }], audit: [{ who: "Bia", whoId: "usr_bia", acao: "Anexo adicionado", at: "2026-02-01T10:00:00.000Z" }] } };
    expect(atuouNoProcesso(ov, "clm_a", { id: "usr_ana", nome: "Ana" })).toBe(true);
    expect(atuouNoProcesso(ov, "clm_a", { id: "usr_bia", nome: "Beatriz" })).toBe(true);
    expect(atuouNoProcesso(ov, "clm_a", { id: "usr_caio", nome: "Caio" })).toBe(false);
  });
});

describe("Desempenho — processo finalizado", () => {
  const ov = {
    clm_a: {
      responsavelUser: { id: "usr_dono", nome: "Dono" },
      comms: [{ who: "Ana", whoId: "usr_ana", canal: "Cliente", at: "2026-10-10T10:00:00.000Z" }],
      journeyUser: { caminho: "parcial", steps: { conclusao: { status: "Indenizado", concludedAt: AT, concludedBy: "Bia", concludedById: "usr_bia" } } },
    },
  };
  const m = (id, nome) => calcularMetricasUsuario({ claims: [CLAIM], overrides: ov, historico, usuarioId: id, usuarioNome: nome, periodoInicioISO: DE, periodoFimISO: ATE });

  it("conta pra todos que atuaram e destaca quem marcou o desfecho", () => {
    expect(m("usr_ana", "Ana").finalizadosNoPeriodo).toBe(1);
    expect(m("usr_ana", "Ana").finalizadosPorEleNoPeriodo).toBe(0);
    expect(m("usr_bia", "Bia").finalizadosNoPeriodo).toBe(1);
    expect(m("usr_bia", "Bia").finalizadosPorEleNoPeriodo).toBe(1);
  });

  it("não conta pra quem nunca atuou no processo, nem sendo o responsável", () => {
    expect(m("usr_dono", "Dono").finalizadosNoPeriodo).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { gerarTokenPublico, montarSnapshotPublico, snapshotsIguais } from "./publicTracking";

describe("gerarTokenPublico", () => {
  it("gera tokens longos e diferentes a cada chamada", () => {
    const a = gerarTokenPublico();
    const b = gerarTokenPublico();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(20);
    expect(a).not.toMatch(/-/); // sem hífen, mais fácil de colar em qualquer lugar
  });
});

describe("montarSnapshotPublico", () => {
  const c = { id: "c1", nosnum: 123, numsin: "111/2026", segurado: "Carlos", placa: "ABC1234", cia: "Banestes", ramo: "Auto", situacao: "Em andamento" };

  it("expõe só os campos seguros — nunca histórico, auditoria ou valores", () => {
    const overrides = {
      c1: {
        comms: [{ canal: "Cliente", text: "Informação interna sensível" }],
        audit: [{ acao: "x" }],
        finance: { valavi: 50000 },
        nextAction: { title: "Ligar cobrando desconto — cliente ameaçou reclamar", date: "2026-09-10" },
      },
    };
    const snap = montarSnapshotPublico(c, overrides, {}, null);
    expect(snap).not.toHaveProperty("comms");
    expect(snap).not.toHaveProperty("audit");
    expect(snap).not.toHaveProperty("finance");
    // a próxima ação só entra pela DATA, nunca pelo texto livre (pode ter anotação interna)
    expect(JSON.stringify(snap)).not.toMatch(/reclamar/);
    expect(snap.previsaoRetorno).toBe("2026-09-10");
  });

  it("inclui os campos exibidos ao cliente", () => {
    const snap = montarSnapshotPublico(c, {}, {}, null);
    expect(snap.ativo).toBe(true);
    expect(snap.claimId).toBe("c1");
    expect(snap.segurado).toBe("Carlos");
    expect(snap.placa).toBe("ABC1234");
    expect(snap.numsin).toBe("111/2026");
    expect(snap.situacaoLabel).toBeTruthy();
    expect(snap.atualizadoEm).toBeTruthy();
  });

  it("sem próxima ação registrada, previsaoRetorno é null", () => {
    const snap = montarSnapshotPublico(c, {}, {}, null);
    expect(snap.previsaoRetorno).toBeNull();
  });
});

describe("snapshotsIguais", () => {
  it("ignora diferença só em atualizadoEm", () => {
    const a = { situacaoLabel: "Em andamento", atualizadoEm: "2026-08-01T00:00:00.000Z" };
    const b = { situacaoLabel: "Em andamento", atualizadoEm: "2026-08-02T00:00:00.000Z" };
    expect(snapshotsIguais(a, b)).toBe(true);
  });
  it("detecta diferença em qualquer outro campo", () => {
    const a = { situacaoLabel: "Em andamento", atualizadoEm: "2026-08-01T00:00:00.000Z" };
    const b = { situacaoLabel: "Indenizado", atualizadoEm: "2026-08-01T00:00:00.000Z" };
    expect(snapshotsIguais(a, b)).toBe(false);
  });
  it("null/undefined não é igual a um objeto", () => {
    expect(snapshotsIguais(null, { a: 1 })).toBe(false);
    expect(snapshotsIguais(null, null)).toBe(true);
  });
});

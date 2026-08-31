import { describe, it, expect } from "vitest";
import {
  claimsAbertosDaOficina, montarMensagemLote, contextoClaimParaIA, montarContextoLoteParaIA,
  DEFAULT_TRATATIVA_LOTE_TEMPLATE,
} from "./tratativaLote";

const claims = [
  { id: "c1", oficina: "OFICINA X", placa: "ABC1234", numsin: "111/2026", segurado: "João", situacao: "Em andamento", ramo: "Auto" },
  { id: "c2", oficina: "OFICINA X", placa: "XYZ5678", numsin: "222/2026", segurado: "Maria", situacao: "Em andamento", ramo: "Auto" },
  { id: "c3", oficina: "OFICINA Y", placa: "QQQ0000", numsin: "333/2026", segurado: "Pedro", situacao: "Em andamento", ramo: "Auto" },
];

describe("claimsAbertosDaOficina", () => {
  it("filtra só os processos da oficina informada", () => {
    const abertos = claimsAbertosDaOficina(claims, {}, "OFICINA X", {}, null);
    expect(abertos.map((c) => c.id)).toEqual(["c1", "c2"]);
  });
  it("exclui processo já finalizado (Indenizado/Sem Indenização)", () => {
    const overrides = {
      c1: { journeyUser: { caminho: "parcial", steps: { conclusao: { status: "Indenizado" } } } },
    };
    const abertos = claimsAbertosDaOficina(claims, overrides, "OFICINA X", {}, null);
    expect(abertos.map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("montarMensagemLote", () => {
  it("repete o template uma vez por processo, substituindo [[placa]]", () => {
    const msg = montarMensagemLote(DEFAULT_TRATATIVA_LOTE_TEMPLATE, [claims[0], claims[1]], {});
    expect(msg).toContain("ABC1234: Todas as peças chegaram?");
    expect(msg).toContain("XYZ5678: Todas as peças chegaram?");
    expect(msg.split("\n\n").length).toBeGreaterThan(1);
  });
  it("template vazio/ausente cai no padrão de fábrica", () => {
    const msg = montarMensagemLote("", [claims[0]], {});
    expect(msg).toContain("Todas as peças chegaram?");
  });
  it("template customizado é respeitado", () => {
    const msg = montarMensagemLote("Placa [[placa]] — favor retornar hoje.", [claims[0]], {});
    expect(msg).toBe("Placa ABC1234 — favor retornar hoje.");
  });
});

describe("contextoClaimParaIA / montarContextoLoteParaIA", () => {
  it("inclui placa, etapa, histórico com a oficina e próxima ação", () => {
    const overrides = {
      c1: {
        comms: [{ canal: "Oficina", date: "2026-08-20", text: "Peça a caminho" }],
        nextAction: { title: "Cobrar oficina", date: "2026-09-05" },
      },
    };
    const ctx = contextoClaimParaIA(claims[0], overrides, {}, null);
    expect(ctx).toMatch(/Placa ABC1234/);
    expect(ctx).toMatch(/Etapa atual:/);
    expect(ctx).toMatch(/Peça a caminho/);
    expect(ctx).toMatch(/Cobrar oficina/);
  });
  it("sem histórico/próxima ação, avisa em vez de inventar", () => {
    const ctx = contextoClaimParaIA(claims[0], {}, {}, null);
    expect(ctx).toMatch(/Sem histórico registrado com a oficina/);
    expect(ctx).toMatch(/Sem próxima ação definida/);
  });
  it("monta o contexto de vários processos, separados por linha em branco", () => {
    const ctx = montarContextoLoteParaIA([claims[0], claims[1]], {}, {}, null);
    expect(ctx).toMatch(/ABC1234/);
    expect(ctx).toMatch(/XYZ5678/);
    expect(ctx.split("\n\n")).toHaveLength(2);
  });
});

import { describe, it, expect } from "vitest";
import { avaliarRegra, encontrarRegraAplicavel } from "./emailRules";

const email = {
  assunto: "Liberação de Reparos - FOX G3",
  remetente: "atendimento@tokiomarine.com.br",
  remetenteNome: "Tokio Marine",
  corpoTexto: "Segue a liberação para reparos do veículo.",
};

describe("avaliarRegra", () => {
  it("bate por remetente (nome ou endereço)", () => {
    expect(avaliarRegra(email, { campo: "remetente", valor: "tokio" })).toBe(true);
    expect(avaliarRegra(email, { campo: "remetente", valor: "porto" })).toBe(false);
  });
  it("bate por assunto", () => {
    expect(avaliarRegra(email, { campo: "assunto", valor: "liberação" })).toBe(true);
  });
  it("bate por conteúdo", () => {
    expect(avaliarRegra(email, { campo: "corpo", valor: "reparos do veículo" })).toBe(true);
  });
  it("ignora maiúsculas/minúsculas", () => {
    expect(avaliarRegra(email, { campo: "assunto", valor: "LIBERAÇÃO" })).toBe(true);
  });
  it("regra sem valor nunca bate", () => {
    expect(avaliarRegra(email, { campo: "assunto", valor: "" })).toBe(false);
  });
});

describe("encontrarRegraAplicavel", () => {
  it("devolve a primeira regra que bater", () => {
    const regras = [
      { id: "r1", campo: "remetente", valor: "porto", labelNome: "Porto" },
      { id: "r2", campo: "remetente", valor: "tokio", labelNome: "Tokio" },
    ];
    expect(encontrarRegraAplicavel(email, regras).id).toBe("r2");
  });
  it("sem nenhuma regra batendo, devolve null", () => {
    expect(encontrarRegraAplicavel(email, [{ campo: "remetente", valor: "porto" }])).toBe(null);
  });
});

import { describe, it, expect } from "vitest";
import { normalizarTexto, encontrarProcessosNoEmail } from "./emailMatching";

describe("normalizarTexto", () => {
  it("maiusculiza, remove acento e pontuação", () => {
    expect(normalizarTexto("José da Silva - Nº 123.456")).toBe("JOSEDASILVAN123456");
  });
  it("nulo/indefinido vira string vazia", () => {
    expect(normalizarTexto(null)).toBe("");
    expect(normalizarTexto(undefined)).toBe("");
  });
});

describe("encontrarProcessosNoEmail", () => {
  const claims = [
    { id: "c1", numsin: "2026.001234", placa: "ABC1D23", segurado: "José da Silva" },
    { id: "c2", numsin: "99", placa: "XYZ9Z99", segurado: "Maria Souza" },
  ];
  const overrides = {};

  it("identifica processo pelo número de sinistro no corpo do e-mail", () => {
    const texto = "Prezados, segue atualização do sinistro nº 2026.001234, aguardando peças.";
    const out = encontrarProcessosNoEmail(texto, claims, overrides);
    expect(out).toEqual([{ claimId: "c1", motivos: ["numero_sinistro"] }]);
  });
  it("identifica processo pela placa (ignorando espaço/traço)", () => {
    const texto = "Veículo placa ABC-1D23 já está pronto para retirada.";
    const out = encontrarProcessosNoEmail(texto, claims, overrides);
    expect(out).toEqual([{ claimId: "c1", motivos: ["placa"] }]);
  });
  it("identifica processo pelo nome do segurado", () => {
    const texto = "Boa tarde, sou o Sr. Jose da Silva, gostaria de saber do andamento.";
    const out = encontrarProcessosNoEmail(texto, claims, overrides);
    expect(out).toEqual([{ claimId: "c1", motivos: ["nome"] }]);
  });
  it("acumula mais de um motivo quando bate em vários sinais", () => {
    const texto = "Sinistro 2026.001234 - segurado Jose da Silva - placa ABC1D23";
    const out = encontrarProcessosNoEmail(texto, claims, overrides);
    expect(out).toEqual([{ claimId: "c1", motivos: ["numero_sinistro", "placa", "nome"] }]);
  });
  it("ignora sinais curtos demais (evita falso positivo)", () => {
    const texto = "Aqui não tem nada em comum com o processo 99.";
    const out = encontrarProcessosNoEmail(texto, claims, overrides);
    expect(out).toEqual([]);
  });
  it("sem nenhum sinal em comum, não retorna nada", () => {
    const texto = "E-mail qualquer sem relação com nenhum processo.";
    expect(encontrarProcessosNoEmail(texto, claims, overrides)).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { caminhoPastaAnexoProcesso } from "./anexosProcesso";

describe("caminhoPastaAnexoProcesso", () => {
  it("combina número do sinistro e nome do segurado", () => {
    expect(caminhoPastaAnexoProcesso("2026.001.9001", "Carlos Andrade")).toBe("2026.001.9001_Carlos Andrade");
  });
  it("usa valores padrão quando faltam dados", () => {
    expect(caminhoPastaAnexoProcesso("", "")).toBe("sem-numero_sem-nome");
  });
});

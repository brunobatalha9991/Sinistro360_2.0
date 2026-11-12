import { describe, it, expect } from "vitest";
import { partesComMencoes, mencoesNoTexto, mencaoEmDigitacao, sugestoesMencao, inserirMencao } from "./mencoes";

const users = [
  { id: "u1", nome: "Bruno Oliveira" },
  { id: "u2", nome: "Ana Lúcia" },
  { id: "u3", nome: "Ana Paula" },
  { id: "u4", nome: "José" },
];

describe("mencoes", () => {
  it("acha marcação pelo nome completo, sem acento e sem maiúsculas", () => {
    expect(mencoesNoTexto("Oi @bruno oliveira, veja", users)).toEqual(["u1"]);
    expect(mencoesNoTexto("@Ana Lucia e @ANA PAULA", users)).toEqual(["u2", "u3"]);
  });

  it("primeiro nome só vale quando é único", () => {
    expect(mencoesNoTexto("@Bruno pode ver?", users)).toEqual(["u1"]);
    expect(mencoesNoTexto("@Ana pode ver?", users)).toEqual([]);
    expect(mencoesNoTexto("@jose", users)).toEqual(["u4"]);
  });

  it("não marca e-mail nem nome colado em outra palavra", () => {
    expect(mencoesNoTexto("mande para x@bruno oliveira", users)).toEqual([]);
    expect(mencoesNoTexto("@Brunoo", users)).toEqual([]);
  });

  it("separa o texto em trechos com o usuário marcado", () => {
    expect(partesComMencoes("Oi @José!", users)).toEqual([{ texto: "Oi " }, { texto: "@José", userId: "u4" }, { texto: "!" }]);
  });

  it("detecta o @ sendo digitado", () => {
    expect(mencaoEmDigitacao("Oi @an", 6)).toEqual({ inicio: 3, termo: "an" });
    expect(mencaoEmDigitacao("Oi @ana p", 9)).toEqual({ inicio: 3, termo: "ana p" });
    expect(mencaoEmDigitacao("email@x", 7)).toBeNull();
    expect(mencaoEmDigitacao("sem arroba", 10)).toBeNull();
  });

  it("sugere pelo começo do nome ou sobrenome, sem o próprio usuário", () => {
    expect(sugestoesMencao("ana", users, "u1").map((u) => u.id)).toEqual(["u2", "u3"]);
    expect(sugestoesMencao("oli", users, "u2").map((u) => u.id)).toEqual(["u1"]);
    expect(sugestoesMencao("", users, "u1").map((u) => u.id)).not.toContain("u1");
  });

  it("insere a marcação no lugar do termo", () => {
    const r = inserirMencao("Oi @an tudo bem", 6, { inicio: 3, termo: "an" }, users[1]);
    expect(r.texto).toBe("Oi @Ana Lúcia tudo bem");
    expect(r.cursor).toBe("Oi @Ana Lúcia ".length);
  });
});

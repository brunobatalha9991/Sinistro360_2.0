import { describe, it, expect } from "vitest";
import { checklistProgresso, CHECKLIST_SEGURADO, CHECKLIST_TERCEIRO } from "./checklistMesaAtendimento";

describe("checklistProgresso", () => {
  it("sem checklist, devolve 0/0", () => {
    expect(checklistProgresso(null)).toEqual({ feitos: 0, total: 0 });
  });

  it("sem terceiro, considera só os itens do segurado", () => {
    const p = checklistProgresso({ temTerceiro: false, itens: {} });
    expect(p.total).toBe(CHECKLIST_SEGURADO.length);
  });

  it("com terceiro, soma os itens de segurado e terceiro", () => {
    const p = checklistProgresso({ temTerceiro: true, itens: {} });
    expect(p.total).toBe(CHECKLIST_SEGURADO.length + CHECKLIST_TERCEIRO.length);
  });

  it("conta corretamente os itens marcados", () => {
    const itens = { [CHECKLIST_SEGURADO[0].id]: true, [CHECKLIST_SEGURADO[1].id]: true };
    const p = checklistProgresso({ temTerceiro: false, itens });
    expect(p.feitos).toBe(2);
  });
});

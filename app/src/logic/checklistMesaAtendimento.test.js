import { describe, it, expect } from "vitest";
import {
  checklistProgresso, getChecklistEfetivo, sincronizarComFormulario, checklistVazio,
  CHECKLIST_SEGURADO, CHECKLIST_TERCEIRO,
} from "./checklistMesaAtendimento";

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

  it("usa a personalização do admin quando configurada", () => {
    const config = { corp_checklist_mesa_atendimento: { segurado: [{ id: "a", label: "A" }, { id: "b", label: "B" }] } };
    const p = checklistProgresso({ temTerceiro: false, itens: {} }, config);
    expect(p.total).toBe(2);
  });
});

describe("getChecklistEfetivo", () => {
  it("sem personalização, usa os padrões de fábrica", () => {
    const efetivo = getChecklistEfetivo({});
    expect(efetivo.segurado).toBe(CHECKLIST_SEGURADO);
    expect(efetivo.terceiro).toBe(CHECKLIST_TERCEIRO);
  });

  it("personaliza só um grupo, mantendo o outro no padrão", () => {
    const config = { corp_checklist_mesa_atendimento: { segurado: [{ id: "x", label: "X" }] } };
    const efetivo = getChecklistEfetivo(config);
    expect(efetivo.segurado).toHaveLength(1);
    expect(efetivo.terceiro).toBe(CHECKLIST_TERCEIRO);
  });

  it("lista vazia não sobrescreve o padrão", () => {
    const config = { corp_checklist_mesa_atendimento: { segurado: [] } };
    const efetivo = getChecklistEfetivo(config);
    expect(efetivo.segurado).toBe(CHECKLIST_SEGURADO);
  });
});

describe("sincronizarComFormulario", () => {
  it("marca automaticamente um item quando o campo vinculado é preenchido", () => {
    const item = CHECKLIST_SEGURADO.find((i) => i.campoVinculado === "tipo_ocorrencia");
    const resultado = sincronizarComFormulario(checklistVazio(), { tipo_ocorrencia: "Colisão" }, {});
    expect(resultado.itens[item.id]).toBe(true);
    expect(resultado.sincronizados[item.id]).toBe(true);
  });

  it("não marca nada quando o campo vinculado está vazio", () => {
    const resultado = sincronizarComFormulario(checklistVazio(), { tipo_ocorrencia: "" }, {});
    const item = CHECKLIST_SEGURADO.find((i) => i.campoVinculado === "tipo_ocorrencia");
    expect(resultado.itens[item.id]).toBeUndefined();
  });

  it("depois de sincronizado uma vez, desmarcar manualmente NÃO é revertido em nova sincronização", () => {
    const item = CHECKLIST_SEGURADO.find((i) => i.campoVinculado === "tipo_ocorrencia");
    let estado = sincronizarComFormulario(checklistVazio(), { tipo_ocorrencia: "Colisão" }, {});
    expect(estado.itens[item.id]).toBe(true);

    // usuário desmarca manualmente
    estado = { ...estado, itens: { ...estado.itens, [item.id]: false } };

    // nova sincronização (ex.: outro campo mudou) não deve remarcar
    estado = sincronizarComFormulario(estado, { tipo_ocorrencia: "Colisão", endereco_ocorrencia: "Rua X" }, {});
    expect(estado.itens[item.id]).toBe(false);
  });

  it("liga 'Houve terceiro?' quando atendimento_desejado indica terceiro", () => {
    const resultado = sincronizarComFormulario(checklistVazio(), { atendimento_desejado: "Para o Segurado e o Terceiro" }, {});
    expect(resultado.temTerceiro).toBe(true);
  });

  it("não mexe em 'Houve terceiro?' quando o atendimento é só para o segurado", () => {
    const resultado = sincronizarComFormulario(checklistVazio(), { atendimento_desejado: "Apenas para o segurado" }, {});
    expect(resultado.temTerceiro).toBe(false);
  });

  it("devolve a MESMA referência quando nada muda (evita re-render em loop)", () => {
    const vazio = checklistVazio();
    const resultado = sincronizarComFormulario(vazio, {}, {});
    expect(resultado).toBe(vazio);
  });
});

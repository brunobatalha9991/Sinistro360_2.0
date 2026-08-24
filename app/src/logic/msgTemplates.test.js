import { describe, it, expect } from "vitest";
import { buildTemplateVars, renderTemplate, clienteWhatsappDigits, defaultMsgTemplates } from "./msgTemplates";
import { clienteIdFromNome } from "./clientes";

const c = { id: "c1", segurado: "Carlos Andrade", cia: "Porto Seguro", oficina: "Oficina Central", numsin: "2026.001.9001", numapo: "AP-4451", placa: "ABC1D23", ramo: "Automóvel" };

describe("buildTemplateVars", () => {
  it("resolve os campos direto do sinistro (sem override)", () => {
    const vars = buildTemplateVars(c, {}, "Vistoria");
    expect(vars.cliente).toBe("Carlos Andrade");
    expect(vars.seguradora).toBe("Porto Seguro");
    expect(vars.oficina).toBe("Oficina Central");
    expect(vars.numero_sinistro).toBe("2026.001.9001");
    expect(vars.apolice).toBe("AP-4451");
    expect(vars.placa).toBe("ABC1D23");
    expect(vars.ramo).toBe("Automóvel");
    expect(vars.etapa).toBe("Vistoria");
  });
  it("respeita override manual do campo", () => {
    const overrides = { c1: { campos: { oficina: "Outra Oficina" } } };
    expect(buildTemplateVars(c, overrides, "Vistoria").oficina).toBe("Outra Oficina");
  });
  it("data_etapa e observacao_etapa vêm do step cujo title bate com a etapa atual", () => {
    const overrides = { c1: { journeyUser: { steps: { vistoria: { title: "Vistoria", status: "Aguardando", date: "2026-08-20", note: "Cliente confirmou disponibilidade pela manhã" } } } } };
    const vars = buildTemplateVars(c, overrides, "Vistoria");
    expect(vars.data_etapa).toBe("20/08/2026");
    expect(vars.observacao_etapa).toBe("Cliente confirmou disponibilidade pela manhã");
  });
  it("sem step correspondente, data_etapa e observacao_etapa ficam vazios", () => {
    const vars = buildTemplateVars(c, {}, "Vistoria");
    expect(vars.data_etapa).toBe("");
    expect(vars.observacao_etapa).toBe("");
  });
});

describe("renderTemplate", () => {
  it("substitui variáveis conhecidas", () => {
    expect(renderTemplate("Olá [[cliente]], sinistro [[numero_sinistro]].", { cliente: "Carlos", numero_sinistro: "2026.001.9001" }))
      .toBe("Olá Carlos, sinistro 2026.001.9001.");
  });
  it("variável conhecida mas vazia vira string vazia", () => {
    expect(renderTemplate("Placa: [[placa]].", { placa: "" })).toBe("Placa: .");
  });
  it("variável desconhecida fica como está (visível de propósito)", () => {
    expect(renderTemplate("Olá [[nao_existe]]!", {})).toBe("Olá [[nao_existe]]!");
  });
});

describe("clienteWhatsappDigits", () => {
  it("sem cadastro, retorna vazio", () => {
    expect(clienteWhatsappDigits({}, "Carlos Andrade")).toBe("");
  });
  it("com telefone cadastrado, retorna só dígitos com DDI 55 quando faltar", () => {
    const id = clienteIdFromNome("Carlos Andrade");
    const clientes = { [id]: { contatos: [{ nome: "Carlos", telefone: "(11) 91234-5678" }] } };
    expect(clienteWhatsappDigits(clientes, "Carlos Andrade")).toBe("5511912345678");
  });
  it("telefone já com DDI (mais de 11 dígitos) não duplica o 55", () => {
    const id = clienteIdFromNome("Carlos Andrade");
    const clientes = { [id]: { contatos: [{ telefone: "+55 11 91234-5678" }] } };
    expect(clienteWhatsappDigits(clientes, "Carlos Andrade")).toBe("5511912345678");
  });
});

describe("defaultMsgTemplates", () => {
  it("traz os 2 exemplos padrão, cada um com id, nome, etapaVinculada e texto", () => {
    const tpls = defaultMsgTemplates();
    expect(tpls).toHaveLength(2);
    tpls.forEach((t) => {
      expect(t.id).toBeTruthy();
      expect(t.nome).toBeTruthy();
      expect(t.texto).toContain("[[cliente]]");
    });
    expect(tpls.map((t) => t.etapaVinculada)).toEqual(["Vistoria", "Atendimento inicial"]);
  });
});

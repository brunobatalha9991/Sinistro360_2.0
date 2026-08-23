import { describe, it, expect } from "vitest";
import { extractProdDocs, extractUrlApolice } from "./corpApi";

// Formato real de GET /documento?codfil=&nosnum= (exemplo enviado pelo
// usuário) — body.documento[0].prod_docs é a lista de {agente, produtor}.
const RESPOSTA_REAL = {
  documento: [
    {
      codfil: 1,
      nosnum: 64170,
      prod_docs: [
        { agente: "PRODUÇÃO CORRETORA", produtor: "PRODUÇÃO CORRETORA - BATALHA", cod_age: 1, cod_pro: 1 },
        { agente: "PRODUÇÃO CORRETORA", produtor: "BRUNO OLIVEIRA", cod_age: 1, cod_pro: 17666 },
      ],
    },
  ],
  acompanhamento: {
    emissao: {
      numapo: "114134153657",
      datemi: "19/09/2025",
      url_apolice: "https://corp-anexos.s3.amazonaws.com/exemplo.pdf?Signature=abc",
      bot_emitido: true,
    },
  },
};

describe("extractProdDocs", () => {
  it("extrai a lista de agente/produtor da resposta real do CORP", () => {
    const out = extractProdDocs(RESPOSTA_REAL);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ agente: "PRODUÇÃO CORRETORA", produtor: "PRODUÇÃO CORRETORA - BATALHA" });
    expect(out[1]).toMatchObject({ agente: "PRODUÇÃO CORRETORA", produtor: "BRUNO OLIVEIRA" });
  });
  it("devolve array vazio se documento não existe", () => {
    expect(extractProdDocs({ documento: [] })).toEqual([]);
  });
  it("devolve array vazio se prod_docs não existe", () => {
    expect(extractProdDocs({ documento: [{ codfil: 1 }] })).toEqual([]);
  });
  it("devolve array vazio pra resposta nula/indefinida", () => {
    expect(extractProdDocs(null)).toEqual([]);
    expect(extractProdDocs(undefined)).toEqual([]);
  });
});

describe("extractUrlApolice", () => {
  it("extrai a url da apólice da resposta real do CORP", () => {
    expect(extractUrlApolice(RESPOSTA_REAL)).toBe("https://corp-anexos.s3.amazonaws.com/exemplo.pdf?Signature=abc");
  });
  it("devolve string vazia se não houver acompanhamento/emissao/url_apolice", () => {
    expect(extractUrlApolice({})).toBe("");
    expect(extractUrlApolice({ acompanhamento: {} })).toBe("");
    expect(extractUrlApolice({ acompanhamento: { emissao: {} } })).toBe("");
  });
  it("devolve string vazia pra resposta nula/indefinida", () => {
    expect(extractUrlApolice(null)).toBe("");
    expect(extractUrlApolice(undefined)).toBe("");
  });
});

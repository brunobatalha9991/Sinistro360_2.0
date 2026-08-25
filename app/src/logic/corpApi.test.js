import { describe, it, expect } from "vitest";
import { extractProdDocs, extractUrlApolice, extractDocumentoDetalhado, mapearLigacoesCliente } from "./corpApi";

// Formato real de GET /documento?codfil=&nosnum= (exemplo enviado pelo
// usuário) — body.documento[0].prod_docs é a lista de {agente, produtor}.
const RESPOSTA_REAL = {
  documento: [
    {
      codfil: 1,
      nosnum: 64170,
      numapo: "114134153657",
      numend: "0",
      numprop: "85496174",
      tipdoc: "A", tipdoc_txt: "A - Apólice",
      tabela_itens: "PACOTE", filial: "BATALHA ADM E CORRETORA DE SEG",
      inivig: "19/09/2025",
      fimvig: "19/09/2026",
      pretot: 357, preliq: 268.76, preadi: 63.7, predes: 0, preiof: 24.54, prepri: 35.69,
      numpar: 10,
      forma_pag: "Boleto Bancário",
      seguradora: "PORTO SEGURO",
      ramo: "RESIDENCIAL",
      cliente: "BRUNO MARCULINO DE OLIVEIRA",
      sit_acompanhamento_txt: "Recebido e não entregue ao cliente",
      sit_sinistro_txt: "APÓLICE SEM SINISTRO",
      sit_renovacao_txt: "APÓLICE NOVA",
      ad_receb_doc_fisico: "F", ad_receb_doc_digital: "T", ad_receb_data: "25/09/2025", ad_entr_data: null,
      parcelas: [
        { parc: 1, datvenc: "29/09/2025", vlvenc: 35.69, datquit: null },
        { parc: 2, datvenc: "29/10/2025", vlvenc: 35.7, datquit: "01/10/2025" },
      ],
      prod_docs: [
        { agente: "PRODUÇÃO CORRETORA", produtor: "PRODUÇÃO CORRETORA - BATALHA", cod_age: 1, cod_pro: 1 },
        { agente: "PRODUÇÃO CORRETORA", produtor: "BRUNO OLIVEIRA", cod_age: 1, cod_pro: 17666 },
      ],
    },
  ],
  acompanhamento: {
    proposta: { numprop: "85496174", url_proposta: null },
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

describe("extractDocumentoDetalhado", () => {
  it("achata os campos principais do documento + acompanhamento", () => {
    const d = extractDocumentoDetalhado(RESPOSTA_REAL);
    expect(d).toMatchObject({
      seguradora: "PORTO SEGURO", ramo: "RESIDENCIAL", numeroApolice: "114134153657",
      numeroProposta: "85496174", vigenciaInicio: "19/09/2025", vigenciaFim: "19/09/2026",
      valorTotal: 357, numeroParcelas: 10, formaPagamento: "Boleto Bancário",
      cliente: "BRUNO MARCULINO DE OLIVEIRA",
      situacaoAcompanhamento: "Recebido e não entregue ao cliente",
      situacaoSinistro: "APÓLICE SEM SINISTRO",
      urlApolice: "https://corp-anexos.s3.amazonaws.com/exemplo.pdf?Signature=abc",
    });
  });
  it("achata também os valores detalhados e o recebimento/entrega do documento", () => {
    const d = extractDocumentoDetalhado(RESPOSTA_REAL);
    expect(d).toMatchObject({
      tipoDocumento: "A - Apólice", categoriaItem: "PACOTE", filial: "BATALHA ADM E CORRETORA DE SEG",
      valorLiquido: 268.76, valorAdicionalFracionamento: 63.7, valorDesconto: 0, valorIof: 24.54, valorPrimeiraParcela: 35.69,
      documentoRecebidoFisico: false, documentoRecebidoDigital: true, dataRecebimentoDocumento: "25/09/2025",
    });
  });
  it("prodDocs não inclui dado de comissão/repasse (só agente/produtor)", () => {
    const d = extractDocumentoDetalhado(RESPOSTA_REAL);
    expect(Object.keys(d.prodDocs[0]).sort()).toEqual(["agente", "produtor"]);
  });
  it("extrai as parcelas", () => {
    const d = extractDocumentoDetalhado(RESPOSTA_REAL);
    expect(d.parcelas).toHaveLength(2);
    expect(d.parcelas[0]).toEqual({ numero: 1, vencimento: "29/09/2025", valor: 35.69, quitadoEm: null, valorQuitado: null });
    expect(d.parcelas[1]).toEqual({ numero: 2, vencimento: "29/10/2025", valor: 35.7, quitadoEm: "01/10/2025", valorQuitado: null });
  });
  it("reaproveita extractProdDocs pro agente/produtor", () => {
    const d = extractDocumentoDetalhado(RESPOSTA_REAL);
    expect(d.prodDocs).toHaveLength(2);
    expect(d.prodDocs[1]).toMatchObject({ agente: "PRODUÇÃO CORRETORA", produtor: "BRUNO OLIVEIRA" });
  });
  it("devolve null sem documento nenhum (não lança)", () => {
    expect(extractDocumentoDetalhado({})).toBeNull();
    expect(extractDocumentoDetalhado({ documento: [] })).toBeNull();
    expect(extractDocumentoDetalhado(null)).toBeNull();
    expect(extractDocumentoDetalhado(undefined)).toBeNull();
  });
});

describe("mapearLigacoesCliente", () => {
  it("achata cada documento de /cliente_ligacoes no mesmo formato de extractDocumentoDetalhado (sem URL de PDF)", () => {
    const docs = mapearLigacoesCliente(RESPOSTA_REAL.documento);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      codfil: 1, nosnum: 64170, seguradora: "PORTO SEGURO", ramo: "RESIDENCIAL",
      numeroApolice: "114134153657", valorTotal: 357, numeroParcelas: 10,
    });
    expect(docs[0].urlApolice).toBeUndefined();
    expect(docs[0].parcelas).toHaveLength(2);
    expect(docs[0].prodDocs).toHaveLength(2);
  });
  it("ignora entradas sem documento válido, sem lançar", () => {
    expect(mapearLigacoesCliente([])).toEqual([]);
    expect(mapearLigacoesCliente(null)).toEqual([]);
    expect(mapearLigacoesCliente(undefined)).toEqual([]);
  });
});

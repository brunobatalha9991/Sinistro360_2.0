import { describe, expect, it } from "vitest";
import { parseImportPayloadFromText } from "./importFormularioComercial";

const MARK_START = "-----SINISTRO360-DADOS-INICIO-----";
const MARK_END = "-----SINISTRO360-DADOS-FIM-----";

// Mesma codificação feita em docs/Formulario-Abertura-Comercial.html
// (b64EncodeUnicode + quebra em linhas de 90 colunas) — reproduzida aqui pra
// validar que o lado que decodifica (importFormularioComercial.js) entende
// exatamente o que o formulário standalone produz.
function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
}

function montarBlocoImpresso(payload, { comQuebrasDeLinha = true } = {}) {
  const json = JSON.stringify(payload);
  const b64 = b64EncodeUnicode(json);
  if (!comQuebrasDeLinha) return MARK_START + "\n" + b64 + "\n" + MARK_END;
  const linhas = [];
  for (let i = 0; i < b64.length; i += 90) linhas.push(b64.slice(i, i + 90));
  return MARK_START + "\n" + linhas.join("\n") + "\n" + MARK_END;
}

function payloadExemplo(extra) {
  return {
    _origem: "sinistro360_formulario_comercial",
    _versao: 1,
    _geradoEm: "2026-09-08T12:00:00.000Z",
    tipoParte: "Segurado",
    segurado: "João da Silva Ção",
    placa: "ABC1D23",
    cia: "Porto Seguro",
    ramo: "AUTO",
    agente: "Fulano",
    produtor: "Ciclano",
    responsavelSugerido: "Beltrano",
    clienteContatos: [{ nome: "Maria", telefone: "11999998888", email: "", cargo: "" }],
    ...extra,
  };
}

describe("parseImportPayloadFromText", () => {
  it("decodifica um bloco válido, simulando o texto extraído do PDF (uma página, sem quebras extras)", () => {
    const payload = payloadExemplo();
    const textoPdf = "Formulário de Abertura...\n\n" + montarBlocoImpresso(payload) + "\n";
    const result = parseImportPayloadFromText(textoPdf);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(payload);
  });

  it("decodifica corretamente mesmo com espaços/quebras extras entre os caracteres (pdf.js pode inserir por item de texto)", () => {
    const payload = payloadExemplo({ observacoes: "linha 1\nlinha 2" });
    const bloco = montarBlocoImpresso(payload);
    // simula pdf.js extraindo cada "linha" impressa como um item de texto
    // separado, unido com \n — exatamente o que extractPdfText faz.
    const comRuido = bloco.split("\n").join("\n \n");
    const result = parseImportPayloadFromText("cabeçalho\n" + comRuido);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(payload);
  });

  it("preserva acentuação/UTF-8 no roundtrip", () => {
    const payload = payloadExemplo({ descricao: "Colisão traseira na Av. São João — sem vítimas" });
    const result = parseImportPayloadFromText(montarBlocoImpresso(payload));
    expect(result.ok).toBe(true);
    expect(result.data.descricao).toBe("Colisão traseira na Av. São João — sem vítimas");
  });

  it("rejeita texto sem os marcadores (PDF que não veio do formulário)", () => {
    const result = parseImportPayloadFromText("um PDF qualquer, sem nada relacionado ao Sinistro360");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/não foi possível localizar/i);
  });

  it("rejeita bloco corrompido (base64 quebrado no meio)", () => {
    const bloco = montarBlocoImpresso(payloadExemplo());
    const corrompido = bloco.slice(0, Math.floor(bloco.length * 0.6)) + MARK_END;
    const result = parseImportPayloadFromText(corrompido);
    expect(result.ok).toBe(false);
  });

  it("rejeita payload sem o nome do segurado/terceiro", () => {
    const payload = payloadExemplo({ segurado: "" });
    const result = parseImportPayloadFromText(montarBlocoImpresso(payload));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/válido/i);
  });

  it("rejeita payload de outra origem (não é o formulário comercial)", () => {
    const payload = payloadExemplo({ _origem: "outra_coisa" });
    const result = parseImportPayloadFromText(montarBlocoImpresso(payload));
    expect(result.ok).toBe(false);
  });
});

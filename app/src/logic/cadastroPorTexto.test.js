import { describe, expect, it } from "vitest";
import {
  CAMPOS_CADASTRO_TEXTO, MARK_END, MARK_START, ORIGEM_CADASTRO_TEXTO,
  gerarPromptCadastro, normalizarDataBR, normalizarMoeda, normalizarTipoParte, parseCadastroTexto, valorVazio,
} from "./cadastroPorTexto";

const RESPOSTA_COMPLETA = `Segue o bloco preenchido:

${MARK_START}
TIPO: Segurado
NOME: João da Silva Ção
CPF_CNPJ: 123.456.789-00
TELEFONE: (11) 99999-8888
EMAIL: joao@exemplo.com
ENDERECO: Rua A, 10 - São Paulo/SP
PLACA: abc-1d23
MARCA: Fiat
MODELO: Argo
ANO_MODELO: 2023
SEGURADORA: PORTO SEGURO
NUMERO_SINISTRO: 2026.123456
RAMO: AUTO
APOLICE: 531.00.12345
ENDOSSO: 0
ITEM: 1
DATA_OCORRENCIA: 05/10/2026
DATA_AVISO: 06/10/2026
FRANQUIA: R$ 2.500,00
VALOR_AVALIADO: 18750,50
OFICINA: Oficina Central
AGENTE: Fulano
PRODUTOR: Ciclano - SP
RESPONSAVEL: Beltrano
DESCRICAO: Colisão traseira na Av. Paulista.
Terceiro envolvido: placa XYZ9A88.
Sem vítimas.
OBSERVACOES: Protocolo 998877. Analista: Maria.
${MARK_END}

Qualquer coisa me avise.`;

describe("gerarPromptCadastro", () => {
  it("inclui regras, catálogos e o formato de resposta com todas as chaves", () => {
    const p = gerarPromptCadastro({ seguradoras: ["PORTO SEGURO", "AZUL"], ramos: ["AUTO"], produtores: [], responsaveis: ["Ana"] }, "Priorize o nº do sinistro.");
    expect(p).toContain("Seguradoras: PORTO SEGURO; AZUL");
    expect(p).toContain("Produtores: (nenhum cadastrado");
    expect(p).toContain("Responsáveis (usuários do sistema): Ana");
    expect(p).toContain("INSTRUÇÕES ADICIONAIS DA CORRETORA\nPriorize o nº do sinistro.");
    expect(p).toContain(MARK_START);
    expect(p).toContain(MARK_END);
    CAMPOS_CADASTRO_TEXTO.forEach((f) => expect(p).toContain("\n" + f.label + ": "));
  });
  it("não inclui a seção de instruções adicionais quando vazia", () => {
    expect(gerarPromptCadastro({}, "   ")).not.toContain("INSTRUÇÕES ADICIONAIS");
  });
});

describe("normalizadores", () => {
  it("datas", () => {
    expect(normalizarDataBR("05/10/2026")).toBe("2026-10-05");
    expect(normalizarDataBR("5/10/26")).toBe("2026-10-05");
    expect(normalizarDataBR("2026-10-05")).toBe("2026-10-05");
    expect(normalizarDataBR("05-10-2026")).toBe("2026-10-05");
    expect(normalizarDataBR("outubro")).toBe("");
  });
  it("valores", () => {
    expect(normalizarMoeda("R$ 2.500,00")).toBe("2500");
    expect(normalizarMoeda("18750,50")).toBe("18750.5");
    expect(normalizarMoeda("1500.00")).toBe("1500");
    expect(normalizarMoeda("2.500")).toBe("2500");
    expect(normalizarMoeda("1,234,567.89")).toBe("1234567.89");
    expect(normalizarMoeda("a combinar")).toBe("");
  });
  it("tipo de parte", () => {
    expect(normalizarTipoParte("terceiro")).toBe("Terceiro");
    expect(normalizarTipoParte("SEGURADO")).toBe("Segurado");
    expect(normalizarTipoParte("atendimento")).toBe("Atendimento");
    expect(normalizarTipoParte("outro")).toBe("");
  });
  it("valores considerados vazios", () => {
    ["", " - ", "—", "N/I", "não identificado", "[Não informado]", "null"].forEach((v) => expect(valorVazio(v)).toBe(true));
    expect(valorVazio("0")).toBe(false);
    expect(valorVazio("Fulano")).toBe(false);
  });
});

describe("parseCadastroTexto", () => {
  it("lê o bloco completo, normaliza e monta o prefill do módulo Abertura", () => {
    const r = parseCadastroTexto(RESPOSTA_COMPLETA);
    expect(r.ok).toBe(true);
    const d = r.data;
    expect(d._origem).toBe(ORIGEM_CADASTRO_TEXTO);
    expect(d.tipoParte).toBe("Segurado");
    expect(d.segurado).toBe("João da Silva Ção");
    expect(d.placa).toBe("ABC1D23");
    expect(d.cia).toBe("PORTO SEGURO");
    expect(d.numsin).toBe("2026.123456");
    expect(d.datoco).toBe("2026-10-05");
    expect(d.datavi).toBe("2026-10-06");
    expect(d.franquia).toBe("2500");
    expect(d.valavi).toBe("18750.5");
    expect(d.produtor).toBe("Ciclano - SP");
    expect(d.responsavelSugerido).toBe("Beltrano");
    expect(d.descricao).toBe("Colisão traseira na Av. Paulista.\nTerceiro envolvido: placa XYZ9A88.\nSem vítimas.");
    expect(d.observacoes).toBe("Protocolo 998877. Analista: Maria.");
    expect(d.clienteDocumento).toBe("123.456.789-00");
    expect(d.clienteEndereco).toBe("Rua A, 10 - São Paulo/SP");
    expect(d.clienteContatos).toEqual([{ nome: "João da Silva Ção", telefone: "(11) 99999-8888", email: "joao@exemplo.com", cargo: "" }]);
    expect(d.clienteTelefone).toBeUndefined();
    expect(r.vazios).toEqual([]);
    expect(r.avisos).toEqual([]);
    expect(r.ignorados).toEqual([]);
  });

  it("campos em branco ou marcados como não identificados ficam vazios pra preenchimento manual", () => {
    const r = parseCadastroTexto(`${MARK_START}
TIPO:
NOME: Maria
SEGURADORA: -
RAMO: não identificado
PLACA:
DATA_OCORRENCIA: 10/10/2026
${MARK_END}`);
    expect(r.ok).toBe(true);
    expect(r.data.tipoParte).toBe("Segurado");
    expect(r.data.segurado).toBe("Maria");
    expect(r.data.cia).toBe("");
    expect(r.data.ramo).toBe("");
    expect(r.data.placa).toBe("");
    expect(r.data.clienteContatos).toEqual([]);
    expect(r.reconhecidos).toEqual(["segurado", "datoco"]);
    expect(r.vazios).toContain("tipoParte");
    expect(r.vazios).toContain("cia");
    expect(r.vazios).toContain("ramo");
    expect(r.vazios).toContain("produtor");
    // data de aviso não informada cai no dia de hoje (mesmo padrão do módulo Abertura)
    expect(r.data.datavi).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("aceita texto sem marcadores, chaves com acento/minúsculas, apelidos e '=' como separador", () => {
    const r = parseCadastroTexto(`segurado = Pedro
Número do sinistro: 777
Data do sinistro: 01/02/2026
Valor: R$ 1.000,00
**Observação:** teste
Linha solta sem chave`);
    expect(r.ok).toBe(true);
    expect(r.data.segurado).toBe("Pedro");
    expect(r.data.numsin).toBe("777");
    expect(r.data.datoco).toBe("2026-02-01");
    expect(r.data.valavi).toBe("1000");
    // "Linha solta" vem depois de OBSERVACOES (multilinha) → continua o campo
    expect(r.data.observacoes).toBe("teste\nLinha solta sem chave");
    expect(r.ignorados).toEqual([]);
  });

  it("linhas sem chave fora de campo multilinha vão pra 'ignorados'", () => {
    const r = parseCadastroTexto(`Aqui está:
NOME: Ana
PLACA: XYZ1234
Fim.`);
    expect(r.ok).toBe(true);
    expect(r.ignorados).toEqual(["Aqui está:", "Fim."]);
  });

  it("avisa sobre data/valor/tipo inválidos sem derrubar a leitura", () => {
    const r = parseCadastroTexto(`TIPO: Cliente
NOME: Ana
DATA_OCORRENCIA: começo de outubro
FRANQUIA: a combinar`);
    expect(r.ok).toBe(true);
    expect(r.data.tipoParte).toBe("Segurado");
    expect(r.data.datoco).toBe("");
    expect(r.data.franquia).toBe("");
    expect(r.avisos).toHaveLength(3);
  });

  it("falha quando nada é reconhecido", () => {
    const r = parseCadastroTexto("Não consegui ler os anexos, pode reenviar?");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Nenhum campo reconhecido/);
  });

  it("falha quando todos os campos vieram em branco", () => {
    const r = parseCadastroTexto(`${MARK_START}\nTIPO: Segurado\nNOME:\nPLACA: -\n${MARK_END}`);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Todos os campos vieram em branco/);
  });
});

import { isoFromBR, todayISO } from "./format";

// Cadastro de processo por texto (a pedido do usuário): o operador anexa no
// Claude Chat os documentos do sinistro aberto na seguradora (PDF, prints,
// e-mails), cola o prompt gerado aqui e o Claude devolve um bloco de texto
// "CHAVE: valor" — uma linha por campo. Este módulo gera esse prompt e lê o
// bloco de volta. O resultado vai como prefill pro módulo Abertura (mesmo
// caminho do importador de formulário comercial, ver
// logic/importFormularioComercial.js e pages/Abertura.jsx): o processo só é
// criado no clique manual de "Criar processo"; campo não identificado fica
// em branco pra preenchimento humano.

export const ORIGEM_CADASTRO_TEXTO = "sinistro360_cadastro_texto";
export const MARK_START = "-----SINISTRO360-CADASTRO-INICIO-----";
export const MARK_END = "-----SINISTRO360-CADASTRO-FIM-----";

// Ordem = ordem no prompt e na prévia. `key` é o nome que o módulo Abertura
// já entende em aberturaPrefill.importado; `label` é a chave escrita no
// texto; `catalogo` aponta a lista de opções que entra no prompt.
export const CAMPOS_CADASTRO_TEXTO = [
  { key: "tipoParte", label: "TIPO", titulo: "Tipo", tipo: "enum", hint: "Segurado, Terceiro ou Atendimento" },
  { key: "segurado", label: "NOME", titulo: "Nome do segurado/terceiro", hint: "nome completo do cliente do processo" },
  { key: "clienteDocumento", label: "CPF_CNPJ", titulo: "CPF/CNPJ", hint: "do cliente" },
  { key: "clienteTelefone", label: "TELEFONE", titulo: "Telefone", hint: "telefone/WhatsApp do cliente, com DDD" },
  { key: "clienteEmail", label: "EMAIL", titulo: "E-mail", hint: "e-mail do cliente" },
  { key: "clienteEndereco", label: "ENDERECO", titulo: "Endereço", hint: "endereço completo do cliente" },
  { key: "placa", label: "PLACA", titulo: "Placa" },
  { key: "veiculoMarca", label: "MARCA", titulo: "Marca", hint: "marca do veículo" },
  { key: "veiculoModelo", label: "MODELO", titulo: "Modelo", hint: "modelo do veículo" },
  { key: "veiculoAno", label: "ANO_MODELO", titulo: "Ano modelo" },
  { key: "cia", label: "SEGURADORA", titulo: "Seguradora", catalogo: "seguradoras" },
  { key: "numsin", label: "NUMERO_SINISTRO", titulo: "Nº do sinistro", hint: "número do sinistro na seguradora" },
  { key: "ramo", label: "RAMO", titulo: "Ramo", catalogo: "ramos" },
  { key: "numapo", label: "APOLICE", titulo: "Apólice", hint: "número da apólice" },
  { key: "numend", label: "ENDOSSO", titulo: "Endosso", hint: "número do endosso" },
  { key: "item", label: "ITEM", titulo: "Item", hint: "item da apólice" },
  { key: "datoco", label: "DATA_OCORRENCIA", titulo: "Data de ocorrência", tipo: "date", hint: "DD/MM/AAAA" },
  { key: "datavi", label: "DATA_AVISO", titulo: "Data de aviso", tipo: "date", hint: "DD/MM/AAAA, data em que o sinistro foi avisado/aberto na seguradora" },
  { key: "franquia", label: "FRANQUIA", titulo: "Franquia (R$)", tipo: "money", hint: "ex.: 2500,00" },
  { key: "valavi", label: "VALOR_AVALIADO", titulo: "Valor avaliado (R$)", tipo: "money", hint: "ex.: 18750,00" },
  { key: "oficina", label: "OFICINA", titulo: "Oficina/Prestador", catalogo: "oficinas" },
  { key: "agente", label: "AGENTE", titulo: "Agente", catalogo: "agentes" },
  { key: "produtor", label: "PRODUTOR", titulo: "Produtor", catalogo: "produtores" },
  { key: "responsavelSugerido", label: "RESPONSAVEL", titulo: "Responsável", catalogo: "responsaveis" },
  { key: "descricao", label: "DESCRICAO", titulo: "Descrição", tipo: "multiline", hint: "resumo objetivo do ocorrido" },
  { key: "observacoes", label: "OBSERVACOES", titulo: "Observações", tipo: "multiline", hint: "protocolo, analista da seguradora, prazos, pendências" },
];

// Outras grafias que o Claude (ou alguém digitando à mão) pode usar pra
// mesma chave — a leitura é tolerante pra não travar por um detalhe.
const ALIASES = {
  SEGURADO: "NOME", TERCEIRO: "NOME", CLIENTE: "NOME", NOME_DO_SEGURADO: "NOME", NOME_DO_CLIENTE: "NOME",
  CPF: "CPF_CNPJ", CNPJ: "CPF_CNPJ", DOCUMENTO: "CPF_CNPJ",
  FONE: "TELEFONE", CELULAR: "TELEFONE", WHATSAPP: "TELEFONE",
  E_MAIL: "EMAIL",
  ENDERECO_DO_CLIENTE: "ENDERECO",
  ANO: "ANO_MODELO", ANO_DO_MODELO: "ANO_MODELO",
  CIA: "SEGURADORA", COMPANHIA: "SEGURADORA",
  SINISTRO: "NUMERO_SINISTRO", N_SINISTRO: "NUMERO_SINISTRO", NUMERO_DO_SINISTRO: "NUMERO_SINISTRO", NO_SINISTRO: "NUMERO_SINISTRO",
  N_APOLICE: "APOLICE", NUMERO_DA_APOLICE: "APOLICE", NUMERO_APOLICE: "APOLICE",
  DATA_DA_OCORRENCIA: "DATA_OCORRENCIA", DATA_DO_SINISTRO: "DATA_OCORRENCIA", DATA_SINISTRO: "DATA_OCORRENCIA", DATA_OCORRENCIA_SINISTRO: "DATA_OCORRENCIA",
  DATA_DE_AVISO: "DATA_AVISO", DATA_DO_AVISO: "DATA_AVISO", DATA_ABERTURA: "DATA_AVISO", DATA_DE_ABERTURA: "DATA_AVISO",
  VALOR_FRANQUIA: "FRANQUIA",
  VALOR: "VALOR_AVALIADO", VALOR_ESTIMADO: "VALOR_AVALIADO", VALOR_DO_ORCAMENTO: "VALOR_AVALIADO", ORCAMENTO: "VALOR_AVALIADO",
  PRESTADOR: "OFICINA", OFICINA_PRESTADOR: "OFICINA",
  RESPONSAVEL_SUGERIDO: "RESPONSAVEL",
  OBS: "OBSERVACOES", OBSERVACAO: "OBSERVACOES",
};

const VAZIOS = new Set([
  "", "-", "--", "—", "–", "?", "N/I", "N/A", "NA", "NI", "NULL", "NONE", "NIL",
  "NAO IDENTIFICADO", "NAO IDENTIFICADA", "NAO INFORMADO", "NAO INFORMADA", "NAO CONSTA", "NAO LOCALIZADO",
  "SEM INFORMACAO", "EM BRANCO", "DESCONHECIDO", "INDISPONIVEL",
]);

function semAcento(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizarChave(s) {
  return semAcento(s).toUpperCase().trim().replace(/[\s\-./\\]+/g, "_").replace(/[^A-Z0-9_]/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

export function valorVazio(v) {
  const t = semAcento(v).trim().replace(/^[[(]|[\])]$/g, "").trim().toUpperCase();
  return VAZIOS.has(t);
}

const LABEL_PARA_CAMPO = {};
CAMPOS_CADASTRO_TEXTO.forEach((c) => { LABEL_PARA_CAMPO[c.label] = c; });
Object.keys(ALIASES).forEach((a) => { if (!LABEL_PARA_CAMPO[a]) LABEL_PARA_CAMPO[a] = LABEL_PARA_CAMPO[ALIASES[a]]; });

export function normalizarTipoParte(v) {
  const t = semAcento(v).trim().toUpperCase();
  if (!t) return "";
  if (t.startsWith("TERC")) return "Terceiro";
  if (t.startsWith("ATEND")) return "Atendimento";
  if (t.startsWith("SEG")) return "Segurado";
  return "";
}

export function normalizarDataBR(v) {
  const t = String(v || "").trim();
  if (!t) return "";
  const iso = isoFromBR(t);
  if (iso) return iso;
  const curto = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (curto) {
    let ano = curto[3];
    if (ano.length === 2) ano = "20" + ano;
    if (ano.length !== 4) return "";
    return `${ano}-${curto[2].padStart(2, "0")}-${curto[1].padStart(2, "0")}`;
  }
  return "";
}

// "R$ 1.234,56" → "1234.56"; "1500" → "1500"; "2.500" → "2500". Retorna ""
// quando não dá pra entender como número.
export function normalizarMoeda(v) {
  let t = String(v || "").trim().replace(/R\$\s*/gi, "").replace(/\s+/g, "");
  if (!t) return "";
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}(\.|$)/.test(t) && !/,/.test(t)) t = t.replace(/\./g, "");
  else t = t.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return "";
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : "";
}

function listaOuVazio(itens, vazio) {
  const arr = (itens || []).map((x) => String(x || "").trim()).filter(Boolean);
  return arr.length ? arr.join("; ") : vazio;
}

// Prompt pra colar no Claude Chat junto com os anexos. Inclui as opções já
// cadastradas no sistema pra o Claude devolver o nome exato (o módulo
// Abertura só casa Produtor/Responsável por igualdade; os demais caem em
// "+ Novo..." quando não batem).
export function gerarPromptCadastro(catalogos, instrucoesExtras) {
  const c = catalogos || {};
  const linhas = [];
  linhas.push("Você vai me ajudar a cadastrar um processo de sinistro no sistema Sinistro360 de uma corretora de seguros.");
  linhas.push("Vou anexar documentos sobre um sinistro já aberto na seguradora (PDF, prints de tela, e-mails). Leia tudo com atenção e devolva APENAS o bloco de resposta no formato indicado no fim, preenchido, sem comentários antes ou depois.");
  linhas.push("");
  linhas.push("REGRAS");
  linhas.push("1. Responda exatamente no formato abaixo: uma linha por campo, no padrão CHAVE: valor. Não renomeie, não reordene e não remova chaves.");
  linhas.push("2. Campo não identificado nos documentos fica em branco (nada depois dos dois-pontos). Nunca invente nem deduza além do que está escrito; é melhor deixar em branco do que errar.");
  linhas.push("3. Datas no formato DD/MM/AAAA. Valores em reais só com números e vírgula como decimal (ex.: 1500,00), sem R$.");
  linhas.push("4. Nos campos com lista de opções cadastradas, use EXATAMENTE um dos nomes da lista quando o documento apontar para ele, mesmo que o documento escreva de forma diferente (ex.: \"Porto\" para \"PORTO SEGURO\"). Se não houver correspondência clara, em SEGURADORA, RAMO, OFICINA e AGENTE escreva o nome como aparece no documento; em PRODUTOR e RESPONSAVEL deixe em branco.");
  linhas.push("5. TIPO: Segurado quando o cliente da corretora é o segurado da apólice; Terceiro quando o cliente é terceiro atingido por segurado de outra apólice; Atendimento só quando não há apólice envolvida. Na dúvida, Segurado.");
  linhas.push("6. PLACA sem espaços nem hífen. CPF_CNPJ e TELEFONE podem vir formatados.");
  linhas.push("7. DESCRICAO: resumo objetivo do ocorrido (o que, quando, onde, como) em até 5 linhas. OBSERVACOES: qualquer informação útil que não coube nos outros campos (nº de protocolo, nome do analista da seguradora, prazos, pendências, documentos solicitados).");
  linhas.push("8. Se os documentos trouxerem mais de um sinistro, use só o principal e cite os outros em OBSERVACOES.");
  if (instrucoesExtras && String(instrucoesExtras).trim()) {
    linhas.push("");
    linhas.push("INSTRUÇÕES ADICIONAIS DA CORRETORA");
    linhas.push(String(instrucoesExtras).trim());
  }
  linhas.push("");
  linhas.push("OPÇÕES CADASTRADAS NO SISTEMA");
  linhas.push("Seguradoras: " + listaOuVazio(c.seguradoras, "(nenhuma cadastrada — escreva como aparece no documento)"));
  linhas.push("Ramos: " + listaOuVazio(c.ramos, "(nenhum cadastrado — escreva como aparece no documento)"));
  linhas.push("Oficinas: " + listaOuVazio(c.oficinas, "(nenhuma cadastrada — escreva como aparece no documento)"));
  linhas.push("Agentes: " + listaOuVazio(c.agentes, "(nenhum cadastrado — escreva como aparece no documento)"));
  linhas.push("Produtores: " + listaOuVazio(c.produtores, "(nenhum cadastrado — deixe em branco)"));
  linhas.push("Responsáveis (usuários do sistema): " + listaOuVazio(c.responsaveis, "(nenhum cadastrado — deixe em branco)"));
  linhas.push("");
  linhas.push("SIGNIFICADO DOS CAMPOS");
  CAMPOS_CADASTRO_TEXTO.forEach((f) => {
    if (f.hint) linhas.push(`${f.label}: ${f.hint}`);
  });
  linhas.push("");
  linhas.push("FORMATO DE RESPOSTA (copie e preencha)");
  linhas.push(MARK_START);
  CAMPOS_CADASTRO_TEXTO.forEach((f) => linhas.push(f.label + ": "));
  linhas.push(MARK_END);
  return linhas.join("\n");
}

function recortarBloco(texto) {
  const t = String(texto || "").replace(/\r\n?/g, "\n");
  const i = t.indexOf(MARK_START);
  const j = t.indexOf(MARK_END);
  if (i >= 0 && j > i) return t.slice(i + MARK_START.length, j);
  if (i >= 0) return t.slice(i + MARK_START.length);
  if (j >= 0) return t.slice(0, j);
  return t;
}

// Lê o bloco devolvido pelo Claude. Tolerante: aceita o texto com ou sem os
// marcadores, chaves em qualquer caixa/acentuação, ":" ou "=" como
// separador, e linhas sem chave dentro de DESCRICAO/OBSERVACOES continuam o
// campo anterior. Retorna:
//   { ok, data, reconhecidos: [key], vazios: [key], avisos: [texto], ignorados: [linha] }
// `data` já está no formato que pages/Abertura.jsx espera em
// aberturaPrefill.importado.
export function parseCadastroTexto(texto) {
  const bloco = recortarBloco(texto);
  const bruto = {};
  const ignorados = [];
  let chaveMultilinha = null;

  bloco.split("\n").forEach((linhaOriginal) => {
    // Tira marcadores de lista e negrito markdown que o chat às vezes
    // acrescenta ("- **NOME:** Fulano") antes de procurar a chave.
    const linha = linhaOriginal.replace(/^\s*[-*•]\s+/, "").replace(/\*\*/g, "");
    if (!linha.trim()) return;
    if (/^`{3}/.test(linha.trim())) return;
    const m = linha.match(/^\s*([A-Za-zÀ-ú][A-Za-zÀ-ú0-9_ /.\\-]{0,40}?)\s*[:=]\s*(.*)$/);
    const campo = m ? LABEL_PARA_CAMPO[normalizarChave(m[1])] : null;
    if (campo) {
      bruto[campo.key] = m[2].trim();
      chaveMultilinha = campo.tipo === "multiline" ? campo.key : null;
      return;
    }
    if (chaveMultilinha) {
      bruto[chaveMultilinha] = ((bruto[chaveMultilinha] || "") + "\n" + linha.trim()).trim();
      return;
    }
    ignorados.push(linha.trim());
  });

  const data = { _origem: ORIGEM_CADASTRO_TEXTO, _versao: 1, _geradoEm: new Date().toISOString() };
  const reconhecidos = [];
  const vazios = [];
  const avisos = [];

  CAMPOS_CADASTRO_TEXTO.forEach((f) => {
    let v = Object.prototype.hasOwnProperty.call(bruto, f.key) ? bruto[f.key] : "";
    if (valorVazio(v)) v = "";
    if (v && f.tipo === "enum") {
      const n = normalizarTipoParte(v);
      if (!n) avisos.push(`${f.titulo}: "${v}" não é Segurado, Terceiro ou Atendimento — ficou como Segurado.`);
      v = n || "Segurado";
    } else if (v && f.tipo === "date") {
      const n = normalizarDataBR(v);
      if (!n) avisos.push(`${f.titulo}: "${v}" não foi reconhecida como data — ficou em branco.`);
      v = n;
    } else if (v && f.tipo === "money") {
      const n = normalizarMoeda(v);
      if (!n) avisos.push(`${f.titulo}: "${v}" não foi reconhecido como valor — ficou em branco.`);
      v = n;
    } else if (v && f.key === "placa") {
      v = v.toUpperCase().replace(/[\s-]+/g, "");
    }
    data[f.key] = v;
    if (v) reconhecidos.push(f.key); else vazios.push(f.key);
  });

  if (!data.tipoParte) data.tipoParte = "Segurado";
  if (!data.datavi) data.datavi = todayISO();

  // Contato do cliente no formato do cadastro de Clientes (CadastroPanel):
  // telefone/e-mail viram um contato com o próprio nome do cliente.
  const telefone = data.clienteTelefone || "";
  const email = data.clienteEmail || "";
  data.clienteContatos = telefone || email ? [{ nome: data.segurado || "", telefone, email, cargo: "" }] : [];
  delete data.clienteTelefone;
  delete data.clienteEmail;

  const preenchidosReais = reconhecidos.filter((k) => k !== "tipoParte");
  if (!preenchidosReais.length) {
    return {
      ok: false,
      error: !Object.keys(bruto).length
        ? "Nenhum campo reconhecido no texto. Confira se colou a resposta inteira do Claude, no formato CHAVE: valor (uma linha por campo)."
        : "Todos os campos vieram em branco. Confira se os anexos no Claude continham os dados do sinistro.",
      data: null, reconhecidos: [], vazios, avisos, ignorados,
    };
  }
  return { ok: true, data, reconhecidos, vazios, avisos, ignorados };
}

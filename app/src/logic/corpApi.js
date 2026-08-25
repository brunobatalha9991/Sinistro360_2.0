import { isoFromBR, uid } from "./format";
import { partyTypeFromTipo, isManualClaim, ensureRamoTemplateInto } from "./claims";

// Porte 1:1 do CorpAPI/mapCorp/syncAll do HTML original. O token de sessão
// da API CORP (diferente do login do Sinistro360) fica só neste navegador —
// não é uma das CONFIG_KEYS sincronizadas, igual ao original.
const TOKEN_KEY = "corp_token";
export function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } }
export function setToken(t) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

function apiBase(cfg) {
  let u = (cfg.url || "").trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//.test(u)) u = "https://" + u;
  return u;
}
function request(cfg, path, opts) {
  opts = opts || {};
  const h = {};
  if (opts.body) h["Content-Type"] = "application/json";
  if (opts.auth !== false) { const t = getToken(); if (t) h["Authorization"] = t; }
  return fetch(apiBase(cfg) + path, { method: opts.method || "GET", headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
    .then((r) => r.text().then((txt) => {
      let d; try { d = JSON.parse(txt); } catch { d = txt; }
      if (!r.ok) { const m = (d && (d.message || d.mensagem)) || `HTTP ${r.status}`; const er = new Error(m); er.status = r.status; er.data = d; throw er; }
      return d;
    }));
}
function login(cfg) {
  return request(cfg, "/login", { method: "POST", auth: false, body: { email: cfg.email, senha: cfg.senha, aplicacao: Number(cfg.aplicacao || 0) } })
    .then((resp) => {
      const tk = resp && (resp.token || resp.access_token || (resp.dados && resp.dados.token) || (resp.data && resp.data.token));
      if (!tk) throw new Error("Login sem token na resposta.");
      setToken(tk);
      return tk;
    });
}
function withAuth(cfg, fn) {
  if (!getToken()) return login(cfg).then(fn);
  return fn().catch((e) => { if (e.status === 401) { setToken(""); return login(cfg).then(fn); } throw e; });
}
function fetchSinistros(cfg, params) {
  params = params || {};
  const def = { tipo_sinistro: "S", tipo_data: "OCO", situacao: "T", qtd_pag: 100, pagina: 1 };
  if (!params.data_inicial || !params.data_final) {
    const hj = new Date(), ini = new Date(); ini.setFullYear(hj.getFullYear() - 1);
    const br = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    def.data_inicial = br(ini); def.data_final = br(hj);
  }
  Object.assign(def, params);
  const qs = Object.keys(def).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(def[k])).join("&");
  return withAuth(cfg, () => request(cfg, "/sinistros?" + qs, { method: "GET" }));
}
export function testConnection(cfg) { setToken(""); return login(cfg).then(() => true); }

// Busca CLIENTE direto no CORP (GET /clientes?texto=), sem depender de
// nenhum sinistro — a pedido do usuário: a consulta anterior (via
// /sinistros) só encontrava quem já tinha processo. Exige pelo menos 4
// caracteres em `texto` (regra do próprio CORP); devolve nome, CPF/CNPJ,
// e-mail, telefone, cidade/UF, ativo/vigente — já no resultado da busca,
// sem precisar de uma segunda chamada.
export function buscarClientes(cfg, { texto, qtdPag, pag, vigentes } = {}) {
  const params = { texto: String(texto || "").trim() };
  if (qtdPag) params.qtd_pag = qtdPag;
  if (pag) params.pag = pag;
  if (vigentes) params.vigentes = vigentes;
  const qs = Object.keys(params).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k])).join("&");
  return withAuth(cfg, () => request(cfg, "/clientes?" + qs, { method: "GET" }))
    .then((resp) => (resp && resp.clientes) || [])
    .catch((e) => { if (e.status === 404) return []; throw e; });
}

// Detalhe completo de 1 cliente (GET /cliente?codfil=&codigo=) — endereços,
// múltiplos telefones/e-mails/contatos. `codfil`/`codigo` vêm do resultado
// de buscarClientes.
export function buscarClienteDetalhado(cfg, codfil, codigo) {
  const qs = `codfil=${encodeURIComponent(codfil)}&codigo=${encodeURIComponent(codigo)}`;
  return withAuth(cfg, () => request(cfg, "/cliente?" + qs, { method: "GET" }))
    .then((resp) => (resp && Array.isArray(resp.cliente) && resp.cliente[0]) || null)
    .catch((e) => { if (e.status === 404) return null; throw e; });
}

// Documentos/apólices vinculados a um cliente (GET /cliente_ligacoes?codigo=)
// — a pedido do usuário: achar a apólice de um cliente sem precisar já ter
// um sinistro aqui. Devolve os mesmos campos de fetchDocumento (seguradora,
// ramo, vigência, parcelas, numapo...), um item por documento vinculado ao
// cliente — mas SEM a URL assinada do PDF (essa só vem de fetchDocumento/
// extractUrlApolice, chamado à parte pra cada `codfil`+`nosnum` daqui).
export function buscarLigacoesCliente(cfg, codigo) {
  const qs = `codigo=${encodeURIComponent(codigo)}`;
  return withAuth(cfg, () => request(cfg, "/cliente_ligacoes?" + qs, { method: "GET" }))
    .then((resp) => (resp && Array.isArray(resp.documento) && resp.documento) || [])
    .catch((e) => { if (e.status === 404) return []; throw e; });
}

// Consulta AO VIVO no CORP por nome/placa, sem gravar nada aqui (a pedido
// do usuário: trazer a base inteira de clientes pra sincronizar ficaria
// pesado sem necessidade — a maior parte nunca seria usada; melhor buscar
// só quando precisar). Não existe endpoint de busca por texto livre
// documentado no CORP, e a 1ª tentativa (mandar `segurado`/`placa` como
// parâmetro extra) quebrou com "Internal Server Error" — a API não aceita
// parâmetro que não conhece. Por segurança, reaproveita só os MESMOS
// parâmetros já comprovadamente aceitos pela sincronização normal (ver
// syncAll) e filtra o nome/placa aqui no navegador. `dataInicial`/
// `dataFinal` vazios são omitidos (nunca manda data em branco pro CORP —
// outra causa possível de erro de servidor) e caem no padrão de 1 ano do
// próprio fetchSinistros. Busca só a 1ª página de cada tipo (S/A/T) — é uma
// consulta pontual, não uma sincronização.
export function consultarCorp(cfg, { termo, dataInicial, dataFinal }) {
  const TIPOS = ["S", "A", "T"];
  const paramsBase = { qtd_pag: 100, pagina: 1 };
  if (dataInicial) paramsBase.data_inicial = dataInicial;
  if (dataFinal) paramsBase.data_final = dataFinal;
  const buscas = TIPOS.map((tipo) => fetchSinistros(cfg, { ...paramsBase, tipo_sinistro: tipo })
    .then((resp) => (Array.isArray(resp) ? resp : ((resp && (resp.sinistros || resp.sinistro || resp.dados || resp.data || resp.itens || resp.registros)) || []))));
  return Promise.all(buscas).then((paginas) => {
    const q = String(termo || "").trim().toLowerCase();
    const todos = paginas.flat();
    const filtrados = q
      ? todos.filter((r) => String(r.segurado || "").toLowerCase().indexOf(q) >= 0 || String(r.placa || "").toLowerCase().indexOf(q) >= 0)
      : todos;
    // Dedup — o mesmo registro pode repetir entre as 3 buscas por tipo.
    const seen = new Set(); const out = [];
    filtrados.forEach((r) => {
      const chave = `${r.codfil}|${r.nosnum}|${r.tipo}`;
      if (!seen.has(chave)) { seen.add(chave); out.push(r); }
    });
    return out;
  });
}

// GET /documento?codfil=&nosnum= — endpoint separado do CORP (não é o mesmo
// de /sinistros) que traz, entre outras coisas, a lista de agente/produtor
// vinculada ao documento (apólice/proposta), em body.documento[0].prod_docs.
// "nosnum" é a chave universal do CORP — o mesmo valor já usado pra
// identificar o sinistro/processo serve pra buscar aqui.
export function fetchDocumento(cfg, codfil, nosnum) {
  const qs = `codfil=${encodeURIComponent(codfil)}&nosnum=${encodeURIComponent(nosnum)}`;
  return withAuth(cfg, () => request(cfg, "/documento?" + qs, { method: "GET" }));
}
// Extrai a lista de {agente, produtor} da resposta de fetchDocumento — pura,
// tolerante a formato inesperado/ausente (nunca lança, sempre devolve array).
export function extractProdDocs(resp) {
  const doc = resp && Array.isArray(resp.documento) && resp.documento[0];
  return (doc && Array.isArray(doc.prod_docs) && doc.prod_docs) || [];
}
// Idem, pra body.acompanhamento.emissao.url_apolice (link assinado do PDF
// da apólice no S3) — mesma resposta de fetchDocumento, campo diferente.
export function extractUrlApolice(resp) {
  return (resp && resp.acompanhamento && resp.acompanhamento.emissao && resp.acompanhamento.emissao.url_apolice) || "";
}

// Achata 1 objeto de documento cru (documento[0] de fetchDocumento, OU
// qualquer item de buscarLigacoesCliente — mesmo formato) num resumo fácil
// de exibir. Extraída à parte (a pedido do usuário: "carrega esses dados na
// busca pelo cliente") pra poder ser reaproveitada sem precisar de uma nova
// chamada — /cliente_ligacoes já devolve praticamente tudo isso de graça,
// só falta a URL assinada do PDF (que vem só de fetchDocumento/
// extractUrlApolice, não está disponível em /cliente_ligacoes).
function mapearDocumento(doc) {
  if (!doc) return null;
  return {
    codfil: doc.codfil, nosnum: doc.nosnum,
    seguradora: doc.seguradora || "",
    ramo: doc.ramo || "",
    numeroApolice: doc.numapo || "",
    numeroEndosso: doc.numend || "",
    numeroProposta: doc.numprop || "",
    vigenciaInicio: doc.inivig || "",
    vigenciaFim: doc.fimvig || "",
    valorTotal: doc.pretot != null ? Number(doc.pretot) : null,
    formaPagamento: doc.forma_pag || "",
    numeroParcelas: doc.numpar != null ? Number(doc.numpar) : null,
    situacaoAcompanhamento: doc.sit_acompanhamento_txt || "",
    situacaoSinistro: doc.sit_sinistro_txt || "",
    situacaoRenovacao: doc.sit_renovacao_txt || "",
    cliente: doc.cliente || "",
    parcelas: (doc.parcelas || []).map((p) => ({
      numero: p.parc, vencimento: p.datvenc, valor: p.vlvenc, quitadoEm: p.datquit || null,
    })),
    prodDocs: (doc.prod_docs || []).map((p) => ({ agente: p.agente, produtor: p.produtor })),
  };
}

// Documentos vinculados a um cliente (resultado de buscarLigacoesCliente),
// já no mesmo formato rico de extractDocumentoDetalhado — sem URL de PDF
// (isso exige uma chamada extra por documento, ver fetchDocumento).
export function mapearLigacoesCliente(docs) {
  return (docs || []).map(mapearDocumento).filter(Boolean);
}

// Resumo completo da resposta de fetchDocumento (a pedido do usuário: "traga
// o máximo de informação possível sobre o processo consultado") — achata os
// campos espalhados em documento[0]/acompanhamento num objeto único, fácil
// de exibir. Pura/tolerante: nunca lança, devolve null sem documento algum.
export function extractDocumentoDetalhado(resp) {
  const doc = resp && Array.isArray(resp.documento) && resp.documento[0];
  const base = mapearDocumento(doc);
  if (!base) return null;
  const acomp = resp.acompanhamento || {};
  return {
    ...base,
    urlApolice: (acomp.emissao && acomp.emissao.url_apolice) || "",
    urlProposta: (acomp.proposta && acomp.proposta.url_proposta) || "",
  };
}

// Resumo persistível da resposta de fetchDocumento — o que fica guardado em
// overrides[claimId].agenteProdutor (ver useOverrideActions.saveAgenteProdutor
// e useDocumentoCorp), usado pra filtrar Sinistros e pro vínculo de acesso
// de usuários "Consulta" por agente/produtor.
export function normalizeAgenteProdutorSnapshot(resp) {
  const prodDocs = extractProdDocs(resp);
  const agentes = []; const produtores = [];
  const seenA = {}; const seenP = {};
  prodDocs.forEach((p) => {
    if (p.agente && !seenA[p.agente]) { seenA[p.agente] = true; agentes.push(p.agente); }
    if (p.produtor && !seenP[p.produtor]) { seenP[p.produtor] = true; produtores.push(p.produtor); }
  });
  return { agentes, produtores, prodDocs, urlApolice: extractUrlApolice(resp), atualizadoEm: new Date().toISOString() };
}

export function mapCorp(c) {
  return {
    id: "clm_" + (c.codfil || "0") + "_" + String(c.tipo || "?").charAt(0).toUpperCase() + "_" + (c.nosnum || uid("")),
    codfil: c.codfil, nosnum: c.nosnum, numsin: c.numsin || "", tipo: c.tipo || "", codigo: c.codigo,
    partyType: partyTypeFromTipo(c.tipo),
    linkKey: String(c.codfil || "") + "|" + String(c.nosnum || ""),
    segurado: c.segurado || "", cia: c.cia || "", ramo: c.ramo || "", numapo: c.numapo || "", numend: c.numend || "", item: c.item,
    placa: c.placa || "", situacao: c.situacao || "", franquia: Number(c.franquia) || 0, valavi: Number(c.valavi) || 0, valind: Number(c.valind) || 0, valdes: Number(c.valdes) || 0,
    datavi: isoFromBR(c.datavi), datoco: isoFromBR(c.datoco), datenc: isoFromBR(c.datenc), datvis: isoFromBR(c.datvis), datlib: isoFromBR(c.datlib),
    proxima_agenda: isoFromBR(c.proxima_agenda), agendamento: isoFromBR(c.agendamento),
    responsavel: c.responsavel || "", oficina: c.oficina ? String(c.oficina).trim() : "", tipo_atendimento: c.tipo_atendimento || "", descricao: c.descricao || "", observacoes: c.observacoes || "",
    _raw: c,
  };
}

// Porte 1:1 de syncAll(): busca S/A/T no período, preserva processos manuais,
// substitui os vindos da API. `templates` + `saveTemplatesConfig` garantem
// que todo ramo novo já ganhe o template padrão (ensureRamoTemplate).
export function syncAll(cfg, allClaimsRaw, templates, saveTemplatesConfig, saveClaimsRecord, opts) {
  opts = opts || {};
  let novos = 0, atualizados = 0;
  // byId acumula só os registros vindos da API nesta sincronização. Os
  // manuais são lidos de novo (frescos) só no fechamento — o fetch pode
  // levar vários segundos, tempo em que outro usuário pode ter criado um
  // processo manual (Abertura) que não pode ser perdido pela gravação final.
  const byId = {};
  const apiAntes = allClaimsRaw.filter((c) => !isManualClaim(c)).length;
  const isoIni = opts.data_inicial ? isoFromBR(opts.data_inicial) : "";
  const isoFim = opts.data_final ? isoFromBR(opts.data_final) : "";
  const TIPOS = ["S", "A", "T"];
  let templatesDraft = templates;

  function ensureTpl(ramo) {
    if (!ramo) return;
    const next = ensureRamoTemplateInto(templatesDraft, ramo);
    if (next !== templatesDraft) templatesDraft = next;
  }

  function pagina(ti, p) {
    const params = { tipo_sinistro: TIPOS[ti], pagina: p };
    if (opts.data_inicial) params.data_inicial = opts.data_inicial;
    if (opts.data_final) params.data_final = opts.data_final;
    return fetchSinistros(cfg, params).then((resp) => {
      const arr = Array.isArray(resp) ? resp : ((resp && (resp.sinistros || resp.sinistro || resp.dados || resp.data || resp.itens || resp.registros)) || []);
      arr.forEach((raw) => {
        const m = mapCorp(raw);
        if (isoIni && m.datoco && m.datoco < isoIni) return;
        if (isoFim && m.datoco && m.datoco > isoFim) return;
        ensureTpl(m.ramo);
        // Mais de um processo pode compartilhar o mesmo codfil+tipo+nosnum
        // (ex.: dois Terceiros, ou dois Atendimentos, no mesmo "nosnum") —
        // sem isso, o id calculado colidia e o segundo sobrescrevia o
        // primeiro silenciosamente. Só tratamos como o MESMO processo (e
        // sobrescrevemos) quando o "codigo"/"item" da API bate; quando os
        // dois lados têm um valor e ele é diferente, é um processo à parte
        // e ganha um id próprio — sem afetar o id dos demais processos.
        const existing = byId[m.id];
        if (existing) {
          const chaveExistente = String(existing.codigo || existing.item || "");
          const chaveNova = String(m.codigo || m.item || "");
          if (chaveExistente && chaveNova && chaveExistente !== chaveNova) {
            m.id = m.id + "_" + chaveNova;
          }
        }
        if (byId[m.id]) atualizados++; else novos++;
        byId[m.id] = m;
      });
      if (arr.length >= 100 && p < 100) return pagina(ti, p + 1);
      return tipoLoop(ti + 1);
    });
  }
  function tipoLoop(ti) {
    if (ti >= TIPOS.length) {
      if (templatesDraft !== templates) saveTemplatesConfig(templatesDraft);
      let result;
      saveClaimsRecord((currentClaims) => {
        const merged = {};
        (currentClaims || []).forEach((c) => { if (isManualClaim(c)) merged[c.id] = c; });
        Object.assign(merged, byId);
        const finalClaims = Object.values(merged);
        const descartados = Math.max(0, apiAntes - atualizados);
        result = { total: finalClaims.length, novos, atualizados, descartados };
        return finalClaims;
      });
      return Promise.resolve(result);
    }
    return pagina(ti, 1);
  }
  return tipoLoop(0);
}

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

// Porte 1:1 das regras de negócio do HTML original. As funções recebem os
// dados como parâmetro (records/overrides/templates vindos do useData()) em
// vez de ler localStorage diretamente — mesmo comportamento, fonte explícita.
import { mapSituacao } from "./situacao";
import { diasEntre, mediaArr } from "./format";

export const STATUS_DEFAULT = ["Aguardando", "Em andamento", "Concluído"];
const CONCLUSAO_STATUS = ["Aguardando", "Indenizado", "Sem Indenização"];

export function defaultRamoTemplate() {
  return {
    comuns: [{ id: "vistoria", title: "Vistoria", statusOptions: [...STATUS_DEFAULT] }],
    parcial: [
      { id: "rep_autorizados", title: "Reparos autorizados", statusOptions: [...STATUS_DEFAULT] },
      { id: "pecas", title: "Peças", statusOptions: [...STATUS_DEFAULT] },
      { id: "reparo", title: "Reparo", statusOptions: [...STATUS_DEFAULT] },
      { id: "conclusao", title: "Conclusão", statusOptions: [...CONCLUSAO_STATUS] },
    ],
    integral: [
      { id: "documentacao", title: "Documentação", statusOptions: [...STATUS_DEFAULT] },
      { id: "transf", title: "Transf. do veículo", statusOptions: [...STATUS_DEFAULT] },
      { id: "analise_final", title: "Análise final", statusOptions: [...STATUS_DEFAULT] },
      { id: "conclusao", title: "Conclusão", statusOptions: [...CONCLUSAO_STATUS] },
    ],
  };
}
export function defaultAtendTemplate() {
  return {
    steps: [
      { id: "at_inicial", title: "Atendimento inicial", statusOptions: [...STATUS_DEFAULT] },
      { id: "at_encaminhamento", title: "Encaminhamento", statusOptions: [...STATUS_DEFAULT] },
      { id: "at_conclusao", title: "Conclusão", statusOptions: [...STATUS_DEFAULT] },
    ],
  };
}

export function getRamoTemplate(templates, ramo) {
  return (templates && templates[ramo]) || defaultRamoTemplate();
}
// As etapas "comuns" (antes da definição do caminho Perda Parcial/Integral —
// inclui a Vistoria, mas ela não é mais fixa: pode ser reordenada, e outras
// etapas podem ser criadas antes ou depois dela) ficam em tpl.comuns, uma
// lista comum como parcial/integral. Ramos salvos antes dessa mudança só
// tinham tpl.vistoriaStatus (status da Vistoria fixa em 1º lugar) — esta
// função lê os dois formatos, sem precisar migrar nada gravado no Firestore.
export function getComunsSteps(tpl) {
  if (tpl && Array.isArray(tpl.comuns)) return tpl.comuns;
  return [{ id: "vistoria", title: "Vistoria", statusOptions: (tpl && tpl.vistoriaStatus) || [...STATUS_DEFAULT] }];
}
// Porte 1:1 de ensureRamoTemplate() do HTML original, mas puro: devolve um
// NOVO objeto de templates com o ramo garantido (template padrão + etapas
// comuns), ou o MESMO objeto (por referência) se já não faltava nada —
// assim quem chama sabe se precisa salvar ou não.
export function ensureRamoTemplateInto(templates, ramo) {
  if (!ramo) return templates;
  const t = templates || {};
  if (t[ramo] && Array.isArray(t[ramo].comuns)) return t;
  const existing = t[ramo] || defaultRamoTemplate();
  const withComuns = { ...existing, comuns: getComunsSteps(existing) };
  return { ...t, [ramo]: withComuns };
}
export function getAtendTemplate(atendTemplateCfg) {
  return atendTemplateCfg && atendTemplateCfg.steps && atendTemplateCfg.steps.length
    ? atendTemplateCfg
    : defaultAtendTemplate();
}
export function isAtendimento(c) { return !!(c && c.partyType === "Aviso"); }
export function isManualClaim(c) { return !!(c && c.origem === "manual"); }

// Porte 1:1 de partyTypeFromTipo() do HTML original.
export function partyTypeFromTipo(tipo) {
  const t = String(tipo || "").toUpperCase();
  if (t.indexOf("TERCEIRO") >= 0) return "Terceiro";
  if (t.indexOf("ATENDIMENTO") >= 0) return "Aviso";
  return "Segurado";
}

export function getOvr(overrides, id) { return (overrides && overrides[id]) || {}; }
export function campoEfetivo(overrides, c, campo) {
  if (!c) return "";
  const ov = getOvr(overrides, c.id).campos || {};
  if (ov[campo] != null && String(ov[campo]).trim() !== "") return ov[campo];
  return c[campo];
}
export function getUserJourney(overrides, claimId) {
  const ovr = getOvr(overrides, claimId);
  return ovr.journeyUser || { caminho: "", steps: {} };
}
export function getNextAction(overrides, claimId) { return getOvr(overrides, claimId).nextAction || null; }
export function getResponsavel(overrides, claimId) { return getOvr(overrides, claimId).responsavelUser || null; }
export function getSitAtend(overrides, claimId) { return getOvr(overrides, claimId).sitAtend || ""; }
export function getTemp(overrides, claimId) { return getOvr(overrides, claimId).temperatura || ""; }
export function loadComms(overrides, claimId) { return getOvr(overrides, claimId).comms || []; }
export function getManualLinks(overrides, claimId) { return getOvr(overrides, claimId).links || []; }
export function getFinance(overrides, claimId) { return getOvr(overrides, claimId).finance || {}; }
export function loadAudit(overrides, claimId) { return getOvr(overrides, claimId).audit || []; }
export function getJourneyNotes(overrides, claimId) { return getOvr(overrides, claimId).journeyNotes || ""; }
export function campoFoiEditado(overrides, c, campo) {
  const ov = getOvr(overrides, c.id).campos || {};
  return !!(ov[campo] != null && String(ov[campo]).trim() !== "");
}

// Porte 1:1 de tempColor() do HTML original.
export function tempColor(t) {
  t = String(t || "").toLowerCase();
  if (t.indexOf("grave") >= 0) return "red";
  if (t.indexOf("moder") >= 0) return "orange";
  if (t.indexOf("aten") >= 0) return "amber";
  if (t.indexOf("tranq") >= 0) return "green";
  return "gray";
}

function journeyTouched(uj) {
  if (!uj) return false;
  if (uj.caminho) return true;
  const steps = uj.steps || {};
  for (const k in steps) {
    const s = steps[k] || {};
    if ((s.status && String(s.status).trim() !== "") || (s.date && String(s.date).trim() !== "") || (s.note && String(s.note).trim() !== "")) return true;
  }
  return false;
}
function conclusaoStatus(uj) {
  const steps = (uj && uj.steps) || {};
  return String((steps["conclusao"] || {}).status || "");
}
// Acha o status de uma etapa pelo TÍTULO (não pelo id) — usado pra Atendimento,
// onde a etapa pode estar em qualquer lugar da jornada (etapas fixas ou dentro
// da trilha de um "caminho por tipo"). Depende do título ter sido gravado
// junto do status (setStepField em JourneyPanel.jsx).
function findStepStatusByTitle(uj, title) {
  const steps = (uj && uj.steps) || {};
  for (const k in steps) {
    const s = steps[k] || {};
    if (s.title === title && s.status) return String(s.status);
  }
  return "";
}
export function situacaoEfetiva(overrides, c) {
  const uj = getUserJourney(overrides, c.id) || {};
  if (!journeyTouched(uj)) return mapSituacao(c.situacao);
  if (isAtendimento(c)) {
    const encerramento = findStepStatusByTitle(uj, "Encerramento").toLowerCase();
    if (encerramento.indexOf("sem indeniz") >= 0) return { label: "Encerrado sem Indenização", cls: "gray" };
    if (encerramento.indexOf("indeniz") >= 0) return { label: "Indenizado", cls: "green" };
    const statusAssist = findStepStatusByTitle(uj, "Status da assistência").toLowerCase();
    if (statusAssist.indexOf("cancel") >= 0) return { label: "Encerrado sem Indenização", cls: "gray" };
    if (statusAssist.indexOf("conclu") >= 0) return { label: "Indenizado", cls: "green" };
    if (statusAssist.indexOf("andamento") >= 0) return { label: "Em andamento", cls: "amber" };
    return { label: "Pendente", cls: "amber" };
  }
  if (!uj.caminho) return { label: "Pendente", cls: "amber" };
  const cs = conclusaoStatus(uj).toLowerCase();
  if (cs.indexOf("sem indeniz") >= 0) return { label: "Encerrado sem Indenização", cls: "gray" };
  if (cs.indexOf("indeniz") >= 0) return { label: "Indenizado", cls: "green" };
  return { label: "Em andamento", cls: "amber" };
}
export function isFinalizado(overrides, c) {
  const s = situacaoEfetiva(overrides, c).label;
  return s === "Indenizado" || s === "Encerrado sem Indenização";
}
export function isAtrasado(overrides, c) {
  const na = getNextAction(overrides, c.id);
  if (!na || !na.date) return false;
  return na.date < new Date().toISOString().slice(0, 10);
}
export function isSemAtualizacao(overrides, c) {
  if (isFinalizado(overrides, c)) return false;
  const comms = loadComms(overrides, c.id);
  if (!comms.length) return true;
  const ultimo = comms[comms.length - 1];
  const d = ultimo.date || (ultimo.at ? String(ultimo.at).slice(0, 10) : "");
  if (!d) return true;
  const lim = new Date();
  lim.setDate(lim.getDate() - 3);
  return d < lim.toISOString().slice(0, 10);
}

// isConstatacaoSemIndeniz: processos "Encerrado sem Indenização" cuja oficina
// seja "01-CONSTATAÇÃO" não entram em nenhuma listagem/filtro (só acessíveis
// pelos vínculos com os terceiros) — mesma regra do original.
export function isConstatacaoSemIndeniz(c) {
  if (!c) return false;
  const of = String(c.oficina || "").trim().toUpperCase();
  if (of !== "01-CONSTATAÇÃO") return false;
  return String(c.situacao || "").toUpperCase().indexOf("SEM IND") >= 0;
}
export function visibleClaims(allClaims) {
  return (allClaims || []).filter((c) => !isConstatacaoSemIndeniz(c));
}

export function relatedClaims(overrides, allClaimsRaw, c) {
  const ids = getManualLinks(overrides, c.id);
  return (allClaimsRaw || []).filter((x) => {
    if (x.id === c.id) return false;
    const auto = c.linkKey && x.linkKey === c.linkKey;
    const manual = ids.indexOf(x.id) >= 0;
    return auto || manual;
  });
}

export function allJourneyStages(templates, atendTemplateCfg) {
  const seen = {};
  const out = [];
  function add(name) { if (name && !seen[name]) { seen[name] = true; out.push(name); } }
  Object.keys(templates || {}).forEach((ramo) => {
    const t = templates[ramo] || {};
    getComunsSteps(t).forEach((s) => add(s.title));
  });
  add("Definir caminho");
  Object.keys(templates || {}).forEach((ramo) => {
    const t = templates[ramo] || {};
    (t.parcial || []).forEach((s) => add(s.title));
    (t.integral || []).forEach((s) => add(s.title));
  });
  (getAtendTemplate(atendTemplateCfg).steps || []).forEach((s) => {
    add(s.title);
    if (s.branch) Object.values(s.branches || {}).forEach((trilha) => (trilha || []).forEach((t) => add(t.title)));
  });
  return out;
}

export function currentStage(overrides, templates, atendTemplateCfg, c) {
  const sit = situacaoEfetiva(overrides, c).label;
  if (sit === "Indenizado" || sit === "Encerrado sem Indenização") return "";
  const uj = getUserJourney(overrides, c.id) || {};
  const steps = uj.steps || {};

  if (isAtendimento(c)) {
    const listaAt = getAtendTemplate(atendTemplateCfg).steps || [];
    for (let j = 0; j < listaAt.length; j++) {
      const stepAt = listaAt[j];
      const sdAt = steps[stepAt.id] || {};
      if (stepAt.branch) {
        const tipo = sdAt.status || "";
        if (!tipo) return stepAt.title;
        const trilha = (stepAt.branches && stepAt.branches[tipo]) || [];
        for (let n = 0; n < trilha.length; n++) {
          const sdT = steps[trilha[n].id] || {};
          if (!(String(sdT.status || "").toLowerCase().indexOf("conclu") >= 0)) return trilha[n].title;
        }
        return trilha.length ? trilha[trilha.length - 1].title : stepAt.title;
      }
      const doneAt = String(sdAt.status || "").toLowerCase().indexOf("conclu") >= 0;
      if (!doneAt) return stepAt.title;
    }
    if (!uj.caminho) return "Definir caminho";
    const tplAt = getRamoTemplate(templates, c.ramo);
    const listaCam = uj.caminho === "parcial" ? (tplAt.parcial || []) : uj.caminho === "integral" ? (tplAt.integral || []) : [];
    for (let k = 0; k < listaCam.length; k++) {
      const sdC = steps[listaCam[k].id] || {};
      if (!(String(sdC.status || "").toLowerCase().indexOf("conclu") >= 0)) return listaCam[k].title;
    }
    return listaCam.length ? listaCam[listaCam.length - 1].title : "Definir caminho";
  }

  const tpl = getRamoTemplate(templates, c.ramo);
  const comuns = getComunsSteps(tpl);
  for (let m = 0; m < comuns.length; m++) {
    const sdC = steps[comuns[m].id] || {};
    if (!(String(sdC.status || "").toLowerCase().indexOf("conclu") >= 0)) return comuns[m].title;
  }
  if (!uj.caminho) return "Definir caminho";
  const lista = uj.caminho === "parcial" ? (tpl.parcial || []) : uj.caminho === "integral" ? (tpl.integral || []) : [];
  for (let i = 0; i < lista.length; i++) {
    const sd = steps[lista[i].id] || {};
    const done = String(sd.status || "").toLowerCase().indexOf("conclu") >= 0;
    if (!done) return lista[i].title;
  }
  return lista.length ? lista[lista.length - 1].title : "Definir caminho";
}

export function last12Months() {
  const out = [];
  const base = new Date();
  base.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const x = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push(x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"));
  }
  return out;
}
export function distinctComputed(rows, fn) {
  const seen = {};
  const out = [];
  rows.forEach((c) => { const v = fn(c); if (v && !seen[v]) { seen[v] = true; out.push(v); } });
  return out.sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

const CIA_GRUPO_PORT = ["AZUL", "ITAU", "MITSI"];
export function dashCiaLabel(overrides, cia) {
  if (cia && typeof cia === "object") cia = campoEfetivo(overrides, cia, "cia");
  const v = String(cia || "").trim().toUpperCase();
  return CIA_GRUPO_PORT.indexOf(v) >= 0 ? "PORT" : cia || "";
}
const OFICINA_IGNORADA = "01-CONSTATAÇÃO";
export function dashOficinaKey(overrides, oficina) {
  if (oficina && typeof oficina === "object") oficina = campoEfetivo(overrides, oficina, "oficina");
  const v = String(oficina || "").trim().toUpperCase();
  return v === OFICINA_IGNORADA.toUpperCase() ? "" : oficina || "";
}
export function tipoPartyLabel(v) { return v === "Aviso" ? "Atendimento" : v; }

export function buildAggregation(overrides, rows, keyFn) {
  const map = {};
  rows.forEach((c) => {
    const k = keyFn(c);
    if (!k) return;
    if (!map[k]) map[k] = { key: k, count: 0, valavi: 0, valind: 0, valdes: 0, tmaArr: [], tmeArr: [], tmrArr: [], atrasados: 0, semAtu: 0, indenizados: 0 };
    const g = map[k];
    g.count++;
    g.valavi += c.valavi || 0; g.valind += c.valind || 0; g.valdes += c.valdes || 0;
    const tma = diasEntre(c.datoco, c.datavi); if (tma != null && tma >= 0) g.tmaArr.push(tma);
    const tme = diasEntre(c.datavi, c.datenc); if (tme != null && tme >= 0) g.tmeArr.push(tme);
    const uj = getUserJourney(overrides, c.id);
    if (uj && uj.caminho === "parcial" && uj.steps && uj.steps.conclusao && uj.steps.conclusao.date) {
      const tmr = diasEntre(c.datavi, uj.steps.conclusao.date); if (tmr != null && tmr >= 0) g.tmrArr.push(tmr);
    }
    if (isAtrasado(overrides, c)) g.atrasados++;
    if (isSemAtualizacao(overrides, c)) g.semAtu++;
    if (situacaoEfetiva(overrides, c).label === "Indenizado") g.indenizados++;
  });
  return Object.keys(map).map((k) => {
    const g = map[k];
    return {
      key: k, count: g.count, valavi: g.valavi, valind: g.valind, valdes: g.valdes,
      ticketMedio: g.indenizados ? g.valind / g.indenizados : 0,
      tma: mediaArr(g.tmaArr), tme: mediaArr(g.tmeArr), tmr: mediaArr(g.tmrArr),
      atrasados: g.atrasados, semAtu: g.semAtu, indenizados: g.indenizados,
      taxaIndeniz: g.count ? (g.indenizados / g.count) * 100 : 0,
      pctAtraso: g.count ? (g.atrasados / g.count) * 100 : 0,
    };
  }).sort((a, b) => b.count - a.count);
}

export function statusColorMap(cssVarFn) {
  return {
    "Em andamento": cssVarFn("--warn", "#f59e0b"), "Indenizado": cssVarFn("--ok", "#16a34a"),
    "Encerrado sem Indenização": cssVarFn("--muted", "#64748b"), "Pendente": cssVarFn("--warn", "#eab308"),
    "Negado": cssVarFn("--danger", "#dc2626"), "Aberto": cssVarFn("--brand", "#2563eb"), "Encerrado": cssVarFn("--muted", "#64748b"),
  };
}
export function tempColorMap(cssVarFn) {
  return {
    "Tranquilo": cssVarFn("--ok", "#16a34a"), "Moderado": cssVarFn("--warn", "#f59e0b"),
    "Grave": cssVarFn("--danger", "#dc2626"), "Em atenção": cssVarFn("--warn", "#f97316"),
    "Não definida": cssVarFn("--muted-soft", "#94a3b8"),
  };
}

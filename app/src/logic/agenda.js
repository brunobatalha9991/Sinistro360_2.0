// Módulo Agenda (a pedido do usuário) — planejamento do dia de cada
// Atendente/Analista em blocos de tempo (08:30–18:00 por padrão), com
// presets padronizados, recorrência, alarme obrigatório ao iniciar/
// finalizar cada ação e feedback obrigatório em toda resposta ao alarme.
//
// Dados:
//   - corp_agenda (s360_agenda): blocos. Um bloco recorrente gera uma
//     ocorrência por dia aplicável; alterações de um dia só (arrastar,
//     "só este dia", excluir só este dia) ficam em bloco.excecoes[data].
//   - corp_agenda_feedback (s360_agenda_feedback): TODA resposta a um
//     alarme/lembrete. É a única fonte do andamento de cada ocorrência
//     (iniciada/concluída/não realizada/soneca) — nada de status gravado
//     em dois lugares. Chave da ocorrência = `${blocoId}|${data}`.
//   - corp_agenda_presets / corp_agenda_modelos / corp_agenda_cfg (config).
//
// Datas da agenda são SEMPRE locais (YYYY-MM-DD do relógio do usuário),
// nunca toISOString().slice(0, 10) — depois das 21h no Brasil isso já
// devolveria o dia seguinte.

export const AGENDA_CFG_DEFAULT = {
  inicio: "08:30",
  fim: "18:00",
  passoMin: 5,
  toleranciaMin: 5,
  sonecaMin: 3,
  feedbackMinChars: 5,
};

export function agendaCfg(config) {
  return { ...AGENDA_CFG_DEFAULT, ...((config && config.corp_agenda_cfg) || {}) };
}

// tipo "acao": alarme pra iniciar e pra finalizar. tipo "marco": um ponto
// no tempo (ex.: Fim de expediente), só um alarme pra marcar como feito.
// pausa: conta no cumprimento da agenda, mas fica fora do "tempo
// produtivo" dos indicadores (almoço, café).
export const PRESETS_DEFAULT = [
  { id: "ap_whatsapp", nome: "Passar a régua no WhatsApp", icone: "📱", cor: "#16a34a", duracaoMin: 45, lembreteMin: 5, tipo: "acao", pausa: false, ativo: true },
  { id: "ap_planejamento", nome: "Planejamento estratégico", icone: "🧭", cor: "#7c3aed", duracaoMin: 30, lembreteMin: 5, tipo: "acao", pausa: false, ativo: true },
  { id: "ap_retornos", nome: "Acompanhar retornos", icone: "📞", cor: "#0ea5e9", duracaoMin: 45, lembreteMin: 5, tipo: "acao", pausa: false, ativo: true },
  { id: "ap_processos", nome: "Acompanhar processos", icone: "📂", cor: "#2f6bff", duracaoMin: 45, lembreteMin: 5, tipo: "acao", pausa: false, ativo: true },
  { id: "ap_abrir", nome: "Abrir processos", icone: "📝", cor: "#ea580c", duracaoMin: 45, lembreteMin: 5, tipo: "acao", pausa: false, ativo: true },
  { id: "ap_emails", nome: "Checar e-mails", icone: "✉️", cor: "#0891b2", duracaoMin: 30, lembreteMin: 5, tipo: "acao", pausa: false, ativo: true },
  { id: "ap_integral", nome: "Tratar indenizações integrais", icone: "💰", cor: "#e11d48", duracaoMin: 45, lembreteMin: 5, tipo: "acao", pausa: false, ativo: true },
  { id: "ap_vistoria", nome: "Agendamento de vistoria", icone: "🔍", cor: "#ca8a04", duracaoMin: 30, lembreteMin: 5, tipo: "acao", pausa: false, ativo: true },
  { id: "ap_oficinas", nome: "Tratar com oficinas", icone: "🔧", cor: "#475569", duracaoMin: 45, lembreteMin: 5, tipo: "acao", pausa: false, ativo: true },
  { id: "ap_almoco", nome: "Almoço", icone: "🍽️", cor: "#94a3b8", duracaoMin: 60, lembreteMin: 5, tipo: "acao", pausa: true, ativo: true },
  { id: "ap_cafe", nome: "Café", icone: "☕", cor: "#a16207", duracaoMin: 15, lembreteMin: 0, tipo: "acao", pausa: true, ativo: true },
  { id: "ap_fim", nome: "Fim de expediente", icone: "🏁", cor: "#334155", duracaoMin: 0, lembreteMin: 10, tipo: "marco", pausa: false, ativo: true },
];

export function agendaPresets(config) {
  const p = config && config.corp_agenda_presets;
  return Array.isArray(p) && p.length ? p : PRESETS_DEFAULT;
}

export const MODELOS_DEFAULT = [
  {
    id: "am_padrao", nome: "Dia padrão (08:30–18:00)",
    itens: [
      { presetId: "ap_emails", inicio: "08:30", fim: "09:00" },
      { presetId: "ap_whatsapp", inicio: "09:00", fim: "09:45" },
      { presetId: "ap_abrir", inicio: "09:45", fim: "10:30" },
      { presetId: "ap_cafe", inicio: "10:30", fim: "10:45" },
      { presetId: "ap_processos", inicio: "10:45", fim: "11:30" },
      { presetId: "ap_vistoria", inicio: "11:30", fim: "12:00" },
      { presetId: "ap_almoco", inicio: "12:00", fim: "13:00" },
      { presetId: "ap_retornos", inicio: "13:00", fim: "13:45" },
      { presetId: "ap_oficinas", inicio: "13:45", fim: "14:30" },
      { presetId: "ap_integral", inicio: "14:30", fim: "15:15" },
      { presetId: "ap_cafe", inicio: "15:15", fim: "15:30" },
      { presetId: "ap_whatsapp", inicio: "15:30", fim: "16:15" },
      { presetId: "ap_retornos", inicio: "16:15", fim: "17:00" },
      { presetId: "ap_emails", inicio: "17:00", fim: "17:30" },
      { presetId: "ap_planejamento", inicio: "17:30", fim: "18:00" },
      { presetId: "ap_fim", inicio: "18:00", fim: "18:00" },
    ],
  },
];

export function agendaModelos(config) {
  const m = config && config.corp_agenda_modelos;
  return Array.isArray(m) && m.length ? m : MODELOS_DEFAULT;
}

// Quem tem agenda própria: Atendente e Analista (papel de verdade — VIP dá
// acesso de gestor, não tira a agenda de quem é Atendente/Analista).
export function temAgendaPropria(user) {
  return !!(user && (user.role === "atendente" || user.role === "analista"));
}

export const RECORRENCIAS = [
  ["nenhuma", "Não repete (só este dia)"],
  ["dias_uteis", "Dias úteis (seg a sex)"],
  ["diaria", "Todos os dias"],
  ["semanal", "Dias da semana escolhidos"],
];
export const DIAS_SEMANA = [[1, "Seg"], [2, "Ter"], [3, "Qua"], [4, "Qui"], [5, "Sex"], [6, "Sáb"], [0, "Dom"]];

// ---------- datas e horas (locais) ----------
function pad2(n) { return String(n).padStart(2, "0"); }
export function dataLocalISO(d = new Date()) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
export function parseDataLocal(dataISO) {
  const [y, m, d] = String(dataISO).split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDias(dataISO, n) {
  const d = parseDataLocal(dataISO);
  d.setDate(d.getDate() + n);
  return dataLocalISO(d);
}
export function diaSemana(dataISO) { return parseDataLocal(dataISO).getDay(); }
export function hhmmToMin(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function minToHHMM(min) {
  const t = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return pad2(Math.floor(t / 60)) + ":" + pad2(t % 60);
}
// Instante (ms) de um "HH:MM" num dia local.
export function instante(dataISO, hhmm) {
  const d = parseDataLocal(dataISO);
  const min = hhmmToMin(hhmm);
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d.getTime();
}
export function fmtDataBRCurta(dataISO) {
  const [y, m, d] = String(dataISO).split("-");
  return `${d}/${m}/${y}`;
}
export function fmtHoraDe(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "—" : pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

// ---------- ocorrências ----------
export function chaveOcorrencia(blocoId, dataISO) { return blocoId + "|" + dataISO; }

export function blocoAplicaNaData(bloco, dataISO) {
  if (!bloco || !bloco.data || dataISO < bloco.data) return false;
  const rec = bloco.recorrencia || { tipo: "nenhuma" };
  if (rec.ate && dataISO > rec.ate) return false;
  const exc = (bloco.excecoes || {})[dataISO];
  if (exc && exc.removida) return false;
  const dow = diaSemana(dataISO);
  switch (rec.tipo) {
    case "diaria": return true;
    case "dias_uteis": return dow >= 1 && dow <= 5;
    case "semanal": return (rec.dias || []).indexOf(dow) >= 0;
    default: return dataISO === bloco.data;
  }
}

export function ocorrenciasDoDia(blocos, userId, dataISO) {
  return (blocos || [])
    .filter((b) => b.userId === userId && blocoAplicaNaData(b, dataISO))
    .map((b) => {
      const exc = (b.excecoes || {})[dataISO] || {};
      const inicio = exc.inicio || b.inicio;
      const fim = b.tipo === "marco" ? inicio : (exc.fim || b.fim);
      return {
        key: chaveOcorrencia(b.id, dataISO),
        blocoId: b.id, data: dataISO, inicio, fim,
        titulo: b.titulo, icone: b.icone || "", cor: b.cor || "#2f6bff",
        tipo: b.tipo || "acao", pausa: !!b.pausa, presetId: b.presetId || null,
        lembreteMin: Number(b.lembreteMin) || 0, descricao: b.descricao || "",
        recorrente: !!(b.recorrencia && b.recorrencia.tipo && b.recorrencia.tipo !== "nenhuma"),
        bloco: b,
      };
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim));
}

// ---------- andamento (derivado dos feedbacks) ----------
// key -> { inicio, fim, nao_realizada, lembrete, sonecas: [] } (o feedback
// mais recente de cada tipo).
export function indexarFeedbacks(feedbacks) {
  const idx = {};
  (feedbacks || []).forEach((f) => {
    const key = chaveOcorrencia(f.blocoId, f.data);
    const e = idx[key] || (idx[key] = { sonecas: [] });
    if (f.tipo === "soneca") { e.sonecas.push(f); return; }
    if (!e[f.tipo] || String(f.at) > String(e[f.tipo].at)) e[f.tipo] = f;
  });
  return idx;
}

export const STATUS_LABEL = {
  pendente: "Pendente",
  atrasada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  nao_realizada: "Não realizada",
  perdida: "Sem registro",
};

export function statusOcorrencia(oc, idx, agora = new Date()) {
  const e = idx[oc.key] || {};
  if (e.fim) return "concluida";
  if (e.nao_realizada) return "nao_realizada";
  if (e.inicio) return "em_andamento";
  const hoje = dataLocalISO(agora);
  if (oc.data < hoje) return "perdida";
  if (oc.data === hoje && agora.getTime() >= instante(oc.data, oc.inicio)) return "atrasada";
  return "pendente";
}

function sonecaAtiva(e, fase, agoraMs, sonecaMin) {
  return (e.sonecas || []).some((s) => s.fase === fase && agoraMs - new Date(s.at).getTime() < sonecaMin * 60000);
}

// Alarmes que o dono da agenda precisa responder AGORA (só o dia de hoje).
// Fases: "lembrete" (antes do início), "iniciar", "finalizar" e "perdida"
// (o horário de fim já passou e a ação nem foi iniciada).
export function alarmesAgenda(blocos, feedbacks, userId, agora = new Date(), cfg = AGENDA_CFG_DEFAULT) {
  if (!userId) return [];
  const hoje = dataLocalISO(agora);
  const agoraMs = agora.getTime();
  const idx = indexarFeedbacks(feedbacks);
  const out = [];
  ocorrenciasDoDia(blocos, userId, hoje).forEach((oc) => {
    const e = idx[oc.key] || {};
    if (e.fim || e.nao_realizada) return;
    const ini = instante(oc.data, oc.inicio);
    const fim = instante(oc.data, oc.fim);
    let fase = null;
    if (oc.tipo === "marco") {
      if (agoraMs >= ini) fase = "finalizar";
    } else if (e.inicio) {
      if (agoraMs >= fim) fase = "finalizar";
    } else if (agoraMs >= fim) {
      fase = "perdida";
    } else if (agoraMs >= ini) {
      fase = "iniciar";
    }
    if (!fase && !e.inicio && oc.lembreteMin > 0 && !e.lembrete && agoraMs >= ini - oc.lembreteMin * 60000) fase = "lembrete";
    if (!fase) return;
    if (sonecaAtiva(e, fase, agoraMs, cfg.sonecaMin)) return;
    out.push({ key: oc.key + "|" + fase, fase, oc });
  });
  return out;
}

// ---------- modelos ----------
// Gera os blocos de um modelo pra um usuário. Com `substituir`, encerra a
// agenda recorrente existente no dia anterior a `dataInicio` e remove as
// ações avulsas a partir dessa data — senão os dois planejamentos ficam
// sobrepostos.
export function aplicarModelo({ blocosAtuais, modelo, presets, userId, dataInicio, recorrencia, substituir, autorId, novoId, agoraISO }) {
  let base = blocosAtuais || [];
  if (substituir) {
    const vespera = addDias(dataInicio, -1);
    base = base
      .filter((b) => !(b.userId === userId && (!b.recorrencia || b.recorrencia.tipo === "nenhuma") && b.data >= dataInicio))
      .map((b) => {
        if (b.userId !== userId || !b.recorrencia || b.recorrencia.tipo === "nenhuma") return b;
        if (b.data >= dataInicio) return null;
        if (b.recorrencia.ate && b.recorrencia.ate < dataInicio) return b;
        return { ...b, recorrencia: { ...b.recorrencia, ate: vespera }, atualizadoEm: agoraISO };
      })
      .filter(Boolean);
  }
  const porId = {};
  (presets || []).forEach((p) => { porId[p.id] = p; });
  const novos = (modelo.itens || []).map((it) => {
    const p = porId[it.presetId] || {};
    return {
      id: novoId(),
      userId, presetId: it.presetId || null,
      titulo: it.titulo || p.nome || "Ação",
      icone: p.icone || "", cor: p.cor || "#2f6bff",
      tipo: p.tipo || "acao", pausa: !!p.pausa,
      inicio: it.inicio, fim: (p.tipo === "marco") ? it.inicio : it.fim,
      lembreteMin: p.lembreteMin != null ? Number(p.lembreteMin) : 5,
      descricao: "",
      data: dataInicio,
      recorrencia: recorrencia || { tipo: "dias_uteis" },
      excecoes: {},
      criadoPor: autorId, criadoEm: agoraISO,
    };
  });
  return [...base, ...novos];
}

// ---------- indicadores ----------
const LIMITE_DIAS = 366;

function datasDoPeriodo(blocos, userId, deISO, ateISO, hoje) {
  let de = deISO;
  if (!de) {
    const meus = (blocos || []).filter((b) => b.userId === userId).map((b) => b.data).sort();
    de = meus[0] || hoje;
  }
  let ate = ateISO && ateISO < hoje ? ateISO : hoje;
  const out = [];
  for (let d = de; d <= ate && out.length < LIMITE_DIAS; d = addDias(d, 1)) out.push(d);
  return out;
}

function media(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null; }

export function metricasAgenda({ blocos, feedbacks, userId, deISO, ateISO, agora = new Date(), cfg = AGENDA_CFG_DEFAULT }) {
  const hoje = dataLocalISO(agora);
  const agoraMs = agora.getTime();
  const idx = indexarFeedbacks(feedbacks);
  const meusFb = (feedbacks || []).filter((f) => f.userId === userId);

  let previstas = 0, vencidas = 0, concluidas = 0, naoRealizadas = 0, semRegistro = 0, iniciadas = 0, noHorario = 0;
  let minPlanejados = 0, minExecutados = 0, sonecas = 0, lembretes = 0, feedbacksQtd = 0;
  const atrasosInicio = [];
  const porCategoria = {};

  datasDoPeriodo(blocos, userId, deISO, ateISO, hoje).forEach((data) => {
    ocorrenciasDoDia(blocos, userId, data).forEach((oc) => {
      previstas++;
      const e = idx[oc.key] || {};
      const iniMs = instante(data, oc.inicio);
      const fimMs = instante(data, oc.fim);
      const vencida = data < hoje || agoraMs >= fimMs;
      const catKey = oc.presetId || "custom:" + oc.titulo;
      const cat = porCategoria[catKey] || (porCategoria[catKey] = { chave: catKey, titulo: oc.titulo, icone: oc.icone, cor: oc.cor, previstas: 0, vencidas: 0, concluidas: 0, minPlanejados: 0, minExecutados: 0 });
      cat.previstas++;
      const durPlan = Math.max(0, (fimMs - iniMs) / 60000);
      if (!oc.pausa) { minPlanejados += durPlan; cat.minPlanejados += durPlan; }

      if (e.inicio) {
        iniciadas++;
        const atraso = (new Date(e.inicio.at).getTime() - iniMs) / 60000;
        atrasosInicio.push(Math.max(0, atraso));
        if (atraso <= cfg.toleranciaMin) noHorario++;
      }
      if (e.fim) {
        concluidas++; cat.concluidas++;
        if (e.inicio && !oc.pausa) {
          const exec = Math.max(0, (new Date(e.fim.at).getTime() - new Date(e.inicio.at).getTime()) / 60000);
          minExecutados += exec; cat.minExecutados += exec;
        }
      } else if (e.nao_realizada) {
        naoRealizadas++;
      } else if (vencida) {
        semRegistro++;
      }
      if (vencida) { vencidas++; cat.vencidas++; }
      sonecas += (e.sonecas || []).length;
      if (e.lembrete) lembretes++;
    });
  });

  const inicioPer = deISO || "0000-00-00";
  const fimPer = ateISO || "9999-99-99";
  feedbacksQtd = meusFb.filter((f) => f.data >= inicioPer && f.data <= fimPer && f.tipo !== "soneca").length;

  return {
    previstas, vencidas, concluidas, naoRealizadas, semRegistro, iniciadas, sonecas, lembretes, feedbacks: feedbacksQtd,
    taxaCumprimento: vencidas ? concluidas / vencidas : null,
    pontualidade: iniciadas ? noHorario / iniciadas : null,
    atrasoMedioInicioMin: media(atrasosInicio),
    minPlanejados: Math.round(minPlanejados),
    minExecutados: Math.round(minExecutados),
    porCategoria: Object.values(porCategoria).sort((a, b) => b.previstas - a.previstas),
  };
}

export function fmtPct(v) {
  return v == null ? "—" : Math.round(v * 100) + "%";
}
export function fmtMin(v) {
  if (v == null) return "—";
  const m = Math.round(v);
  if (m < 60) return m + " min";
  return Math.floor(m / 60) + "h" + (m % 60 ? pad2(m % 60) : "");
}

// Texto e rótulos do feedback por tipo de resposta.
export const FEEDBACK_TIPOS = {
  inicio: { label: "Início", badge: "blue", pergunta: "O que você vai priorizar nesta ação?" },
  fim: { label: "Concluída", badge: "green", pergunta: "O que foi feito? Qual o resultado?" },
  nao_realizada: { label: "Não realizada", badge: "red", pergunta: "Por que a ação não foi realizada?" },
  soneca: { label: "Soneca", badge: "amber", pergunta: "Por que precisa adiar? O que está fazendo agora?" },
  lembrete: { label: "Lembrete", badge: "purple", pergunta: "Ciente — como vai se preparar para esta ação?" },
};

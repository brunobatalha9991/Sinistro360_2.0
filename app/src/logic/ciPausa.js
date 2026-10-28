// Vínculo Comunicação Interna × Agenda (a pedido do usuário): CI de Mesa
// de Atendimento emergencial (Assistência 24h / Carro Reserva) cujo
// destinatário entra em almoço ou café é redirecionada para todos os
// operadores, com comentário automático e tela cheia de "Ciente" para os
// destinatários; quando a pausa termina, volta aos destinatários originais,
// com outro comentário automático.
//
// Pausa ("real com reserva"): começa quando o operador registra o início na
// agenda OU quando chega o horário planejado (o que vier primeiro) e termina
// quando ele registra o fim. Sem registro de início, segue o horário
// planejado; iniciou e esqueceu de finalizar, encerra sozinha
// TOLERANCIA_PAUSA_MIN depois do fim previsto.
//
// Estado em t.redirecionamentoPausa = { ativo, desde, originais, adicionados,
// motivos: { userId: { tipo, desde } }, alvosCiente, cientes: { userId: at },
// encerradoEm }. Campo novo: versões antigas do app só o preservam.
import { ocorrenciasDoDia, indexarFeedbacks, instante, dataLocalISO, temAgendaPropria } from "./agenda";
import { AUTOR_SISTEMA, ehUsuarioAdministrador } from "./ciAutomacao";

export const TIPOS_PAUSA = {
  almoco: { label: "almoço", icone: "🍽️" },
  cafe: { label: "café", icone: "☕" },
};
export const ATENDIMENTOS_EMERGENCIAIS = ["assistencia_24h", "carro_reserva"];
export const TOLERANCIA_PAUSA_MIN = 30;

function normalizar(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
export function tipoPausaDaOcorrencia(oc) {
  if (!oc) return null;
  if (oc.presetId === "ap_almoco") return "almoco";
  if (oc.presetId === "ap_cafe") return "cafe";
  const t = normalizar(oc.titulo);
  if (/\balmoco\b/.test(t)) return "almoco";
  if (/\bcafe\b/.test(t)) return "cafe";
  return null;
}

// Pausa em andamento agora para o usuário (ou null).
export function pausaAtual(blocos, feedbacks, user, agora = new Date()) {
  if (!user || !temAgendaPropria(user)) return null;
  const hoje = dataLocalISO(agora);
  const t = agora.getTime();
  const idx = indexarFeedbacks(feedbacks);
  for (const oc of ocorrenciasDoDia(blocos, user.id, hoje)) {
    const tipo = tipoPausaDaOcorrencia(oc);
    if (!tipo) continue;
    const e = idx[oc.key] || {};
    if (e.fim || e.nao_realizada) continue;
    const iniPlan = instante(oc.data, oc.inicio);
    const fimPlan = instante(oc.data, oc.fim);
    const iniReal = e.inicio ? new Date(e.inicio.at).getTime() : null;
    if (iniReal != null) {
      const fimPrevisto = Math.max(fimPlan, iniReal + Math.max(0, fimPlan - iniPlan));
      if (iniReal <= t && t < fimPrevisto + TOLERANCIA_PAUSA_MIN * 60000) return { tipo, ocKey: oc.key, inicio: oc.inicio, fim: oc.fim };
    } else if (t >= iniPlan && t < fimPlan) {
      return { tipo, ocKey: oc.key, inicio: oc.inicio, fim: oc.fim };
    }
  }
  return null;
}

function nomesDe(users, ids) {
  const nomes = ids.map((id) => ((users || []).find((u) => u.id === id) || { nome: "?" }).nome);
  return nomes.length <= 1 ? nomes.join("") : nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
}
function descricaoPausas(users, motivos, ids) {
  // "almoço de Luiz" / "almoço de Luiz e café de Ana"
  const porTipo = {};
  ids.forEach((id) => { const tp = (motivos[id] || {}).tipo || "almoco"; (porTipo[tp] = porTipo[tp] || []).push(id); });
  return Object.keys(porTipo).map((tp) => `horário de ${TIPOS_PAUSA[tp].label} de ${nomesDe(users, porTipo[tp])}`).join(" e ");
}
function comentario(texto, at) {
  return { id: "cmt_" + Math.random().toString(36).slice(2, 9), userId: AUTOR_SISTEMA, sistema: true, text: texto, at };
}

export function ciEmergencial(t) {
  return !!t && t.tipo === "Mesa de Atendimento" && ATENDIMENTOS_EMERGENCIAIS.includes(t.tipoAtendimento);
}

// Aplica redirecionamentos/devoluções. Devolve a mesma lista quando nada
// muda, e os eventos pra notificar ({ tipo: "redirecionada"|"devolvida", task, ... }).
export function processarPausasCI(tasks, users, blocos, feedbacks, agora = new Date()) {
  const at = agora.toISOString();
  const operadores = (users || []).filter((u) => u && u.role !== "consulta" && !ehUsuarioAdministrador(u)).map((u) => u.id);
  const cachePausa = {};
  const pausaDe = (id) => {
    if (!(id in cachePausa)) cachePausa[id] = pausaAtual(blocos, feedbacks, (users || []).find((u) => u.id === id), agora);
    return cachePausa[id];
  };
  const eventos = [];
  let mudou = false;
  const next = (tasks || []).map((t) => {
    if (!ciEmergencial(t) || t.status === "Concluído" || t.arquivadoManualmente) return t;
    const red = t.redirecionamentoPausa && t.redirecionamentoPausa.ativo ? t.redirecionamentoPausa : null;
    const originais = red ? red.originais || [] : (t.destinatarios || []);
    const emPausa = originais.filter((id) => id && id !== t.origem && pausaDe(id));

    if (!red) {
      if (!emPausa.length) return t;
      const motivos = {};
      emPausa.forEach((id) => { motivos[id] = { tipo: pausaDe(id).tipo, desde: at }; });
      const atuais = t.destinatarios || [];
      const adicionados = operadores.filter((id) => !atuais.includes(id));
      const destinatarios = [...atuais, ...adicionados];
      const alvosCiente = destinatarios.filter((id) => !emPausa.includes(id));
      const motivoTxt = descricaoPausas(users, motivos, emPausa);
      const texto = `⚠️ Comentário automático: devido ao ${motivoTxt}, esta demanda está sendo direcionada para todos os destinatários, com o objetivo de que seja dada sequência neste atendimento, considerado emergencial.`;
      mudou = true;
      const atualizada = {
        ...t,
        destinatarios,
        updatedAt: at,
        redirecionamentoPausa: { ativo: true, desde: at, originais: atuais, adicionados, motivos, alvosCiente, cientes: {} },
        comments: [...(t.comments || []), comentario(texto, at)],
        log: [...(t.log || []), { at, who: null, acao: `Redirecionada a todos os operadores — ${motivoTxt}` }],
      };
      eventos.push({ tipo: "redirecionada", task: atualizada, alvos: alvosCiente, motivoTxt });
      return atualizada;
    }

    // Já redirecionada: alguém novo da lista original entrou em pausa?
    const novos = emPausa.filter((id) => !red.motivos[id]);
    if (novos.length) {
      const motivos = { ...red.motivos };
      novos.forEach((id) => { motivos[id] = { tipo: pausaDe(id).tipo, desde: at }; });
      const motivoTxt = descricaoPausas(users, motivos, novos);
      mudou = true;
      return {
        ...t,
        updatedAt: at,
        redirecionamentoPausa: { ...red, motivos },
        comments: [...(t.comments || []), comentario(`⚠️ Comentário automático: também em pausa — ${motivoTxt}. A demanda segue direcionada para todos os destinatários.`, at)],
        log: [...(t.log || []), { at, who: null, acao: `Segue redirecionada — ${motivoTxt}` }],
      };
    }
    if (emPausa.length) return t;

    // Todas as pausas terminaram: volta para os destinatários originais.
    const motivoIds = Object.keys(red.motivos || {});
    const motivoTxt = descricaoPausas(users, red.motivos || {}, motivoIds);
    const destinatarios = (t.destinatarios || []).filter((id) => !(red.adicionados || []).includes(id) || (red.originais || []).includes(id));
    const texto = `✅ Comentário automático: mediante o encerramento do ${motivoTxt}, a demanda está sendo redirecionada para ${motivoIds.length > 1 ? "os destinatários originais" : "o(a) mesmo(a)"} (${nomesDe(users, red.originais || [])}).`;
    mudou = true;
    const atualizada = {
      ...t,
      destinatarios,
      updatedAt: at,
      redirecionamentoPausa: { ...red, ativo: false, encerradoEm: at },
      comments: [...(t.comments || []), comentario(texto, at)],
      log: [...(t.log || []), { at, who: null, acao: `Devolvida aos destinatários originais — fim do ${motivoTxt}` }],
    };
    eventos.push({ tipo: "devolvida", task: atualizada, alvos: [...new Set([...(red.originais || []), ...(red.adicionados || [])])], motivoTxt });
    return atualizada;
  });
  return { tasks: mudou ? next : tasks, eventos };
}

// CIs redirecionadas que ainda esperam o "Ciente" deste usuário.
export function redirecionamentosPendentesCiente(tasks, userId) {
  return (tasks || []).filter((t) => {
    const r = t && t.redirecionamentoPausa;
    return r && r.ativo && t.status !== "Concluído" && !t.arquivadoManualmente
      && (r.alvosCiente || []).includes(userId) && !(r.cientes || {})[userId];
  }).sort((a, b) => String(a.redirecionamentoPausa.desde).localeCompare(String(b.redirecionamentoPausa.desde)));
}

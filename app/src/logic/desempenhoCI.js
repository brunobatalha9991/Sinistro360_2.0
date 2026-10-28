// Atuação de cada operador na Comunicação Interna (a pedido do usuário) —
// indicadores do módulo Desempenho.
//
// Toda CI vira um resumo normalizado (normalizarCI) com o que interessa às
// métricas. CIs concluídas são apagadas de vez depois de 15 dias
// (purgeOldTasks); antes disso o resumo vai para corp_ci_historico, então
// os indicadores de períodos longos continuam completos.
import { AUTOR_SISTEMA, semInteracaoCfg, limiteSemInteracaoMin, minutosUteisEntre } from "./ciAutomacao";
import { DIAS_PARA_ARQUIVAR } from "./tasks";

function minISO(a, b) { return !a ? b : !b ? a : (String(a) < String(b) ? a : b); }
function diffMin(a, b) {
  const ta = new Date(a).getTime(), tb = new Date(b).getTime();
  return isNaN(ta) || isNaN(tb) ? null : (tb - ta) / 60000;
}
function media(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null; }
function mediana(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function normalizarCI(t) {
  if (t && t.historico) return t;
  const por = {};
  const p = (uid) => (por[uid] = por[uid] || { primeira: null, comentarios: [], ciente: null, acoes: 0 });
  (t.comments || []).forEach((c) => {
    if (!c.userId || c.userId === AUTOR_SISTEMA) return;
    const x = p(c.userId);
    x.comentarios.push(c.at);
    x.primeira = minISO(x.primeira, c.at);
  });
  Object.keys(t.ciente || {}).forEach((uid) => {
    const x = p(uid);
    x.ciente = t.ciente[uid];
    x.primeira = minISO(x.primeira, t.ciente[uid]);
  });
  let concluidoPor = null;
  (t.log || []).forEach((e) => {
    if (!e.who || /^Tarefa criada/.test(e.acao || "")) return;
    const x = p(e.who);
    x.acoes++;
    x.primeira = minISO(x.primeira, e.at);
    if (/para "Concluído"/.test(e.acao || "") || /^Tarefa concluída/.test(e.acao || "")) concluidoPor = e.who;
  });
  return {
    historico: false,
    id: t.id, ci: t.ci || "", tipo: t.tipo || "", tipoAtendimento: t.tipoAtendimento || "", urgencia: t.urgencia || "",
    origem: t.origem, dests: [...new Set(t.destinatarios || [])], status: t.status,
    createdAt: t.createdAt, concludedAt: t.status === "Concluído" ? (t.concludedAt || null) : null,
    arquivadaManual: !!t.arquivadoManualmente, concluidoPor, por,
    intervencoes: (t.intervencoes || []).map((iv) => ({
      at: iv.at, alvos: iv.alvos || [],
      respostas: Object.fromEntries(Object.entries(iv.respostas || {}).map(([k, v]) => [k, v && v.at])),
    })),
    generalizadaAusencia: Object.keys(t.generalizadaAusencia || {}),
  };
}

// Resumo pro histórico (antes do purgeOldTasks apagar a CI).
export function resumoHistoricoCI(t) {
  return { ...normalizarCI(t), historico: true };
}

// CIs vivas + histórico, sem repetir (a viva ganha).
export function todasCIsNormalizadas(tasks, historico) {
  const vivas = (tasks || []).filter(Boolean).map(normalizarCI);
  const ids = new Set(vivas.map((c) => c.id));
  return [...vivas, ...(historico || []).filter((h) => h && !ids.has(h.id))];
}

function noPeriodo(iso, deISO, ateISO) {
  const d = String(iso || "").slice(0, 10);
  if (!d) return false;
  if (deISO && d < deISO) return false;
  if (ateISO && d > ateISO) return false;
  return true;
}

function arquivada(c, agoraMs) {
  if (c.arquivadaManual) return true;
  if (c.status !== "Concluído" || !c.concludedAt) return false;
  return agoraMs - new Date(c.concludedAt).getTime() > DIAS_PARA_ARQUIVAR * 86400000;
}

export function metricasCIUsuario({ cis, notifs, userId, deISO, ateISO, config, agora = new Date() }) {
  const cfg = semInteracaoCfg(config);
  const agoraMs = agora.getTime();
  const recebidas = cis.filter((c) => c.dests.includes(userId) && c.origem !== userId && noPeriodo(c.createdAt, deISO, ateISO));

  const porTipo = {};
  let pendentes = 0, emAndamento = 0, concluidas = 0, arquivadas = 0, arquivadasManual = 0, urgentes = 0, urgentesConcluidas = 0;
  let semInteracao = 0, noPrazo = 0, foraPrazo = 0, cientes = 0, assistencias = 0, generalizadas = 0;
  const temposEncerramento = [], temposPrimeira = [];
  recebidas.forEach((c) => {
    porTipo[c.tipo || "—"] = (porTipo[c.tipo || "—"] || 0) + 1;
    if (c.status === "Concluído") concluidas++;
    else if (c.status === "Em andamento") emAndamento++;
    else pendentes++;
    if (arquivada(c, agoraMs)) arquivadas++;
    if (c.arquivadaManual) arquivadasManual++;
    if (c.urgencia === "Urgente") { urgentes++; if (c.status === "Concluído") urgentesConcluidas++; }
    if (c.tipo === "Mesa de Atendimento") assistencias++;
    if (c.generalizadaAusencia.includes(userId)) generalizadas++;
    if (c.concludedAt) { const m = diffMin(c.createdAt, c.concludedAt); if (m != null && m >= 0) temposEncerramento.push(m); }
    const eu = c.por[userId];
    if (eu && eu.ciente) cientes++;
    const limite = limiteSemInteracaoMin(c, cfg);
    const primeira = eu && eu.primeira;
    // Tempo até a 1ª interação e prazo contam só o horário comercial
    // (mesma regra do alerta de CI sem interação).
    if (primeira) {
      const m = String(primeira) >= String(c.createdAt) ? minutosUteisEntre(c.createdAt, primeira, cfg) : null;
      if (m != null && m >= 0) {
        temposPrimeira.push(m);
        if (m <= limite) noPrazo++; else foraPrazo++;
      }
    } else {
      semInteracao++;
      if (minutosUteisEntre(c.createdAt, agora, cfg) > limite) foraPrazo++;
    }
  });

  // Comentários feitos no período (em qualquer CI, inclusive as que criou).
  let comentarios = 0;
  const cisComentadas = new Set();
  cis.forEach((c) => {
    const eu = c.por[userId];
    if (!eu) return;
    eu.comentarios.forEach((at) => { if (noPeriodo(at, deISO, ateISO)) { comentarios++; cisComentadas.add(c.id); } });
  });
  const concluidasPorEle = cis.filter((c) => c.concluidoPor === userId && c.concludedAt && noPeriodo(c.concludedAt, deISO, ateISO)).length;

  // Situação atual (independe do período): CIs abertas em que é destinatário.
  const abertas = cis.filter((c) => !c.historico && c.dests.includes(userId) && c.origem !== userId && c.status !== "Concluído" && !c.arquivadaManual);
  const idades = abertas.map((c) => diffMin(c.createdAt, agora.toISOString())).filter((m) => m != null && m >= 0);
  const paradas24h = abertas.filter((c) => {
    const eu = c.por[userId];
    const ultima = eu ? [eu.ciente, ...eu.comentarios].filter(Boolean).sort().pop() : null;
    return diffMin(ultima || c.createdAt, agora.toISOString()) > 24 * 60;
  }).length;
  const idsNaoLidas = new Set((notifs || []).filter((n) => n.userId === userId && !n.read && n.taskId && !String(n.taskId).startsWith("__")).map((n) => n.taskId));
  const naoLidas = abertas.filter((c) => idsNaoLidas.has(c.id)).length;

  // Intervenções recebidas no período.
  let intervRecebidas = 0, intervRespondidas = 0;
  const temposIntervencao = [];
  cis.forEach((c) => c.intervencoes.forEach((iv) => {
    if (!iv.alvos.includes(userId) || !noPeriodo(iv.at, deISO, ateISO)) return;
    intervRecebidas++;
    const r = iv.respostas[userId];
    if (r) { intervRespondidas++; const m = diffMin(iv.at, r); if (m != null && m >= 0) temposIntervencao.push(m); }
  }));

  // Como origem.
  const criadas = cis.filter((c) => c.origem === userId && noPeriodo(c.createdAt, deISO, ateISO));
  const criadasConcluidas = criadas.filter((c) => c.status === "Concluído");
  const temposCriadas = criadasConcluidas.map((c) => diffMin(c.createdAt, c.concludedAt)).filter((m) => m != null && m >= 0);

  const comPrazo = noPrazo + foraPrazo;
  return {
    recebidas: recebidas.length, porTipo, urgentes, urgentesConcluidas, assistencias,
    pendentes, emAndamento, concluidas, arquivadas, arquivadasManual,
    taxaConclusao: recebidas.length ? concluidas / recebidas.length : null,
    tempoMedioEncerramentoMin: media(temposEncerramento),
    tempoMedianoEncerramentoMin: mediana(temposEncerramento),
    concluidasPorEle,
    tempoMedioPrimeiraInteracaoMin: media(temposPrimeira),
    tempoMedianoPrimeiraInteracaoMin: mediana(temposPrimeira),
    noPrazo, foraPrazo, pctNoPrazo: comPrazo ? noPrazo / comPrazo : null,
    semInteracao, cientes, taxaCiente: recebidas.length ? cientes / recebidas.length : null,
    comentarios, cisComentadas: cisComentadas.size, comentariosPorCI: cisComentadas.size ? comentarios / cisComentadas.size : null,
    generalizadas,
    abertasAgora: abertas.length, idadeMediaAbertasMin: media(idades), paradas24h, naoLidas,
    intervRecebidas, intervRespondidas, intervPendentes: intervRecebidas - intervRespondidas, tempoMedioRespostaIntervencaoMin: media(temposIntervencao),
    criadas: criadas.length, criadasConcluidas: criadasConcluidas.length, tempoMedioEncerramentoCriadasMin: media(temposCriadas),
  };
}

// Soma a Comunicação Interna ao feedback automático do perfil.
export function comCI(analise, mci, fmtPctFn) {
  if (!mci || !mci.recebidas) return analise;
  const fortes = analise.pontosFortes.slice();
  const atencao = analise.pontosAtencao.slice();
  if (mci.pctNoPrazo != null) {
    if (mci.pctNoPrazo >= 0.9) fortes.push(`Responde rápido às CIs: ${fmtPctFn(mci.pctNoPrazo)} com primeira interação dentro do prazo.`);
    else if (mci.pctNoPrazo < 0.7) atencao.push(`Só ${fmtPctFn(mci.pctNoPrazo)} das CIs recebidas tiveram a primeira interação dentro do prazo (${mci.foraPrazo} em atraso).`);
  }
  if (mci.semInteracao > 0) atencao.push(`${mci.semInteracao} CI(s) recebida(s) no período sem nenhuma interação dele.`);
  if (mci.paradas24h > 0) atencao.push(`${mci.paradas24h} CI(s) aberta(s) sem interação dele há mais de 24h.`);
  if (mci.intervPendentes > 0) atencao.push(`${mci.intervPendentes} intervenção(ões) ainda sem resposta.`);
  if (mci.generalizadas > 0) atencao.push(`${mci.generalizadas} CI(s) generalizada(s) por possível ausência.`);
  return { ...analise, pontosFortes: fortes, pontosAtencao: atencao };
}

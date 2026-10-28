// Ritmo do dia + impacto de pendências no Desempenho (a pedido do usuário).
//
// 1) Impacto progressivo: o que o operador tem pra fazer e não fez tira
//    pontos do Índice — quanto mais velho o atraso, mais pesa (1 dia leve,
//    2–3 médio, 4–7 alto, +7 crítico). O que vence hoje conta como
//    "pendente" (peso pequeno) e vira atraso se o expediente acabar sem ser
//    feito. Entram: próximas ações dos processos sob responsabilidade dele,
//    CIs em que ele é destinatário e ainda não interagiu, intervenções sem
//    resposta e ações da agenda de hoje sem registro. Cada item mostra os
//    pontos que tira — nada de penalidade invisível.
//
// 2) Fotos do índice ao longo do dia (corp_desempenho_ritmo, um registro
//    por operador por dia: "userId_AAAA-MM-DD"), comparadas uma com a
//    anterior pra notificar o gestor só do que é relevante e montar o
//    relatório "Ritmo do dia" (abertura → fechamento, eventos, atrasos
//    criados/resolvidos).
import { getResponsavel, isFinalizado, getNextAction, visibleClaims } from "./claims";
import {
  dataLocalISO, addDias, hhmmToMin, ocorrenciasDoDia, indexarFeedbacks, statusOcorrencia, instante,
  temAgendaPropria, metricasAgenda, agendaCfg,
} from "./agenda";
import { calcularMetricasTodosUsuarios } from "./desempenho";
import { todasCIsNormalizadas, metricasCIUsuario } from "./desempenhoCI";
import { metricasConduta } from "./conduta";
import { metricasExtras, assiduidade, calcularIndice, pesosDesempenho, nivelDoScore, PILARES } from "./desempenhoPainel";
import { semInteracaoCfg, minutosUteisEntre, limiteSemInteracaoMin } from "./ciAutomacao";

// ---------- impacto progressivo ----------
export const FAIXAS_ATRASO = [
  { ateDias: 1, pontos: 1, rotulo: "1 dia" },
  { ateDias: 3, pontos: 2, rotulo: "2–3 dias" },
  { ateDias: 7, pontos: 3, rotulo: "4–7 dias" },
  { ateDias: Infinity, pontos: 5, rotulo: "+7 dias" },
];
export const PONTOS_PENDENTE = 0.5;
export const PONTOS_INTERVENCAO = 3;
// Teto do desconto — o índice continua refletindo os pilares, o impacto
// não zera ninguém sozinho.
export const IMPACTO_MAX = 40;

export function pontosPorAtraso(dias) {
  const d = Math.max(1, dias);
  return FAIXAS_ATRASO.find((f) => d <= f.ateDias).pontos;
}
function faixaDe(dias) {
  const d = Math.max(1, dias);
  return FAIXAS_ATRASO.find((f) => d <= f.ateDias).rotulo;
}
function diasEntre(deISO, ateISO) {
  return Math.round((new Date(ateISO + "T12:00:00") - new Date(deISO + "T12:00:00")) / 86400000);
}
function interagiuNaCI(t, userId) {
  return !!((t.ciente && t.ciente[userId]) || (t.comments || []).some((c) => c.userId === userId) || (t.log || []).some((e) => e.who === userId));
}

export function impactoPendencias({ claims, overrides, tasks, blocos, feedbacks, user, atendTemplateCfg, templates, cfgCI, agora = new Date() }) {
  const userId = user && user.id;
  const itens = [];
  if (!userId) return { itens, pontos: 0, pontosBrutos: 0, atrasadas: 0, pendentes: 0 };
  const hoje = dataLocalISO(agora);
  const cfg = cfgCI || semInteracaoCfg(null);
  const fimExpediente = agora.getHours() * 60 + agora.getMinutes() >= hhmmToMin(cfg.horarioFim || "18:00");

  // Próximas ações dos processos sob responsabilidade dele.
  visibleClaims(claims || []).forEach((c) => {
    const r = getResponsavel(overrides, c.id);
    if (!r || r.id !== userId || isFinalizado(overrides, c, atendTemplateCfg, templates)) return;
    const na = getNextAction(overrides, c.id);
    if (!na || !na.date || na.date > hoje) return;
    const titulo = `${na.title || "Próxima ação"} — ${c.segurado || c.numsin || "processo"}`;
    const base = { key: "pa:" + c.id + ":" + na.date, tipo: "processo", icone: "📂", titulo, rota: ["sinistro", c.id] };
    if (na.date < hoje) {
      const dias = diasEntre(na.date, hoje);
      itens.push({ ...base, status: "atrasada", dias, pontos: pontosPorAtraso(dias), sub: `venceu há ${dias} dia(s) • faixa ${faixaDe(dias)}` });
    } else if (fimExpediente) {
      itens.push({ ...base, status: "atrasada", dias: 0, pontos: pontosPorAtraso(1), sub: "era para hoje e o expediente acabou" });
    } else {
      itens.push({ ...base, status: "pendente", dias: 0, pontos: PONTOS_PENDENTE, sub: "para hoje" });
    }
  });

  (tasks || []).forEach((t) => {
    if (!t || t.arquivadoManualmente) return;
    // Intervenções sem resposta (independe do status da CI).
    (t.intervencoes || []).forEach((iv) => {
      if ((iv.alvos || []).includes(userId) && !(iv.respostas && iv.respostas[userId])) {
        itens.push({ key: "iv:" + iv.id, tipo: "intervencao", icone: "🚨", status: "atrasada", dias: 0, pontos: PONTOS_INTERVENCAO, titulo: `Intervenção sem resposta — ${t.titulo || t.ci || "CI"}`, sub: t.ci || "CI", rota: ["tarefas", "open-" + t.id] });
      }
    });
    // CI recebida sem nenhuma interação dele.
    if (t.status === "Concluído" || t.origem === userId || !(t.destinatarios || []).includes(userId)) return;
    if (interagiuNaCI(t, userId) || !t.createdAt) return;
    const limite = limiteSemInteracaoMin(t, cfg);
    const decorridos = minutosUteisEntre(t.createdAt, agora, cfg);
    const base = { key: "ci:" + t.id, tipo: "ci", icone: "📨", titulo: t.titulo || t.ci || "CI", rota: ["tarefas", "open-" + t.id] };
    const urg = t.urgencia === "Urgente" ? 1 : 0;
    if (decorridos < limite) {
      itens.push({ ...base, status: "pendente", dias: 0, pontos: PONTOS_PENDENTE, sub: `${t.ci || "CI"} • aguardando sua interação` });
    } else {
      const dias = diasEntre(dataLocalISO(new Date(t.createdAt)), hoje);
      itens.push({ ...base, status: "atrasada", dias, pontos: pontosPorAtraso(dias) + urg, sub: `${t.ci || "CI"} • sem interação há ${Math.round(decorridos)} min úteis${urg ? " • URGENTE" : ""}` });
    }
  });

  // Agenda de hoje: ação que passou do horário sem nenhum registro.
  if (temAgendaPropria(user)) {
    const idx = indexarFeedbacks(feedbacks);
    const t0 = agora.getTime();
    ocorrenciasDoDia(blocos, userId, hoje).forEach((oc) => {
      if (oc.pausa || statusOcorrencia(oc, idx, agora) !== "atrasada") return;
      const fimMs = oc.tipo === "marco" ? instante(oc.data, oc.inicio) : instante(oc.data, oc.fim);
      const base = { key: "ag:" + oc.key, tipo: "agenda", icone: "🗓", titulo: `${oc.icone ? oc.icone + " " : ""}${oc.titulo}`, rota: ["agenda"] };
      if (t0 >= fimMs) itens.push({ ...base, status: "atrasada", dias: 0, pontos: 1, sub: `agenda ${oc.inicio}–${oc.fim} • sem registro` });
      else itens.push({ ...base, status: "pendente", dias: 0, pontos: PONTOS_PENDENTE, sub: `agenda ${oc.inicio}–${oc.fim} • não iniciada` });
    });
  }

  itens.sort((a, b) => b.pontos - a.pontos || b.dias - a.dias);
  const pontosBrutos = itens.reduce((s, i) => s + i.pontos, 0);
  return {
    itens,
    pontos: Math.min(IMPACTO_MAX, pontosBrutos),
    pontosBrutos,
    atrasadas: itens.filter((i) => i.status === "atrasada").length,
    pendentes: itens.filter((i) => i.status === "pendente").length,
  };
}

// ---------- índice de todos os operadores (mesma janela do Desempenho) ----------
export const JANELA_DIAS = 30;

export function indicesOperadores({ records, config, operadores, agora = new Date() }) {
  const users = operadores || [];
  if (!users.length) return {};
  const hoje = dataLocalISO(agora);
  const de = addDias(hoje, -JANELA_DIAS);
  const claims = records.corp_claims || [];
  const overrides = records.corp_overrides || {};
  const historico = records.corp_responsabilidade_historico || [];
  const tasks = records.corp_tasks || [];
  const templates = config.corp_journey_templates;
  const atendTemplateCfg = config.corp_atendimento_template;
  const pesos = pesosDesempenho(config);
  const cfgAgenda = agendaCfg(config);
  const cfgCI = semInteracaoCfg(config);
  const metricas = calcularMetricasTodosUsuarios({ users, claims, overrides, historico, periodoInicioISO: de + "T00:00:00.000Z", periodoFimISO: hoje + "T23:59:59.999Z", atendTemplateCfg, templates, tasks });
  const cis = todasCIsNormalizadas(tasks, records.corp_ci_historico);
  const ocorrencias = [...(records.corp_oficina_ocorrencias || []), ...(records.corp_seguradora_ocorrencias || []), ...(records.corp_cliente_ocorrencias || [])];
  const out = {};
  users.forEach((u) => {
    const m = metricas.find((x) => x.usuarioId === u.id);
    const ex = metricasExtras({ claims, overrides, historico, userId: u.id, deISO: de, ateISO: hoje, atendTemplateCfg, templates, ocorrencias });
    const ci = metricasCIUsuario({ cis, notifs: records.corp_notifs, userId: u.id, deISO: de, ateISO: hoje, config });
    const agenda = temAgendaPropria(u) ? metricasAgenda({ blocos: records.corp_agenda || [], feedbacks: records.corp_agenda_feedback || [], userId: u.id, deISO: de, ateISO: hoje, cfg: cfgAgenda }) : null;
    const conduta = metricasConduta({ registros: records.corp_conduta || [], userId: u.id, deISO: de, ateISO: hoje });
    const assid = assiduidade({ acessos: records.corp_acessos, userId: u.id, deISO: de, ateISO: hoje, inicioExpediente: cfgCI.horarioInicio || cfgAgenda.inicio || "08:30", agora });
    const impacto = impactoPendencias({ claims, overrides, tasks, blocos: records.corp_agenda, feedbacks: records.corp_agenda_feedback, user: u, atendTemplateCfg, templates, cfgCI, agora });
    out[u.id] = { u, impacto, indice: calcularIndice({ m, ex, ci, agenda, conduta, assid, pesos, impacto }) };
  });
  return out;
}

// ---------- fotos e comparação ----------
export const INTERVALO_FOTO_MIN = 15;
export const LIMIAR_PONTOS = 5;
export const LIMIAR_PILAR = 10;
export const DIAS_GUARDADOS_RITMO = 60;

export function idRitmo(userId, data) {
  return `${userId}_${data}`;
}
export function idFechamento(data) {
  return `__fechamento_${data}`;
}

export function montarFoto(indice, impacto, agora = new Date()) {
  const pilares = {};
  (indice.pilares || []).forEach((p) => { pilares[p.key] = p.valor == null ? null : Math.round(p.valor * 100); });
  return {
    at: agora.toISOString(),
    score: indice.score,
    base: indice.scoreBase,
    nivel: (indice.nivel || nivelDoScore(indice.score)).key,
    pilares,
    impacto: Math.round(impacto.pontos * 10) / 10,
    atrasos: impacto.itens.filter((i) => i.status === "atrasada").map((i) => ({ k: i.key, t: i.titulo, d: i.dias, p: i.pontos })),
    pendentes: impacto.pendentes,
  };
}

function rotuloNivel(key) {
  return (nivelDoScore({ excelente: 90, bom: 75, atencao: 55, critico: 10 }[key] ?? null) || {}).label || "Sem dados";
}
function sinal(n) {
  return n > 0 ? `+${n}` : String(n);
}

// O que mudou entre duas fotos — `relevante` decide se o gestor é
// notificado (índice ±5, troca de nível ou atraso novo); o resto vira só
// evento no relatório do dia.
export function compararFotos(anterior, atual) {
  const mudancas = [];
  const eventos = [];
  if (!anterior) return { mudancas, eventos, relevante: false };
  let relevante = false;
  const at = atual.at;
  if (anterior.score != null && atual.score != null && Math.abs(atual.score - anterior.score) >= LIMIAR_PONTOS) {
    relevante = true;
    const txt = `Índice ${anterior.score} → ${atual.score} (${sinal(atual.score - anterior.score)})`;
    mudancas.push(txt);
    eventos.push({ at, tipo: atual.score > anterior.score ? "indice_sobe" : "indice_cai", texto: txt });
  }
  if (anterior.nivel !== atual.nivel && anterior.score != null && atual.score != null) {
    relevante = true;
    const txt = `Nível ${rotuloNivel(anterior.nivel)} → ${rotuloNivel(atual.nivel)}`;
    mudancas.push(txt);
    eventos.push({ at, tipo: "nivel", texto: txt });
  }
  PILARES.forEach((p) => {
    const a = (anterior.pilares || {})[p.key];
    const b = (atual.pilares || {})[p.key];
    if (a != null && b != null && Math.abs(b - a) >= LIMIAR_PILAR) mudancas.push(`${p.icone} ${p.label} ${a} → ${b}`);
  });
  const antes = new Set((anterior.atrasos || []).map((x) => x.k));
  const agora = new Set((atual.atrasos || []).map((x) => x.k));
  const novos = (atual.atrasos || []).filter((x) => !antes.has(x.k));
  const resolvidos = (anterior.atrasos || []).filter((x) => !agora.has(x.k));
  if (novos.length) {
    relevante = true;
    mudancas.push(`${novos.length} novo(s) atraso(s): ${novos.slice(0, 3).map((x) => `${x.t} (−${x.p})`).join("; ")}${novos.length > 3 ? "…" : ""}`);
  }
  if (resolvidos.length) mudancas.push(`${resolvidos.length} atraso(s) resolvido(s)`);
  novos.forEach((x) => eventos.push({ at, tipo: "atraso_novo", texto: `Novo atraso: ${x.t} (−${x.p} pts)` }));
  resolvidos.forEach((x) => eventos.push({ at, tipo: "atraso_resolvido", texto: `Atraso resolvido: ${x.t}` }));
  return { mudancas, eventos, relevante };
}

// Grava a foto no registro do dia (função pura — usada dentro do updater
// do saveRecord). Devolve null quando ainda não é hora de outra foto.
export function registrarFoto(registro, { userId, data, foto, forcar }) {
  const atual = registro || { id: idRitmo(userId, data), userId, data, pontos: [], eventos: [] };
  const ultimo = atual.ultimo;
  if (ultimo && !forcar && new Date(foto.at).getTime() - new Date(ultimo.at).getTime() < (INTERVALO_FOTO_MIN - 1) * 60000) return null;
  const cmp = compararFotos(ultimo, foto);
  const ponto = { at: foto.at, score: foto.score, nivel: foto.nivel, impacto: foto.impacto, atrasos: foto.atrasos.length, pendentes: foto.pendentes };
  const next = {
    ...atual,
    abertura: atual.abertura || { at: foto.at, score: foto.score, nivel: foto.nivel, atrasos: foto.atrasos.length },
    pontos: [...(atual.pontos || []), ponto],
    eventos: [...(atual.eventos || []), ...(ultimo ? cmp.eventos : [{ at: foto.at, tipo: "abertura", texto: `Abertura do dia: índice ${foto.score ?? "—"}, ${foto.atrasos.length} atraso(s), ${foto.pendentes} pendente(s)` }])],
    ultimo: foto,
  };
  return { registro: next, comparacao: cmp };
}

// Resumo de um dia de um operador (relatório e fechamento).
export function resumoRitmo(registro) {
  if (!registro || !(registro.pontos || []).length) return null;
  const pts = registro.pontos;
  const scores = pts.map((p) => p.score).filter((s) => s != null);
  const ab = registro.abertura || pts[0];
  const ult = registro.ultimo || pts[pts.length - 1];
  const ev = registro.eventos || [];
  return {
    abertura: ab.score,
    atual: ult.score,
    variacao: ab.score != null && ult.score != null ? ult.score - ab.score : null,
    minimo: scores.length ? Math.min(...scores) : null,
    maximo: scores.length ? Math.max(...scores) : null,
    nivel: ult.nivel,
    atrasosNovos: ev.filter((e) => e.tipo === "atraso_novo").length,
    atrasosResolvidos: ev.filter((e) => e.tipo === "atraso_resolvido").length,
    atrasosAgora: (ult.atrasos || []).length,
    pendentesAgora: ult.pendentes || 0,
    impactoAgora: ult.impacto || 0,
    fotos: pts.length,
  };
}

// Texto do fechamento da equipe (notificação no sino).
export function textoFechamento(data, linhas) {
  const com = linhas.filter((l) => l.resumo && l.resumo.atual != null);
  if (!com.length) return null;
  const media = Math.round(com.reduce((s, l) => s + l.resumo.atual, 0) / com.length);
  const abert = com.filter((l) => l.resumo.abertura != null);
  const mediaAb = abert.length ? Math.round(abert.reduce((s, l) => s + l.resumo.abertura, 0) / abert.length) : null;
  const novos = com.reduce((s, l) => s + l.resumo.atrasosNovos, 0);
  const resolv = com.reduce((s, l) => s + l.resumo.atrasosResolvidos, 0);
  const ord = [...com].sort((a, b) => b.resumo.atual - a.resumo.atual);
  const destaque = ord[0];
  const atencao = ord[ord.length - 1];
  const dd = data.slice(8, 10) + "/" + data.slice(5, 7);
  let txt = `Fechamento do dia ${dd}: índice médio da equipe ${media}${mediaAb != null ? ` (${sinal(media - mediaAb)} no dia)` : ""} • ${novos} atraso(s) criado(s), ${resolv} resolvido(s)`;
  if (destaque) txt += ` • destaque: ${destaque.u.nome} (${destaque.resumo.atual})`;
  if (atencao && atencao !== destaque) txt += ` • atenção: ${atencao.u.nome} (${atencao.resumo.atual}, ${atencao.resumo.atrasosAgora} atraso(s))`;
  return txt;
}

// Hora de tirar fotos: dentro do expediente (até 30 min depois do fim,
// pra pegar a virada "pendente → atraso") e só em dia útil, se configurado.
export function dentroDoExpediente(agora, cfgCI) {
  const cfg = cfgCI || semInteracaoCfg(null);
  const w = agora.getDay();
  if (cfg.soDiasUteis !== false && (w === 0 || w === 6)) return false;
  const min = agora.getHours() * 60 + agora.getMinutes();
  return min >= hhmmToMin(cfg.horarioInicio || "08:30") && min <= hhmmToMin(cfg.horarioFim || "18:00") + 30;
}
export function passouDoFim(agora, cfgCI) {
  const cfg = cfgCI || semInteracaoCfg(null);
  return agora.getHours() * 60 + agora.getMinutes() >= hhmmToMin(cfg.horarioFim || "18:00");
}

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
//
// 3) Ganhos do dia (o outro lado da balança — a pedido do usuário, o
//    índice também precisa SUBIR por mérito, não só cair por falha): o
//    que o operador entrega HOJE soma pontos — produção nos processos,
//    CIs respondidas no prazo, intervenções respondidas, agenda cumprida,
//    atrasos resolvidos (devolvem o desconto + bônus de recuperação),
//    carteira zerada, chegada no horário e sequência de dias fechando sem
//    atraso. Cada regra tem teto próprio e o total também (BONUS_MAX), e
//    tudo zera à meia-noite: o índice reflete o ritmo, não um saldo
//    acumulado. Índice final = pilares − impacto + ganhos (0–100).
import { getResponsavel, isFinalizado, getNextAction, visibleClaims, loadComms } from "./claims";
import {
  dataLocalISO, addDias, hhmmToMin, ocorrenciasDoDia, indexarFeedbacks, statusOcorrencia, instante,
  temAgendaPropria, metricasAgenda, agendaCfg, inicioDiaLocalISO, fimDiaLocalISO,
} from "./agenda";
import { calcularMetricasTodosUsuarios, calcularMetricasUsuario } from "./desempenho";
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

// ---------- ganhos do dia ----------
export const BONUS_MAX = 20;
// Cada regra: pontos por ocorrência e teto. `alvo` é só pra dica de
// "como ganhar mais" (quantas faltam pro teto).
export const REGRAS_GANHO = [
  { key: "historico", icone: "📝", label: "Histórico registrado no processo", pts: 0.5, max: 4 },
  { key: "contato_cliente", icone: "📞", label: "Contato com o cliente (histórico canal Cliente)", pts: 0.5, max: 2 },
  { key: "proxima_acao", icone: "📌", label: "Próxima ação definida", pts: 0.25, max: 2 },
  { key: "jornada", icone: "🛤", label: "Jornada atualizada (status/caminho)", pts: 0.25, max: 2 },
  { key: "etapa", icone: "🧭", label: "Etapa da jornada concluída", pts: 0.5, max: 3 },
  { key: "outras", icone: "🛠", label: "Outras atualizações no processo", pts: 0.1, max: 1 },
  { key: "finalizado", icone: "🏁", label: "Processo finalizado em que você atuou", pts: 1.5, max: 4.5 },
  { key: "finalizou", icone: "🥇", label: "Bônus: desfecho marcado por você", pts: 1, max: 3 },
  { key: "satisfacao", icone: "⭐", label: "Pesquisa de satisfação com nota 4 ou 5", pts: 1, max: 2 },
  { key: "ci_prazo", icone: "📨", label: "CI com 1ª interação no prazo", pts: 0.5, max: 3 },
  { key: "ci_concluida", icone: "✔️", label: "CI concluída por você", pts: 0.5, max: 2 },
  { key: "intervencao", icone: "🚨", label: "Intervenção respondida", pts: 1, max: 3 },
  { key: "agenda", icone: "🗓", label: "Ação da agenda concluída", pts: 0.25, max: 2 },
  { key: "agenda_total", icone: "🎯", label: "Agenda do dia 100% cumprida (3+ ações)", pts: 2, max: 2 },
  { key: "recuperacao", icone: "🔧", label: "Atraso resolvido (bônus de 50% do peso dele)", pts: null, max: 4 },
  { key: "carteira_zerada", icone: "🧹", label: "Carteira sem nenhum atraso", pts: 3, max: 3 },
  { key: "pontualidade", icone: "⏰", label: "Chegada no horário hoje", pts: 1, max: 1 },
  { key: "sequencia", icone: "🔥", label: "Dias seguidos fechando sem atraso", pts: 1, max: 5 },
];
const REGRA = {};
REGRAS_GANHO.forEach((r) => { REGRA[r.key] = r; });

function arred(n) { return Math.round(n * 100) / 100; }

// Dias úteis anteriores seguidos em que o fechamento registrou o operador
// sem nenhum atraso em aberto (ver fechamento em useDesempenhoMonitor).
export function sequenciaSemAtraso(ritmo, userId, hoje) {
  let n = 0;
  for (let i = 1; i <= 20 && n < 10; i++) {
    const d = addDias(hoje, -i);
    const w = new Date(d + "T12:00:00").getDay();
    if (w === 0 || w === 6) continue;
    const f = (ritmo || {})[idFechamento(d)];
    const l = f && (f.linhas || []).find((x) => x.userId === userId);
    if (!l || l.atrasosAgora > 0) break;
    n++;
  }
  return n;
}

// `ctx` = contextoDesempenho(...). `impacto` = impactoPendencias do mesmo
// operador (carteira zerada depende dele).
export function ganhosDoDia({ ctx, user, impacto, agora = new Date() }) {
  const userId = user && user.id;
  const hoje = dataLocalISO(agora);
  const itens = [];
  if (!userId) return { itens, pontos: 0, pontosBrutos: 0, oportunidades: [] };
  const deISO = inicioDiaLocalISO(hoje);
  const ateISO = fimDiaLocalISO(hoje);
  const m = calcularMetricasUsuario({ claims: ctx.claims, overrides: ctx.overrides, historico: ctx.historico, usuarioId: userId, usuarioNome: user.nome, periodoInicioISO: deISO, periodoFimISO: ateISO, atendTemplateCfg: ctx.atendTemplateCfg, templates: ctx.templates, tasks: ctx.tasks });
  const ex = metricasExtras({ claims: ctx.claims, overrides: ctx.overrides, historico: ctx.historico, userId, userNome: user.nome, deISO: hoje, ateISO: hoje, atendTemplateCfg: ctx.atendTemplateCfg, templates: ctx.templates, ocorrencias: ctx.ocorrencias });
  const ci = metricasCIUsuario({ cis: ctx.cis, notifs: ctx.notifs, userId, deISO: hoje, ateISO: hoje, config: ctx.config, agora });
  const ag = temAgendaPropria(user) ? metricasAgenda({ blocos: ctx.blocos || [], feedbacks: ctx.feedbacks || [], userId, deISO: hoje, ateISO: hoje, agora, cfg: ctx.cfgAgenda }) : null;
  const as = assiduidade({ acessos: ctx.acessos, userId, deISO: hoje, ateISO: hoje, inicioExpediente: ctx.cfgCI.horarioInicio || "08:30", agora });

  const add = (key, qtd, detalhe, ptsFixos) => {
    const r = REGRA[key];
    if (!(qtd > 0)) return;
    const bruto = ptsFixos != null ? ptsFixos : qtd * r.pts;
    itens.push({ key, icone: r.icone, titulo: r.label, qtd, detalhe, pontos: arred(Math.min(r.max, bruto)), teto: r.max });
  };
  add("historico", m.historicosRegistrados || 0, `${m.historicosRegistrados} hoje`);
  add("contato_cliente", ex.historicosCliente || 0, `${ex.historicosCliente} com o cliente`);
  add("proxima_acao", m.proximasAcoesRegistradas || 0, `${m.proximasAcoesRegistradas} definida(s)`);
  add("jornada", m.interacoesJornada || 0, `${m.interacoesJornada} atualização(ões)`);
  add("etapa", ex.etapasConcluidas || 0, `${ex.etapasConcluidas} etapa(s)`);
  add("outras", m.outrasAtualizacoes || 0, `${m.outrasAtualizacoes} atualização(ões)`);
  add("finalizado", m.finalizadosNoPeriodo || 0, `${m.finalizadosNoPeriodo} finalizado(s)`);
  add("finalizou", m.finalizadosPorEleNoPeriodo || 0, `${m.finalizadosPorEleNoPeriodo} desfecho(s) marcado(s) por você`);
  if (ex.pesquisasCorretora && ex.notaCorretoraMedia >= 4) add("satisfacao", ex.pesquisasCorretora, `média ${ex.notaCorretoraMedia.toFixed(1)}`);
  add("ci_prazo", ci.noPrazo || 0, `${ci.noPrazo} no prazo`);
  add("ci_concluida", ci.concluidasPorEle || 0, `${ci.concluidasPorEle} concluída(s)`);
  add("intervencao", ci.intervRespondidas || 0, `${ci.intervRespondidas} respondida(s)`);
  if (ag) {
    add("agenda", ag.concluidas || 0, `${ag.concluidas}/${ag.vencidas} ações`);
    if (ag.vencidas >= 3 && ag.concluidas === ag.vencidas) add("agenda_total", 1, "tudo o que venceu até agora foi feito");
  }
  // Recuperação: atrasos que saíram da lista hoje (eventos do Ritmo do dia).
  const reg = (ctx.ritmo || {})[idRitmo(userId, hoje)];
  // Anti-burla: próxima ação que só foi empurrada pra frente devolve o
  // desconto, mas o BÔNUS só vem com histórico registrado no processo hoje.
  const resolvidos = ((reg && reg.eventos) || []).filter((e) => e.tipo === "atraso_resolvido").filter((e) => {
    const k = String(e.k || "");
    if (!k.startsWith("pa:")) return true;
    const claimId = k.split(":")[1];
    return loadComms(ctx.overrides, claimId).some((c) => c.at && dataLocalISO(new Date(c.at)) === hoje);
  });
  if (resolvidos.length) add("recuperacao", resolvidos.length, `${resolvidos.length} resolvido(s) hoje`, resolvidos.reduce((s, e) => s + (e.p || 1) * 0.5, 0));
  if (m.estoqueAtual > 0 && impacto && impacto.atrasadas === 0) add("carteira_zerada", 1, `${m.estoqueAtual} processo(s) em dia`);
  if (as && as.diasNoHorario > 0) add("pontualidade", 1, "acesso dentro da tolerância");
  const seq = sequenciaSemAtraso(ctx.ritmo, userId, hoje);
  if (seq) add("sequencia", seq, `${seq} dia(s) útil(eis) seguido(s)`);

  itens.sort((a, b) => b.pontos - a.pontos);
  const pontosBrutos = arred(itens.reduce((s, i) => s + i.pontos, 0));

  // Como ganhar mais agora: resolver o que está tirando pontos (devolve o
  // desconto + 50% de bônus) e as regras que ainda não bateram o teto.
  const oportunidades = [];
  ((impacto && impacto.itens) || []).filter((i) => i.status === "atrasada").slice(0, 4).forEach((i) => {
    oportunidades.push({ key: "op:" + i.key, icone: i.icone, texto: `Resolver: ${i.titulo}`, ganho: arred(i.pontos * 1.5), rota: i.rota });
  });
  const feitos = {};
  itens.forEach((i) => { feitos[i.key] = i.pontos; });
  ["historico", "contato_cliente", "proxima_acao", "jornada", "ci_prazo", "etapa", "finalizado", "agenda"].forEach((k) => {
    const r = REGRA[k];
    if (k === "agenda" && !ag) return;
    const falta = arred(r.max - (feitos[k] || 0));
    if (falta > 0) oportunidades.push({ key: "op:" + k, icone: r.icone, texto: `${r.label}: +${r.pts} cada`, ganho: falta });
  });
  if (m.estoqueAtual > 0 && !feitos.carteira_zerada && impacto && impacto.atrasadas > 0) {
    oportunidades.push({ key: "op:carteira", icone: REGRA.carteira_zerada.icone, texto: `Zerar os ${impacto.atrasadas} atraso(s) da carteira`, ganho: REGRA.carteira_zerada.pts });
  }
  return { itens, pontos: Math.min(BONUS_MAX, pontosBrutos), pontosBrutos, oportunidades };
}

// Tudo que impacto/ganhos/índice precisam, montado uma vez a partir dos
// records/config (página Desempenho e monitor usam o mesmo).
export function contextoDesempenho(records, config) {
  return {
    claims: records.corp_claims || [],
    overrides: records.corp_overrides || {},
    historico: records.corp_responsabilidade_historico || [],
    tasks: records.corp_tasks || [],
    cis: todasCIsNormalizadas(records.corp_tasks, records.corp_ci_historico),
    notifs: records.corp_notifs,
    blocos: records.corp_agenda || [],
    feedbacks: records.corp_agenda_feedback || [],
    acessos: records.corp_acessos,
    ritmo: records.corp_desempenho_ritmo || {},
    ocorrencias: [...(records.corp_oficina_ocorrencias || []), ...(records.corp_seguradora_ocorrencias || []), ...(records.corp_cliente_ocorrencias || [])],
    templates: config.corp_journey_templates,
    atendTemplateCfg: config.corp_atendimento_template,
    config,
    cfgAgenda: agendaCfg(config),
    cfgCI: semInteracaoCfg(config),
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
  const metricas = calcularMetricasTodosUsuarios({ users, claims, overrides, historico, periodoInicioISO: inicioDiaLocalISO(de), periodoFimISO: fimDiaLocalISO(hoje), atendTemplateCfg, templates, tasks });
  const cis = todasCIsNormalizadas(tasks, records.corp_ci_historico);
  const ocorrencias = [...(records.corp_oficina_ocorrencias || []), ...(records.corp_seguradora_ocorrencias || []), ...(records.corp_cliente_ocorrencias || [])];
  const ctx = contextoDesempenho(records, config);
  const out = {};
  users.forEach((u) => {
    const m = metricas.find((x) => x.usuarioId === u.id);
    const ex = metricasExtras({ claims, overrides, historico, userId: u.id, userNome: u.nome, deISO: de, ateISO: hoje, atendTemplateCfg, templates, ocorrencias });
    const ci = metricasCIUsuario({ cis, notifs: records.corp_notifs, userId: u.id, deISO: de, ateISO: hoje, config });
    const agenda = temAgendaPropria(u) ? metricasAgenda({ blocos: records.corp_agenda || [], feedbacks: records.corp_agenda_feedback || [], userId: u.id, deISO: de, ateISO: hoje, cfg: cfgAgenda }) : null;
    const conduta = metricasConduta({ registros: records.corp_conduta || [], userId: u.id, deISO: de, ateISO: hoje });
    const assid = assiduidade({ acessos: records.corp_acessos, userId: u.id, deISO: de, ateISO: hoje, inicioExpediente: cfgCI.horarioInicio || cfgAgenda.inicio || "08:30", agora });
    const impacto = impactoPendencias({ claims, overrides, tasks, blocos: records.corp_agenda, feedbacks: records.corp_agenda_feedback, user: u, atendTemplateCfg, templates, cfgCI, agora });
    const ganhos = ganhosDoDia({ ctx, user: u, impacto, agora });
    out[u.id] = { u, impacto, ganhos, indice: calcularIndice({ m, ex, ci, agenda, conduta, assid, pesos, impacto, ganhos }) };
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

export function montarFoto(indice, impacto, agora = new Date(), ganhos = null) {
  const pilares = {};
  (indice.pilares || []).forEach((p) => { pilares[p.key] = p.valor == null ? null : Math.round(p.valor * 100); });
  return {
    at: agora.toISOString(),
    score: indice.score,
    base: indice.scoreBase,
    nivel: (indice.nivel || nivelDoScore(indice.score)).key,
    pilares,
    impacto: Math.round(impacto.pontos * 10) / 10,
    bonus: ganhos ? Math.round(ganhos.pontos * 10) / 10 : 0,
    ganhos: ganhos ? ganhos.itens.map((g) => ({ k: g.key, t: g.titulo, q: g.qtd, p: g.pontos })) : [],
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
  novos.forEach((x) => eventos.push({ at, tipo: "atraso_novo", texto: `Novo atraso: ${x.t} (−${x.p} pts)`, k: x.k, p: x.p }));
  resolvidos.forEach((x) => eventos.push({ at, tipo: "atraso_resolvido", texto: `Atraso resolvido: ${x.t} (+${x.p} de volta)`, k: x.k, p: x.p }));
  // Ganhos que aumentaram desde a foto anterior.
  const ganhosAntes = {};
  (anterior.ganhos || []).forEach((g) => { ganhosAntes[g.k] = g.p; });
  const ganhosNovos = (atual.ganhos || []).filter((g) => g.p > (ganhosAntes[g.k] || 0));
  ganhosNovos.forEach((g) => eventos.push({ at, tipo: "ganho", texto: `${g.t}: +${Math.round((g.p - (ganhosAntes[g.k] || 0)) * 100) / 100} pts` }));
  if (ganhosNovos.length) mudancas.push(`ganhou pontos em: ${ganhosNovos.slice(0, 3).map((g) => g.t).join("; ")}${ganhosNovos.length > 3 ? "…" : ""}`);
  return { mudancas, eventos, relevante };
}

// Grava a foto no registro do dia (função pura — usada dentro do updater
// do saveRecord). Devolve null quando ainda não é hora de outra foto.
export function registrarFoto(registro, { userId, data, foto, forcar }) {
  const atual = registro || { id: idRitmo(userId, data), userId, data, pontos: [], eventos: [] };
  const ultimo = atual.ultimo;
  if (ultimo && !forcar && new Date(foto.at).getTime() - new Date(ultimo.at).getTime() < (INTERVALO_FOTO_MIN - 1) * 60000) return null;
  const cmp = compararFotos(ultimo, foto);
  const ponto = { at: foto.at, score: foto.score, nivel: foto.nivel, impacto: foto.impacto, bonus: foto.bonus || 0, atrasos: foto.atrasos.length, pendentes: foto.pendentes };
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
    bonusAgora: ult.bonus || 0,
    ganhosNoDia: ev.filter((e) => e.tipo === "ganho").length,
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

// Painel de Desempenho v3 (a pedido do usuário: "alta performance", tela de
// impacto) — junta tudo que dá pra medir de um operador num Índice de
// Desempenho 0–100 explicável (pilares e componentes visíveis), monta a
// fila priorizada do dia e as séries semanais. Reaproveita as métricas já
// existentes (desempenho.js, desempenhoCI.js, agenda.js, conduta.js) e
// acrescenta as que o sistema registrava mas ninguém media (metricasExtras
// e assiduidade).
//
// Produção (histórico, WhatsApp, renovações, etapas concluídas) conta pra
// QUEM FEZ (logic/autoria.js). Indicadores de qualidade da carteira (nota
// da pesquisa, reclamações) seguem com quem era o responsável VIGENTE no
// instante do evento (regra de justiça da Fase 2).
import {
  getResponsavel, isFinalizado, isAtrasado, getNextAction, loadComms, loadAudit,
  getUserJourney, claimTemEtapaForaDoPrazo, getPesquisaSatisfacao, getEmailAlertas, visibleClaims,
} from "./claims";
import { responsavelVigenteEm } from "./responsabilidade";
import { dataLocalISO, addDias, hhmmToMin } from "./agenda";
import { feitoPor, CANAL_IMPORTADO } from "./autoria";

// ---------- pesos e níveis ----------
export const PILARES = [
  { key: "processos", label: "Processos", icone: "📂", desc: "Carteira em dia: próximas ações no prazo, histórico atualizado, etapas no prazo." },
  { key: "ci", label: "Comunicação Interna", icone: "📨", desc: "Resposta às CIs: primeira interação no prazo, nenhuma CI ignorada, intervenções respondidas." },
  { key: "agenda", label: "Agenda", icone: "🗓", desc: "Cumprimento do planejamento do dia e pontualidade no início das ações." },
  { key: "assiduidade", label: "Assiduidade", icone: "⏰", desc: "Presença nos dias úteis e chegada até 15 min após o início do expediente." },
  { key: "conduta", label: "Conduta", icone: "🛡", desc: "Sem advertências/falhas/reclamações e com os registros confirmados (ciente)." },
];
export const PESOS_DEFAULT = { processos: 35, ci: 25, agenda: 20, assiduidade: 10, conduta: 10 };

export function pesosDesempenho(config) {
  return { ...PESOS_DEFAULT, ...((config && config.corp_desempenho_pesos) || {}) };
}

export const NIVEIS = [
  { min: 85, key: "excelente", label: "Excelente", icone: "🏆" },
  { min: 70, key: "bom", label: "Bom", icone: "👍" },
  { min: 50, key: "atencao", label: "Atenção", icone: "⚠️" },
  { min: -1, key: "critico", label: "Crítico", icone: "🚨" },
];
export function nivelDoScore(score) {
  if (score == null) return { key: "sem_dados", label: "Sem dados", icone: "—" };
  return NIVEIS.find((n) => score >= n.min);
}

// ---------- métricas extras de processos ----------
function noPeriodo(iso, deISO, ateISO) {
  const d = String(iso || "").slice(0, 10);
  if (!d) return false;
  if (deISO && d < deISO) return false;
  if (ateISO && d > ateISO) return false;
  return true;
}
function doUsuario(historico, claimId, at, userId) {
  const r = responsavelVigenteEm(historico, claimId, at);
  return !!(r && r.usuarioResponsavelId === userId);
}

export function metricasExtras({ claims, overrides, historico, userId, userNome, deISO, ateISO, atendTemplateCfg, templates, ocorrencias }) {
  const usuario = { id: userId, nome: userNome };
  const todos = visibleClaims(claims || []);
  const estoque = todos.filter((c) => {
    const r = getResponsavel(overrides, c.id);
    return r && r.id === userId && !isFinalizado(overrides, c, atendTemplateCfg, templates);
  });
  const hoje = dataLocalISO();
  let semProximaAcao = 0, proximaHoje = 0, proximaVencida = 0, etapasForaPrazo = 0, linkAtivo = 0, emailsPendentes = 0;
  estoque.forEach((c) => {
    const na = getNextAction(overrides, c.id);
    if (!na || !na.date) semProximaAcao++;
    else if (na.date === hoje) proximaHoje++;
    else if (na.date < hoje) proximaVencida++;
    if (claimTemEtapaForaDoPrazo(overrides, c.id)) etapasForaPrazo++;
    const pt = (overrides[c.id] || {}).publicTracking;
    if (pt && pt.ativo !== false && pt.token) linkAtivo++;
    emailsPendentes += getEmailAlertas(overrides, c.id).length;
  });

  // Produção no período — de quem fez.
  let historicos = 0, historicosCliente = 0, whatsapp = 0, renovacoes = 0, etapasConcluidas = 0;
  const notasCorretora = [];
  todos.forEach((c) => {
    loadComms(overrides, c.id).forEach((m) => {
      const at = m.at || (m.date ? m.date + "T12:00:00.000Z" : null);
      if (!noPeriodo(at, deISO, ateISO) || m.canal === CANAL_IMPORTADO || !feitoPor(m.whoId, m.who, usuario)) return;
      historicos++;
      if (m.canal === "Cliente") historicosCliente++;
    });
    loadAudit(overrides, c.id).forEach((a) => {
      if (!noPeriodo(a.at, deISO, ateISO)) return;
      const acao = a.acao || "";
      const ehWhats = /^Mensagem de template/.test(acao);
      const ehRenov = acao === "Prazo do histórico renovado";
      if (!ehWhats && !ehRenov) return;
      if (!feitoPor(a.whoId, a.who, usuario)) return;
      if (ehWhats) whatsapp++;
      if (ehRenov) renovacoes++;
    });
    const steps = (getUserJourney(overrides, c.id) || {}).steps || {};
    Object.values(steps).forEach((sd) => {
      if (sd && sd.concludedAt && noPeriodo(sd.concludedAt, deISO, ateISO) && feitoPor(sd.concludedById, sd.concludedBy, usuario)) etapasConcluidas++;
    });
    const p = getPesquisaSatisfacao(overrides, c.id);
    if (p && p.respondidoEm && noPeriodo(p.respondidoEm, deISO, ateISO) && p.corretora && Number(p.corretora.nota) > 0 && doUsuario(historico, c.id, p.respondidoEm, userId)) {
      notasCorretora.push(Number(p.corretora.nota));
    }
  });

  // Repasses: intervalos de responsabilidade dele que terminaram no período
  // (processo saiu da mão dele) × que começaram no período (recebeu).
  const meus = (historico || []).filter((h) => h.usuarioResponsavelId === userId);
  const repassados = meus.filter((h) => h.fimResponsabilidadeEm && noPeriodo(h.fimResponsabilidadeEm, deISO, ateISO)).length;
  const recebidos = meus.filter((h) => noPeriodo(h.inicioResponsabilidadeEm, deISO, ateISO)).length;

  // Reclamações (cliente/oficina/seguradora) ligadas a processos dele.
  const reclamacoes = (ocorrencias || []).filter((o) => o && o.tipo === "reclamacao" && o.claimId && noPeriodo(o.at || o.data, deISO, ateISO) && doUsuario(historico, o.claimId, o.at || (o.data + "T12:00:00.000Z"), userId)).length;

  const n = estoque.length;
  return {
    estoque: n, semProximaAcao, proximaHoje, proximaVencida, etapasForaPrazo, linkAtivo, emailsPendentes,
    pctComProximaAcao: n ? (n - semProximaAcao) / n : null,
    pctLinkAtivo: n ? linkAtivo / n : null,
    historicos, historicosCliente, pctContatoCliente: historicos ? historicosCliente / historicos : null,
    whatsapp, renovacoes, etapasConcluidas,
    notaCorretoraMedia: notasCorretora.length ? notasCorretora.reduce((s, x) => s + x, 0) / notasCorretora.length : null,
    pesquisasCorretora: notasCorretora.length,
    repassados, recebidos, reclamacoes,
  };
}

// ---------- assiduidade ----------
// Dias úteis no período (limitado aos dias em que o sistema já registrava
// acessos — corp_acessos guarda ~30 dias) com acesso e com chegada até o
// limite (início do expediente + tolerância).
export function assiduidade({ acessos, userId, deISO, ateISO, inicioExpediente = "08:30", toleranciaMin = 15, agora = new Date() }) {
  const lista = Object.values(acessos || {}).filter(Boolean);
  if (!lista.length) return { diasUteis: 0, diasComAcesso: 0, diasNoHorario: 0, faltas: 0, chegadaMediaMin: null, pctPresenca: null, pctNoHorario: null };
  const primeiroRegistro = lista.reduce((m, a) => (!m || a.data < m ? a.data : m), null);
  const hoje = dataLocalISO(agora);
  const limiteMin = hhmmToMin(inicioExpediente) + toleranciaMin;
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  const meus = {};
  lista.filter((a) => a.userId === userId).forEach((a) => { meus[a.data] = a; });
  let d = [deISO, primeiroRegistro, addDias(hoje, -29)].filter(Boolean).sort().pop();
  const fim = [ateISO || hoje, hoje].sort()[0];
  let diasUteis = 0, diasComAcesso = 0, diasNoHorario = 0;
  const chegadas = [];
  for (let i = 0; d <= fim && i < 400; i++, d = addDias(d, 1)) {
    const w = new Date(d + "T12:00:00").getDay();
    if (w === 0 || w === 6) continue;
    const a = meus[d];
    // Hoje só entra se já acessou ou se já passou do limite de chegada.
    if (d === hoje && !a && minAgora < limiteMin) continue;
    diasUteis++;
    if (!a) continue;
    diasComAcesso++;
    const t = new Date(a.primeiroAcesso);
    const min = t.getHours() * 60 + t.getMinutes();
    chegadas.push(min);
    if (min <= limiteMin) diasNoHorario++;
  }
  return {
    diasUteis, diasComAcesso, diasNoHorario, faltas: diasUteis - diasComAcesso,
    chegadaMediaMin: chegadas.length ? chegadas.reduce((s, x) => s + x, 0) / chegadas.length : null,
    pctPresenca: diasUteis ? diasComAcesso / diasUteis : null,
    pctNoHorario: diasComAcesso ? diasNoHorario / diasComAcesso : null,
    limiteMin,
  };
}

// ---------- índice ----------
function razao(bons, total) { return total ? Math.max(0, Math.min(1, bons / total)) : null; }
function media(vals) { const v = vals.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }

// Monta os 5 pilares (cada um 0–1, média dos componentes com dado) e o
// índice 0–100 (média ponderada dos pilares com dado). Pilar sem nenhum
// dado no período fica de fora — não pune nem premia.
// `impacto` (opcional, ver impactoPendencias em logic/desempenhoRitmo.js):
// pontos tirados por pendências/atrasos de AGORA, descontados do índice
// dos pilares (scoreBase); `ganhos` (ganhosDoDia, mesmo arquivo) somam o
// que foi entregue hoje. Índice final sempre entre 0 e 100.
export function calcularIndice({ m, ex, ci, agenda, conduta, assid, pesos, impacto, ganhos }) {
  const est = m ? m.estoqueAtual : 0;
  const pilares = {
    processos: [
      { label: "Próximas ações em dia", valor: razao(est - (m ? m.atrasadosAtual : 0), est), detalhe: m ? `${m.atrasadosAtual} vencida(s) de ${est}` : "" },
      { label: "Histórico atualizado (até 3 dias)", valor: razao(est - (m ? m.semAtualizacaoAtual : 0), est), detalhe: m ? `${m.semAtualizacaoAtual} sem atualização` : "" },
      { label: "Com próxima ação definida", valor: ex ? ex.pctComProximaAcao : null, detalhe: ex ? `${ex.semProximaAcao} sem próxima ação` : "" },
      { label: "Etapas dentro do prazo", valor: razao(est - (ex ? ex.etapasForaPrazo : 0), est), detalhe: ex ? `${ex.etapasForaPrazo} com etapa fora do prazo` : "" },
    ],
    ci: [
      { label: "1ª interação no prazo", valor: ci ? ci.pctNoPrazo : null, detalhe: ci ? `${ci.foraPrazo} em atraso de ${ci.recebidas}` : "" },
      { label: "CIs com interação", valor: ci ? razao(ci.recebidas - ci.semInteracao, ci.recebidas) : null, detalhe: ci ? `${ci.semInteracao} sem nenhuma interação` : "" },
      { label: "Intervenções respondidas", valor: ci ? razao(ci.intervRespondidas, ci.intervRecebidas) : null, detalhe: ci ? `${ci.intervRespondidas}/${ci.intervRecebidas}` : "" },
    ],
    agenda: [
      { label: "Cumprimento da agenda", valor: agenda ? agenda.taxaCumprimento : null, detalhe: agenda ? `${agenda.concluidas}/${agenda.vencidas} ações` : "" },
      { label: "Pontualidade no início", valor: agenda ? agenda.pontualidade : null, detalhe: "" },
    ],
    assiduidade: [
      { label: "Presença nos dias úteis", valor: assid ? assid.pctPresenca : null, detalhe: assid ? `${assid.faltas} dia(s) sem acesso de ${assid.diasUteis}` : "" },
      { label: "Chegada no horário", valor: assid ? assid.pctNoHorario : null, detalhe: assid ? `${assid.diasNoHorario}/${assid.diasComAcesso} dias` : "" },
    ],
    conduta: [
      { label: "Sem registros negativos", valor: conduta ? Math.max(0, 1 - 0.25 * conduta.negativos) : 1, detalhe: conduta ? `${conduta.negativos} negativo(s)` : "" },
      { label: "Registros confirmados (ciente)", valor: conduta && conduta.total ? razao(conduta.total - conduta.pendentesCiente, conduta.total) : null, detalhe: conduta ? `${conduta.pendentesCiente} sem ciente` : "" },
      { label: "Sem reclamações nos processos", valor: ex ? Math.max(0, 1 - 0.25 * ex.reclamacoes) : null, detalhe: ex ? `${ex.reclamacoes} reclamação(ões)` : "" },
    ],
  };
  let soma = 0, somaPesos = 0;
  const lista = PILARES.map((p) => {
    const componentes = pilares[p.key];
    const valor = media(componentes.map((c) => c.valor));
    const peso = Number(pesos[p.key]) || 0;
    if (valor != null && peso > 0) { soma += valor * peso; somaPesos += peso; }
    return { ...p, valor, peso, componentes };
  });
  const scoreBase = somaPesos ? Math.round((soma / somaPesos) * 100) : null;
  const desconto = impacto ? impacto.pontos || 0 : 0;
  const bonus = ganhos ? ganhos.pontos || 0 : 0;
  const score = scoreBase == null ? null : Math.min(100, Math.max(0, Math.round(scoreBase - desconto + bonus)));
  // Quanto do peso total tem dado de verdade — índice calculado com pouca
  // base (ex.: operador sem carteira, sem CIs e sem agenda) é sinalizado.
  const pesoTotal = PILARES.reduce((s, p) => s + (Number(pesos[p.key]) || 0), 0);
  const cobertura = pesoTotal ? somaPesos / pesoTotal : 0;
  return { score, scoreBase, impacto: impacto || null, ganhos: ganhos || null, nivel: nivelDoScore(score), pilares: lista, cobertura, baseParcial: cobertura < 0.5 };
}

// ---------- fila do dia ----------
// Tudo que o operador tem pra resolver, numa lista só, por prioridade.
export function filaDoDia({ claims, overrides, tasks, userId, atendTemplateCfg, templates, roteiro, agora = new Date() }) {
  const hoje = dataLocalISO(agora);
  const itens = [];
  (tasks || []).forEach((t) => {
    if (!t || t.arquivadoManualmente) return;
    (t.intervencoes || []).forEach((iv) => {
      if ((iv.alvos || []).includes(userId) && !(iv.respostas && iv.respostas[userId])) {
        itens.push({ key: "iv" + iv.id, prioridade: 0, tipo: "intervencao", icone: "🚨", titulo: `Intervenção: ${t.titulo}`, sub: `${t.ci || "CI"} • responder agora`, rota: ["tarefas", "open-" + t.id] });
      }
    });
    if (t.status === "Concluído" || t.origem === userId || !(t.destinatarios || []).includes(userId)) return;
    const interagiu = (t.ciente && t.ciente[userId]) || (t.comments || []).some((c) => c.userId === userId);
    const urgente = t.urgencia === "Urgente";
    if (!urgente && interagiu) return;
    itens.push({
      key: "ci" + t.id, prioridade: urgente ? 1 : 3, tipo: "ci", icone: "📨",
      titulo: t.titulo || "CI", sub: `${t.ci || "CI"} • ${urgente ? "URGENTE" : "aguardando sua interação"}${t.createdAt ? " • aberta em " + new Date(t.createdAt).toLocaleDateString("pt-BR") : ""}`,
      urgente, rota: ["tarefas", "open-" + t.id], ordem: t.createdAt || "",
    });
  });
  visibleClaims(claims || []).forEach((c) => {
    const r = getResponsavel(overrides, c.id);
    if (!r || r.id !== userId || isFinalizado(overrides, c, atendTemplateCfg, templates)) return;
    const na = getNextAction(overrides, c.id);
    if (!na || !na.date || na.date > hoje) return;
    const vencida = na.date < hoje || isAtrasado(overrides, c, atendTemplateCfg, templates);
    const dias = Math.round((new Date(hoje + "T12:00:00") - new Date(na.date + "T12:00:00")) / 86400000);
    itens.push({
      key: "pa" + c.id, prioridade: vencida ? 2 : 4, tipo: vencida ? "vencida" : "hoje", icone: vencida ? "⏰" : "📅",
      titulo: `${na.title || "Próxima ação"} — ${c.segurado || c.numsin || "processo"}`,
      sub: `${c.numsin || ""}${c.cia ? " • " + c.cia : ""} • ${vencida ? `vencida há ${dias} dia(s)` : "para hoje"}`,
      rota: ["sinistro", c.id], ordem: na.date,
    });
  });
  if (roteiro) {
    const a = roteiro.atual;
    if (a) itens.push({ key: "ag" + a.oc.key, prioridade: a.status === "atrasada" ? 1.5 : 2.5, tipo: "agenda", icone: "🗓", titulo: `${a.status === "atrasada" ? "Iniciar" : "Em andamento"}: ${a.oc.titulo}`, sub: `Agenda • ${a.oc.inicio}–${a.oc.fim}`, rota: ["agenda"] });
    roteiro.proximas.slice(0, 2).forEach((x) => itens.push({ key: "agp" + x.oc.key, prioridade: 5, tipo: "agenda", icone: "🗓", titulo: x.oc.titulo, sub: `Agenda • às ${x.oc.inicio}`, rota: ["agenda"], ordem: x.oc.inicio }));
  }
  return itens.sort((a, b) => a.prioridade - b.prioridade || String(a.ordem || "").localeCompare(String(b.ordem || "")));
}

// ---------- séries semanais ----------
// 8 semanas (segunda a domingo) terminando na semana atual.
export function semanasRecentes(n = 8, agora = new Date()) {
  const d = new Date(agora);
  const w = d.getDay();
  d.setDate(d.getDate() - ((w + 6) % 7));
  const segundaAtual = dataLocalISO(d);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const de = addDias(segundaAtual, -7 * i);
    out.push({ de, ate: addDias(de, 6), rotulo: de.slice(8, 10) + "/" + de.slice(5, 7) });
  }
  return out;
}

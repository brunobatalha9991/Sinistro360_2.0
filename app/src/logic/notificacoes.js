import { referenciaInteracao } from "./ciAutomacao";

// Categoria de cada notificação — usada pelo filtro do módulo Notificações.
export const CATEGORIAS_NOTIF = [
  ["ci", "Comunicação interna"],
  ["acompanhamento", "Acompanhamento"],
  ["sem_interacao", "Sem interação / intervenção"],
  ["agenda", "Agenda"],
  ["demanda", "Demandas"],
  ["desempenho", "Desempenho"],
  ["dica", "Dicas do Assistente"],
];
export function categoriaNotif(n) {
  if (n.tipo === "agenda_feedback" || n.tipo === "agenda_comentario") return "agenda";
  if (n.tipo === "dica") return "dica";
  if (n.tipo === "conduta" || n.tipo === "conduta_resposta" || n.tipo === "desempenho_mudanca" || n.tipo === "desempenho_fechamento") return "desempenho";
  if (n.taskId === "__demanda__") return "demanda";
  if (n.tipo === "escalonamento_ci" || n.tipo === "sem_interacao" || n.tipo === "sem_interacao_criador" || String(n.text || "").startsWith("⏱")) return "sem_interacao";
  if (n.acompanhamento) return "acompanhamento";
  return "ci";
}

// ---------- família de alertas de CI sem interação ----------
// A pedido do usuário ("o Considerar tem que prevalecer", "3 notificações da
// mesma demanda"): os 3 alertas automáticos de CI parada — pedido de
// intervenção (roxo), alerta dos gestores e alerta ao criador — formam UMA
// família por CI. Regras:
//  - Uma pessoa tem no máximo UM alerta aberto da família por CI: um alerta
//    de prioridade igual/maior substitui o anterior; enquanto houver um de
//    prioridade maior aberto, os menores daquela CI não chegam pra ela.
//  - Alerta igual ou maior nos últimos 5 min: não repete.
//  - Considerar / Intervir / interação de destinatário resolvem os alertas
//    abertos da CI para todo mundo (ficam opacos, com o motivo).
export const PRIORIDADE_ALERTA_CI = { escalonamento_ci: 3, sem_interacao: 2, sem_interacao_criador: 1 };
const JANELA_REPETICAO_MS = 5 * 60 * 1000;

export function tipoAlertaCI(n) {
  if (!n) return null;
  if (PRIORIDADE_ALERTA_CI[n.tipo]) return n.tipo;
  if (!n.tipo && String(n.text || "").startsWith("⏱")) return "sem_interacao";
  return null;
}
function aberta(n) {
  return !n.tratadaEm;
}

// Devolve { notifs, enviados } — `notifs` é a mesma lista quando nada muda.
export function aplicarAlertaCI(notifs, { taskId, userIds, tipo, texto, at, extra, novoId }) {
  const lista = notifs || [];
  const prio = PRIORIDADE_ALERTA_CI[tipo] || 1;
  const t0 = new Date(at).getTime();
  const enviados = [];
  const substituir = new Set();
  (userIds || []).forEach((uid) => {
    if (!uid) return;
    const familia = lista.filter((n) => n.taskId === taskId && n.userId === uid && tipoAlertaCI(n));
    const bloqueia = familia.some((n) => {
      const p = PRIORIDADE_ALERTA_CI[tipoAlertaCI(n)];
      if (p > prio && aberta(n)) return true;
      return p >= prio && t0 - new Date(n.at).getTime() < JANELA_REPETICAO_MS;
    });
    if (bloqueia) return;
    familia.forEach((n) => { if (aberta(n) && PRIORIDADE_ALERTA_CI[tipoAlertaCI(n)] <= prio) substituir.add(n.id); });
    enviados.push(uid);
  });
  if (!enviados.length) return { notifs: lista, enviados };
  const next = lista.map((n) => (substituir.has(n.id) ? { ...n, read: true, tratadaEm: at, resolvidaMotivo: "substituída por um alerta mais recente desta CI" } : n));
  enviados.forEach((uid) => {
    next.push({ id: novoId(), taskId, userId: uid, text: texto, at, read: false, emergencia: false, criacao: false, tipo, ...(extra || {}) });
  });
  return { notifs: next, enviados };
}

// Resolve todos os alertas abertos da família desta CI (todas as pessoas).
// `antesDe` (opcional): só os criados antes desse instante.
export function resolverAlertasCI(notifs, taskId, at, motivo, antesDe) {
  let mudou = false;
  const next = (notifs || []).map((n) => {
    if (n.taskId !== taskId || !tipoAlertaCI(n) || !aberta(n)) return n;
    if (antesDe && String(n.at) >= String(antesDe)) return n;
    mudou = true;
    return { ...n, read: true, tratadaEm: at, resolvidaMotivo: motivo };
  });
  return mudou ? next : notifs;
}

// Alertas que perderam o sentido: CI concluída/arquivada/apagada ou algum
// destinatário interagiu depois do alerta. Mesma lista quando nada muda.
export function resolverAlertasSuperados(notifs, tasks, at) {
  const porId = {};
  (tasks || []).forEach((t) => { if (t) porId[t.id] = t; });
  let mudou = false;
  const next = (notifs || []).map((n) => {
    if (!tipoAlertaCI(n) || n.tratadaEm) return n;
    const t = porId[n.taskId];
    let motivo = null;
    if (!t || t.arquivadoManualmente) motivo = "a CI foi arquivada ou removida";
    else if (t.status === "Concluído") motivo = "a CI foi concluída";
    else if (String(referenciaInteracao(t)) > String(n.at)) motivo = "um destinatário interagiu na CI";
    if (!motivo) return n;
    mudou = true;
    return { ...n, read: true, tratadaEm: at, resolvidaMotivo: motivo };
  });
  return mudou ? next : notifs;
}

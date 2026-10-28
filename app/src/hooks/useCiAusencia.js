import { useEffect, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { dataLocalISO, addDias } from "../logic/agenda";
import { ausenciaCfg, generalizarPorAusencia, blindarAusenciaAdministrador, idAcesso, semInteracaoCfg, verificarSemInteracao, verificarAlertasCriador, arquivarConsideracoesVencidas } from "../logic/ciAutomacao";
import { isAdmin } from "../data/auth";
import { useTasksActions } from "./useTasksActions";
import { processarPausasCI } from "../logic/ciPausa";

// Registra o acesso do dia de quem está logado e, a partir do horário de
// corte, generaliza as CIs de quem ainda não acessou; também avisa
// Admin/VIP das CIs paradas sem interação dos destinatários (ver
// logic/ciAutomacao.js). Não há servidor: a verificação roda no navegador
// de qualquer usuário logado, a cada minuto — a gravação é idempotente,
// então várias abas/pessoas rodando juntas não duplicam nada.
const CHECK_MS = 60 * 1000;
const DIAS_GUARDADOS = 30;

const ANTI_REPETICAO_MS = 5 * 60 * 1000;

// Destinatários que NÃO receberam alerta automático igual (mesma CI, mesmo
// tipo) nos últimos 5 min — trava contra tempestade de notificações (várias
// abas/versões rodando a mesma verificação ao mesmo tempo).
function semAlertaRecente(notifs, taskId, tipos, userIds) {
  const limite = Date.now() - ANTI_REPETICAO_MS;
  const recentes = new Set((notifs || [])
    .filter((n) => n.taskId === taskId && tipos(n) && new Date(n.at).getTime() > limite)
    .map((n) => n.userId));
  return (userIds || []).filter((id) => !recentes.has(id));
}
const ehAlertaGestor = (n) => n.tipo === "sem_interacao" || (!n.tipo && String(n.text || "").startsWith("⏱"));

export function useCiAusencia(currentUser) {
  const { records, config, saveRecord, recordCarregado } = useData();
  const { pushNotif } = useTasksActions();
  const users = records.corp_users;
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const hoje = dataLocalISO(agora);
  const userId = currentUser && currentUser.id;
  const acessos = records.corp_acessos || {};
  const prontos = recordCarregado("corp_acessos") && recordCarregado("corp_tasks") && recordCarregado("corp_users");

  // Acesso do dia (e limpeza dos registros com mais de 30 dias).
  useEffect(() => {
    if (!userId || !prontos || acessos[idAcesso(userId, hoje)]) return;
    const limite = addDias(hoje, -DIAS_GUARDADOS);
    saveRecord("corp_acessos", (cur) => {
      const atual = cur || {};
      const id = idAcesso(userId, hoje);
      if (atual[id]) return atual;
      const next = {};
      Object.keys(atual).forEach((k) => { if (!atual[k] || String(atual[k].data) >= limite) next[k] = atual[k]; });
      next[id] = { id, userId, data: hoje, primeiroAcesso: new Date().toISOString() };
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hoje, prontos, acessos[userId ? idAcesso(userId, hoje) : ""]]);

  // Generalização por ausência.
  useEffect(() => {
    if (!userId || !prontos) return;
    const cfg = ausenciaCfg(config);
    if (!cfg.ativo) return;
    // Quem está rodando isto está presente — mesmo que o próprio acesso
    // ainda não tenha voltado do servidor neste render.
    const acessosEfetivos = { ...acessos, [idAcesso(userId, hoje)]: acessos[idAcesso(userId, hoje)] || { userId, data: hoje } };
    let mudancas = [];
    saveRecord("corp_tasks", (cur) => {
      const blindadas = blindarAusenciaAdministrador(cur || [], records.corp_users || [], new Date());
      const r = generalizarPorAusencia(blindadas, records.corp_users || [], acessosEfetivos, new Date(), cfg);
      mudancas = r.mudancas;
      return r.mudancas.length ? r.tasks : blindadas === (cur || []) ? cur : blindadas;
    });
    mudancas.forEach(({ task, ausentes }) => {
      const nomes = ausentes.map((u) => u.nome).join(", ");
      pushNotif(task.id, task.destinatarios.filter((id) => !ausentes.some((u) => u.id === id)),
        `${task.ci || "CI"} generalizada por possível ausência de ${nomes}: ${task.titulo || ""}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, prontos, agora, records.corp_tasks, acessos, config.corp_ci_ausencia]);

  // CI sem interação dos destinatários (10 min; 5 se Urgente) → avisa
  // Administradores/VIPs no sino.
  useEffect(() => {
    if (!userId || !prontos) return;
    const cfg = semInteracaoCfg(config);
    if (!cfg.ativo) return;
    let alertas = [];
    saveRecord("corp_tasks", (cur) => {
      const agoraD = new Date();
      const r = verificarSemInteracao(arquivarConsideracoesVencidas(cur || [], agoraD), agoraD, cfg);
      alertas = r.alertas;
      return r.alertas.length ? r.tasks : arquivarConsideracoesVencidas(cur || [], agoraD);
    });
    if (!alertas.length) return;
    const gestores = (users || []).filter(isAdmin).map((u) => u.id);
    alertas.forEach(({ task, minutos, ausentes, aposConsiderada }) => {
      const nomes = ausentes.map((id) => ((users || []).find((u) => u.id === id) || { nome: "?" }).nome).join(", ");
      const texto = aposConsiderada
        ? `⏱ ${task.ci || "CI"} continua sem interação após o período de interação considerada${task.urgencia === "Urgente" ? " (URGENTE)" : ""} — sem interação: ${nomes}: ${task.titulo || ""}`
        : `⏱ ${task.ci || "CI"} sem interação dos destinatários há mais de ${minutos} min${task.urgencia === "Urgente" ? " (URGENTE)" : ""} — sem interação: ${nomes}: ${task.titulo || ""}`;
      const alvos = semAlertaRecente(records.corp_notifs, task.id, ehAlertaGestor, gestores);
      if (alvos.length) pushNotif(task.id, alvos, texto, undefined, false, false, false, { tipo: "sem_interacao", ausentes });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, prontos, agora, records.corp_tasks, config.corp_ci_sem_interacao]);

  // CI emergencial (Assistência 24h / Carro Reserva) × pausa da agenda
  // (almoço/café): redireciona a todos os operadores e devolve no fim da
  // pausa (ver logic/ciPausa.js).
  const agendaPronta = recordCarregado("corp_agenda") && recordCarregado("corp_agenda_feedback");
  useEffect(() => {
    if (!userId || !prontos || !agendaPronta) return;
    let eventos = [];
    saveRecord("corp_tasks", (cur) => {
      const r = processarPausasCI(cur || [], records.corp_users || [], records.corp_agenda || [], records.corp_agenda_feedback || [], new Date());
      eventos = r.eventos;
      return r.tasks;
    });
    eventos.forEach((ev) => {
      const tipo = ev.tipo === "redirecionada" ? "pausa_redirecionada" : "pausa_devolvida";
      const alvos = semAlertaRecente(records.corp_notifs, ev.task.id, (n) => n.tipo === tipo, ev.alvos);
      if (!alvos.length) return;
      const texto = ev.tipo === "redirecionada"
        ? `🚑 ${ev.task.ci || "CI"} redirecionada a todos (${ev.motivoTxt}) — atendimento emergencial: ${ev.task.titulo || ""}`
        : `↩️ ${ev.task.ci || "CI"} devolvida aos destinatários originais (fim do ${ev.motivoTxt}): ${ev.task.titulo || ""}`;
      pushNotif(ev.task.id, alvos, texto, undefined, ev.tipo === "redirecionada", false, false, { tipo });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, prontos, agendaPronta, agora, records.corp_tasks, records.corp_agenda, records.corp_agenda_feedback]);

  // Alerta repetido ao criador da CI + escalonamento (ver
  // verificarAlertasCriador em logic/ciAutomacao.js).
  useEffect(() => {
    if (!userId || !prontos) return;
    const cfg = semInteracaoCfg(config);
    if (!cfg.ativo) return;
    let alertas = [];
    saveRecord("corp_tasks", (cur) => {
      const r = verificarAlertasCriador(cur || [], records.corp_users || [], new Date(), cfg);
      alertas = r.alertas;
      return r.tasks;
    });
    if (!alertas.length) return;
    const nomeDe = (id) => ((users || []).find((u) => u.id === id) || { nome: "?" }).nome;
    alertas.forEach(({ task, minutos, ausentes, escalar, escalonadoPara }) => {
      const nomes = ausentes.map(nomeDe).join(", ");
      const urg = task.urgencia === "Urgente" ? " (URGENTE)" : "";
      if (semAlertaRecente(records.corp_notifs, task.id, (n) => n.tipo === "sem_interacao_criador", [task.origem]).length) pushNotif(task.id, [task.origem], `⏱ ${task.ci || "CI"} sem interação dos destinatários há ${minutos} min${urg} — sem interação: ${nomes}: ${task.titulo || ""}`,
        undefined, false, false, false, { tipo: "sem_interacao_criador", ausentes });
      if (escalar && escalonadoPara && semAlertaRecente(records.corp_notifs, task.id, (n) => n.tipo === "escalonamento_ci", [escalonadoPara]).length) {
        pushNotif(task.id, [escalonadoPara], `🟣 ${task.ci || "CI"} com alertas seguidos sem interação${urg} — avalie um pedido de intervenção. Criada por ${nomeDe(task.origem)}; sem interação: ${nomes}: ${task.titulo || ""}`,
          undefined, false, false, false, { tipo: "escalonamento_ci", ausentes });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, prontos, agora, records.corp_tasks, config.corp_ci_sem_interacao]);
}

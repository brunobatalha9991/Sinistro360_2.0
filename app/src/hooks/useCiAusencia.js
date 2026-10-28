import { useEffect, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { dataLocalISO, addDias } from "../logic/agenda";
import { ausenciaCfg, generalizarPorAusencia, idAcesso, semInteracaoCfg, verificarSemInteracao } from "../logic/ciAutomacao";
import { isAdmin } from "../data/auth";
import { useTasksActions } from "./useTasksActions";

// Registra o acesso do dia de quem está logado e, a partir do horário de
// corte, generaliza as CIs de quem ainda não acessou; também avisa
// Admin/VIP das CIs paradas sem interação dos destinatários (ver
// logic/ciAutomacao.js). Não há servidor: a verificação roda no navegador
// de qualquer usuário logado, a cada minuto — a gravação é idempotente,
// então várias abas/pessoas rodando juntas não duplicam nada.
const CHECK_MS = 60 * 1000;
const DIAS_GUARDADOS = 30;

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
      const r = generalizarPorAusencia(cur || [], records.corp_users || [], acessosEfetivos, new Date(), cfg);
      mudancas = r.mudancas;
      return r.mudancas.length ? r.tasks : cur;
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
      const r = verificarSemInteracao(cur || [], new Date(), cfg);
      alertas = r.alertas;
      return r.tasks;
    });
    if (!alertas.length) return;
    const gestores = (users || []).filter(isAdmin).map((u) => u.id);
    alertas.forEach(({ task, minutos }) => {
      pushNotif(task.id, gestores, `⏱ ${task.ci || "CI"} sem interação dos destinatários há mais de ${minutos} min${task.urgencia === "Urgente" ? " (URGENTE)" : ""}: ${task.titulo || ""}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, prontos, agora, records.corp_tasks, config.corp_ci_sem_interacao]);
}

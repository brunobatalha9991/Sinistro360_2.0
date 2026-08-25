import { useEffect, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useTasksActions } from "./useTasksActions";
import { myNotifs, isTarefaEmergencia, taskCienteByMe } from "../logic/tasks";

// Alarme em tela cheia (a pedido do usuário) pra tarefa nova de "Mesa de
// Atendimento". Dois comportamentos diferentes por tipo:
//
// - Sinistro / Assistência de vidros e pequenos reparos (amarelo): dispara
//   UMA VEZ na criação (notificação com `criacao`, ver
//   useTasksActions.pushNotif) e some ao abrir a tarefa ou dispensar
//   (`alarmeDispensado`, ver dismissAlarmeMesa).
//
// - Assistência 24h (vermelho — a pedido do usuário): dispara na hora e
//   REPETE a cada 5 minutos enquanto o destinatário não clicar em "✓
//   Ciente" na tarefa (Tarefas.jsx/markTaskCiente — taskCienteByMe) nem
//   deixar de ser destinatário. "Dispensar" aqui só adia 5 minutos (estado
//   local, não grava nada) — só some de vez com "Ciente" ou saindo dos
//   destinatários.
const REPETE_MS = 5 * 60 * 1000;
const CHECK_MS = 15 * 1000;

export function useTarefaAlarme(currentUser) {
  const { records } = useData();
  const actions = useTasksActions();
  const [, forceTick] = useState(0);
  // taskId -> timestamp da última vez que o alarme recorrente foi mostrado/
  // adiado — controla a repetição de 5 em 5 minutos, só nesta sessão.
  const [ultimoRecorrente, setUltimoRecorrente] = useState({});

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const notifs = records.corp_notifs || [];
  const tasks = records.corp_tasks || [];
  const agora = Date.now();

  const alarmes = [];

  myNotifs(notifs, currentUser).forEach((n) => {
    if (n.read || n.alarmeDispensado || !n.criacao) return;
    const t = tasks.find((x) => x.id === n.taskId);
    if (!t || t.tipo !== "Mesa de Atendimento" || t.tipoAtendimento === "assistencia_24h") return;
    alarmes.push({
      key: "unico:" + n.id, notifId: n.id, taskId: t.id, titulo: t.titulo, tipoAtendimento: t.tipoAtendimento,
      cor: "amarelo", recorrente: false,
    });
  });

  if (currentUser) {
    tasks.forEach((t) => {
      if (!isTarefaEmergencia(t)) return;
      if ((t.destinatarios || []).indexOf(currentUser.id) < 0) return;
      if (taskCienteByMe(t, currentUser)) return;
      const ultimo = ultimoRecorrente[t.id];
      if (ultimo && agora - ultimo < REPETE_MS) return;
      alarmes.push({
        key: "recorrente:" + t.id, taskId: t.id, titulo: t.titulo, tipoAtendimento: t.tipoAtendimento,
        cor: "vermelho", recorrente: true,
      });
    });
  }

  function dismiss(item) {
    if (item.recorrente) {
      setUltimoRecorrente((m) => ({ ...m, [item.taskId]: Date.now() }));
    } else {
      actions.dismissAlarmeMesa(item.notifId);
    }
  }
  function dismissAll() {
    alarmes.forEach(dismiss);
  }
  // Ao abrir a tarefa, também adia o alarme recorrente por 5 min — evita
  // que ele reapareça enquanto a pessoa ainda está atendendo, mesmo sem ter
  // clicado em "Ciente" ainda.
  function markViewed(item) {
    if (item.recorrente) setUltimoRecorrente((m) => ({ ...m, [item.taskId]: Date.now() }));
  }

  return { alarmes, dismiss, dismissAll, markViewed };
}

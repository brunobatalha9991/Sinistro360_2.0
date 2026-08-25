import { useData } from "../data/DataProvider.jsx";
import { myNotifs } from "../logic/tasks";

// Alarme em tela cheia (a pedido do usuário) pra quando um destinatário
// recebe uma tarefa nova de "Mesa de Atendimento" — Assistência 24h dispara
// vermelho, os demais tipos (Sinistro, Assistência de vidros/pequenos
// reparos) disparam amarelo. Baseado na notificação de criação (ver
// `criacao` em useTasksActions.pushNotif) ainda não lida nem dispensada —
// some quando o destinatário abre a tarefa ou dispensa o alarme
// (`alarmeDispensado`, ver dismissAlarmeMesa em useTasksActions.js). Cada
// destinatário tem seu próprio registro de notificação (um por pessoa,
// nunca compartilhado — ver pushNotif), então abrir ou dispensar aqui
// nunca afeta a tela de outro destinatário da mesma tarefa. Reage direto a
// corp_notifs/corp_tasks, sem precisar de temporizador.
export function useTarefaAlarme(currentUser) {
  const { records } = useData();
  const notifs = records.corp_notifs || [];
  const tasks = records.corp_tasks || [];

  const alarmes = [];
  myNotifs(notifs, currentUser).forEach((n) => {
    if (n.read || n.alarmeDispensado || !n.criacao) return;
    const t = tasks.find((x) => x.id === n.taskId);
    if (!t || t.tipo !== "Mesa de Atendimento") return;
    alarmes.push({
      notifId: n.id, taskId: t.id, titulo: t.titulo, tipoAtendimento: t.tipoAtendimento,
      cor: t.tipoAtendimento === "assistencia_24h" ? "vermelho" : "amarelo",
    });
  });

  return alarmes;
}

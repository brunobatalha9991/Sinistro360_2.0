import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";
import { useTasksActions } from "./useTasksActions";
import { openTaskModal, setDemandaPrefill } from "../state/taskModal";

// Abre/cria uma CI em modal por cima da página atual, sem ir pro módulo
// Comunicação (a pedido do usuário). A página precisa montar o <TaskModal />
// (hoje: detalhe do processo e Notificações).
export function useAbrirCI() {
  const { records } = useData();
  const { currentUser } = useAuth();
  const actions = useTasksActions();

  // Igual a abrir pela Comunicação: as notificações dessa CI viram lidas.
  function abrirCI(taskId) {
    if (!taskId) return;
    if (currentUser) {
      (records.corp_notifs || []).filter((n) => n.taskId === taskId && n.userId === currentUser.id && !n.read)
        .forEach((n) => actions.markNotifRead(n.id));
    }
    openTaskModal(taskId);
  }

  // Nova CI com os campos já preenchidos (título, processo vinculado...).
  function novaCI(prefill) {
    setDemandaPrefill(prefill || null);
    openTaskModal(null);
  }

  return { abrirCI, novaCI };
}

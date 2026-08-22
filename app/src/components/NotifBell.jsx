import { useEffect } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "../hooks/useAuth";
import { useHashRoute } from "../hooks/useHashRoute";
import { useStore } from "../hooks/useStore";
import { useTasksActions } from "../hooks/useTasksActions";
import { notifPanelStore } from "../state/notifPanel";
import { myNotifs, myUnreadCount } from "../logic/tasks";
import { EmptyState } from "./EmptyState.jsx";

// Porte 1:1 de notifPanel()/notif-btn do HTML original.
export function NotifBell() {
  const { records } = useData();
  const { currentUser } = useAuth();
  const { navigate } = useHashRoute();
  const actions = useTasksActions();
  const panel = useStore(notifPanelStore);

  const notifs = records.corp_notifs || [];
  const tasks = records.corp_tasks || [];
  const list = myNotifs(notifs, currentUser).slice(0, 30);
  const unread = myUnreadCount(notifs, currentUser);

  useEffect(() => {
    if (!panel.open) return;
    function onDocClick() { notifPanelStore.patch({ open: false }); }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [panel.open]);

  function toggle(e) {
    e.stopPropagation();
    notifPanelStore.patch({ open: !panel.open });
  }

  function openItem(n) {
    actions.markNotifRead(n.id);
    notifPanelStore.patch({ open: false });
    if (n.taskId === "__demanda__") { navigate("demandas"); return; }
    const t = tasks.find((x) => x.id === n.taskId);
    if (t) navigate("tarefas", "open-" + t.id);
  }

  return (
    <div style={{ position: "relative" }}>
      <button className={"notif-btn" + (unread > 0 ? " has-unread" : "")} type="button" title="Notificações" onClick={toggle}>
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="notif-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {panel.open && (
        <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px 10px" }}>
            <strong style={{ fontSize: 14 }}>Notificações</strong>
            <button className="btn sec xs" onClick={() => actions.markAllNotifsRead()}>Marcar todas lidas</button>
          </div>
          {!list.length ? <EmptyState>Nenhuma notificação.</EmptyState> : list.map((n) => {
            const isDemanda = n.taskId === "__demanda__";
            const t = isDemanda ? null : tasks.find((x) => x.id === n.taskId);
            const titulo = isDemanda ? "Nova demanda recebida" : t ? t.titulo : "(tarefa removida)";
            const when = new Date(n.at);
            const w = `${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
            return (
              <div
                key={n.id}
                className={"notif-item " + (n.read ? "read" : "unread") + (n.emergencia ? " neon-alert" : "")}
                style={n.emergencia ? { "--neon-rgb": "var(--danger-rgb)" } : undefined}
                onClick={() => openItem(n)}
              >
                <span className="nt-dot" />
                <div className="nt-body">
                  <div className="nt-title">
                    {n.emergencia && <span className="badge red" style={{ marginRight: 6, fontWeight: 700 }}>EMERGÊNCIA</span>}
                    {titulo}
                  </div>
                  <div className="nt-sub">{n.text} • {w}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

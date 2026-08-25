import { createPortal } from "react-dom";
import { useTasksActions } from "../hooks/useTasksActions";

const TIPO_LABEL = {
  sinistro: "Sinistro",
  assistencia_24h: "Assistência 24h",
  assistencia_vidros: "Assistência de vidros e pequenos reparos",
};

// Alarme em tela cheia (a pedido do usuário) pra nova tarefa de Mesa de
// Atendimento recebida — ver useTarefaAlarme.js. Usa as classes genéricas
// ".alarme-geral-*" (global.css), compartilhadas com HorarioAlarmeModal.jsx.
// Vermelho se algum item listado for recorrente (Assistência 24h — pior
// caso vence), amarelo caso contrário.
export function TarefaAlarmeModal({ alarmes, onDismiss, onDismissAll, onView, navigate }) {
  const actions = useTasksActions();
  if (!alarmes.length) return null;

  const corGeral = alarmes.some((a) => a.recorrente) ? "vermelho" : "amarelo";
  const alarmRgb = corGeral === "vermelho" ? "var(--danger-rgb)" : "var(--warn-rgb)";

  function verTarefa(a) {
    if (!a.recorrente) actions.markNotifRead(a.notifId);
    onView(a);
    navigate("tarefas", "open-" + a.taskId);
  }

  return createPortal(
    <div className="alarme-geral-overlay" style={{ "--alarm-rgb": alarmRgb }}>
      <div className="alarme-geral-box">
        <div className="alarme-geral-icone">{corGeral === "vermelho" ? "🚨" : "⚠️"}</div>
        <h2 className="alarme-geral-titulo">NOVA MESA DE ATENDIMENTO</h2>
        <p className="alarme-geral-sub">
          {alarmes.length === 1 ? "Você recebeu 1 tarefa de Mesa de Atendimento:" : `Você recebeu ${alarmes.length} tarefas de Mesa de Atendimento:`}
        </p>
        <div className="alarme-geral-lista">
          {alarmes.map((a) => (
            <div key={a.key} className="alarme-geral-item">
              <div>
                <div className="alarme-geral-item-titulo">{a.titulo}</div>
                <div className="alarme-geral-item-sub">
                  {TIPO_LABEL[a.tipoAtendimento] || "Atendimento"}
                  {a.recorrente && " • repete a cada 5 min até marcar \"Ciente\" na tarefa"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button type="button" className="btn sm" onClick={() => verTarefa(a)}>Ver tarefa</button>
                <button type="button" className="btn sec xs" onClick={() => onDismiss(a)} title={a.recorrente ? "Adia 5 minutos — só marcar Ciente na tarefa para parar de vez" : ""}>
                  {a.recorrente ? "Adiar 5 min" : "Dispensar"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn ghost sm" style={{ marginTop: 14 }} onClick={onDismissAll}>Dispensar todos</button>
      </div>
    </div>,
    document.body,
  );
}

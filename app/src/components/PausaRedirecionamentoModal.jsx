import { createPortal } from "react-dom";
import { useData } from "../data/DataProvider.jsx";
import { useTasksActions } from "../hooks/useTasksActions";
import { redirecionamentosPendentesCiente, TIPOS_PAUSA } from "../logic/ciPausa";

// CI emergencial redirecionada pela pausa (almoço/café) de um destinatário —
// a pedido do usuário, tela cheia em todos os destinatários obrigando o
// "Ciente" (ver logic/ciPausa.js). Uma por vez, a mais antiga primeiro.
function fmtHora(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PausaRedirecionamentoModal({ currentUser }) {
  const { records } = useData();
  const actions = useTasksActions();
  if (!currentUser) return null;
  const pendentes = redirecionamentosPendentesCiente(records.corp_tasks, currentUser.id);
  if (!pendentes.length) return null;
  const task = pendentes[0];
  const r = task.redirecionamentoPausa;
  const users = records.corp_users || [];
  const quem = Object.keys(r.motivos || {}).map((id) => {
    const tp = TIPOS_PAUSA[(r.motivos[id] || {}).tipo] || TIPOS_PAUSA.almoco;
    return `${tp.icone} ${(users.find((u) => u.id === id) || { nome: "?" }).nome} (${tp.label})`;
  }).join(", ");
  const atend = task.tipoAtendimento === "carro_reserva" ? "Carro Reserva" : "Assistência 24h";

  return createPortal(
    <div className="alarme-geral-overlay" style={{ "--alarm-rgb": "var(--warn-rgb)" }} role="alertdialog" aria-modal="true">
      <div className="alarme-geral-box" style={{ maxWidth: 640 }}>
        <div className="alarme-geral-icone">🚑</div>
        <h2 className="alarme-geral-titulo">ATENDIMENTO EMERGENCIAL REDIRECIONADO</h2>
        <p className="alarme-geral-sub">
          Desde {fmtHora(r.desde)}, esta demanda foi direcionada para todos os destinatários por causa da pausa de <b>{quem}</b>. Dê sequência neste atendimento.
        </p>
        <div className="conduta-alerta-corpo" style={{ "--alarm-rgb": "var(--warn-rgb)" }}>
          <div className="muted" style={{ fontSize: 12 }}>{task.ci ? task.ci + " • " : ""}Mesa de Atendimento • {atend} • {task.status}{task.urgencia === "Urgente" ? " • URGENTE" : ""}</div>
          <div className="conduta-alerta-titulo">{task.titulo}</div>
          {task.descricao && <div className="conduta-alerta-texto muted">{task.descricao}</div>}
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn ok" onClick={() => actions.cienteRedirecionamento(task, currentUser)}>✓ Ciente</button>
          <button type="button" className="btn sec" onClick={() => { actions.cienteRedirecionamento(task, currentUser); window.location.hash = "#/tarefas/open-" + task.id; }}>✓ Ciente e abrir a CI</button>
        </div>
        {pendentes.length > 1 && <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>+ {pendentes.length - 1} demanda(s) redirecionada(s) na fila.</p>}
      </div>
    </div>,
    document.body,
  );
}

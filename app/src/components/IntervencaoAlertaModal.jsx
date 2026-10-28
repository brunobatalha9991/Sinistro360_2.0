import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataProvider.jsx";
import { useTasksActions } from "../hooks/useTasksActions";
import { notificacaoSuportada } from "../hooks/useAgendaAlarme";
import { intervencoesPendentes } from "../logic/tasks";

// Intervenção de Admin/VIP numa CI (ver intervencoesPendentes em
// logic/tasks.js) — a pedido do usuário, cada destinatário é obrigado a
// responder com um comentário: a tela fica travada até a resposta, sem
// outra saída. A resposta entra no chat da CI.
const MIN_CHARS = 5;

function fmtDataHora(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function TelaIntervencao({ task, iv, autor, restantes, onResponder }) {
  const [texto, setTexto] = useState("");
  const ok = texto.trim().length >= MIN_CHARS;
  return (
    <div className="alarme-geral-overlay intervencao-alerta" style={{ "--alarm-rgb": "var(--danger-rgb)" }} role="alertdialog" aria-modal="true">
      <div className="alarme-geral-box" style={{ maxWidth: 640 }}>
        <div className="alarme-geral-icone">🚨</div>
        <h2 className="alarme-geral-titulo">INTERVENÇÃO</h2>
        <p className="alarme-geral-sub">
          <b>{autor ? autor.nome : "Administrador"}</b> fez uma intervenção em {fmtDataHora(iv.at)} na {task.ci || "CI"} e aguarda a sua resposta.
        </p>
        <div className="conduta-alerta-corpo" style={{ "--alarm-rgb": "var(--danger-rgb)" }}>
          <div className="muted" style={{ fontSize: 12 }}>{task.ci ? task.ci + " • " : ""}{task.tipo} • {task.status}</div>
          <div className="conduta-alerta-titulo">{task.titulo}</div>
          {task.descricao && <div className="conduta-alerta-texto muted">{task.descricao}</div>}
          <div className="intervencao-texto">“{iv.texto}”</div>
        </div>
        <div style={{ textAlign: "left", marginTop: 16 }}>
          <label style={{ fontSize: 13 }}>Sua resposta (vai para o chat da CI)</label>
          <textarea autoFocus rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`Escreva pelo menos ${MIN_CHARS} caracteres...`} />
        </div>
        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn" disabled={!ok} onClick={() => onResponder(texto.trim())}>Responder</button>
        </div>
        {restantes > 0 && <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>+ {restantes} intervenção(ões) na fila depois desta.</p>}
      </div>
    </div>
  );
}

export function IntervencaoAlertaModal({ currentUser }) {
  const { records } = useData();
  const actions = useTasksActions();
  const notificados = useRef(new Set());
  const pendentes = currentUser ? intervencoesPendentes(records.corp_tasks, currentUser.id) : [];

  const chaves = pendentes.map((p) => p.iv.id).join(",");
  useEffect(() => {
    if (!notificacaoSuportada() || Notification.permission !== "granted") return;
    pendentes.forEach(({ task, iv }) => {
      if (notificados.current.has(iv.id)) return;
      notificados.current.add(iv.id);
      try {
        const n = new Notification(`🚨 Intervenção na ${task.ci || "CI"}`, { body: `${task.titulo}: ${iv.texto}`, tag: "s360-intervencao-" + iv.id, requireInteraction: true });
        n.onclick = () => { window.focus(); n.close(); };
      } catch { /* ignore */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaves]);

  if (!pendentes.length) return null;
  const { task, iv } = pendentes[0];
  const autor = (records.corp_users || []).find((u) => u.id === iv.autorId);
  return createPortal(
    <TelaIntervencao
      key={iv.id} task={task} iv={iv} autor={autor} restantes={pendentes.length - 1}
      onResponder={(texto) => actions.responderIntervencao(task, iv, texto, currentUser)}
    />,
    document.body,
  );
}

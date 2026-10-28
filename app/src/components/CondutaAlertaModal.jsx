import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataProvider.jsx";
import { useCondutaActions } from "../hooks/useCondutaActions";
import { notificacaoSuportada } from "../hooks/useAgendaAlarme";
import { condutaPendentes, tipoConduta, SONECA_CONDUTA_MIN, FEEDBACK_CONDUTA_MIN_CHARS } from "../logic/conduta";

// Registro de conduta pendente (ver logic/conduta.js) — a pedido do
// usuário, trava a tela inteira até o "Ciente". Com feedback solicitado,
// o "Ciente" só libera com o feedback escrito; a única outra saída é a
// soneca de 3 min, que traz a tela de volta depois.
const CHECK_MS = 15 * 1000;

function fmtDataHora(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function TelaRegistro({ reg, autor, restantes, onCiente, onSoneca }) {
  const [feedback, setFeedback] = useState("");
  const t = tipoConduta(reg.tipo);
  const ok = !reg.exigeFeedback || feedback.trim().length >= FEEDBACK_CONDUTA_MIN_CHARS;
  return (
    <div className="alarme-geral-overlay conduta-alerta" style={{ "--alarm-rgb": t.negativo ? "var(--danger-rgb)" : "var(--brand-rgb)" }} role="alertdialog" aria-modal="true">
      <div className="alarme-geral-box" style={{ maxWidth: 620 }}>
        <div className="alarme-geral-icone">{t.icone}</div>
        <h2 className="alarme-geral-titulo">{t.label.toUpperCase()}</h2>
        <p className="alarme-geral-sub">
          Registrado por <b>{autor ? autor.nome : "Administrador"}</b> em {fmtDataHora(reg.at)}. Leia com atenção e confirme a leitura.
        </p>
        <div className="conduta-alerta-corpo">
          <div className="conduta-alerta-titulo">{reg.titulo}</div>
          {reg.texto && <div className="conduta-alerta-texto">{reg.texto}</div>}
        </div>

        {reg.exigeFeedback && (
          <div style={{ textAlign: "left", marginTop: 16 }}>
            <label style={{ fontSize: 13 }}>
              Feedback obrigatório{reg.perguntaFeedback ? ` — ${reg.perguntaFeedback}` : ""}
            </label>
            <textarea autoFocus rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={`Escreva pelo menos ${FEEDBACK_CONDUTA_MIN_CHARS} caracteres...`} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 18 }}>
          <button type="button" className="btn" disabled={!ok} onClick={() => onCiente(reg, feedback)}>
            {reg.exigeFeedback ? "✓ Enviar feedback e dar ciente" : "✓ Ciente"}
          </button>
          {reg.exigeFeedback && (
            <button type="button" className="btn sec" onClick={() => onSoneca(reg)}>💤 Soneca {SONECA_CONDUTA_MIN} min</button>
          )}
        </div>
        {restantes > 0 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>+ {restantes} registro(s) na fila depois deste.</p>
        )}
      </div>
    </div>
  );
}

export function CondutaAlertaModal({ currentUser }) {
  const { records } = useData();
  const actions = useCondutaActions();
  const [agora, setAgora] = useState(() => new Date());
  const notificados = useRef(new Set());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const pendentes = currentUser ? condutaPendentes(records.corp_conduta, currentUser.id, agora) : [];

  // Notificação do Windows, uma vez por registro nesta aba.
  const chaves = pendentes.map((r) => r.id).join(",");
  useEffect(() => {
    if (!notificacaoSuportada() || Notification.permission !== "granted") return;
    pendentes.forEach((r) => {
      if (notificados.current.has(r.id)) return;
      notificados.current.add(r.id);
      const t = tipoConduta(r.tipo);
      try {
        const n = new Notification(`${t.icone} ${t.label}`, { body: r.titulo, tag: "s360-conduta-" + r.id, requireInteraction: true });
        n.onclick = () => { window.focus(); n.close(); };
      } catch { /* ignore */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaves]);

  if (!pendentes.length) return null;
  const reg = pendentes[0];
  const autor = (records.corp_users || []).find((u) => u.id === reg.autorId);

  return createPortal(
    <TelaRegistro
      key={reg.id} reg={reg} autor={autor} restantes={pendentes.length - 1}
      onCiente={(r, fb) => actions.darCiente(r, fb, currentUser)}
      onSoneca={(r) => { actions.soneca(r); setAgora(new Date()); }}
    />,
    document.body,
  );
}

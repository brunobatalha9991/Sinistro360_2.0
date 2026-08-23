import { createPortal } from "react-dom";
import { fmtDateHoraBR, txt } from "../logic/format";

// Tela sobreposta pra ver o corpo completo de um e-mail — a pedido do
// usuário: a caixa de entrada e o alerta dentro do processo só mostravam
// um resumo curto. Reaproveitado em Emails.jsx (sem navegação: index/total/
// onPrev/onNext/onUsar/onDispensar ficam undefined) e em DetailHeader.jsx
// (com setas ‹ › quando o processo tem mais de um e-mail vinculado, e
// Usar/Dispensar agindo sempre sobre o e-mail exibido no momento).
export function EmailViewerModal({ email, onClose, index, total, onPrev, onNext, onUsar, onDispensar }) {
  if (!email) return null;
  const showNav = total > 1;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <div style={{ width: 680, maxWidth: "100%", background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0 }}>{txt(email.assunto)}</h3>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {txt(email.remetenteNome || email.remetente)} • {fmtDateHoraBR(email.recebidoEm)}
            </div>
          </div>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>

        {showNav && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 }}>
            <button className="btn sec xs" onClick={onPrev} disabled={index <= 0}>‹ Anterior</button>
            <span className="muted" style={{ fontSize: 12 }}>{index + 1} de {total}</span>
            <button className="btn sec xs" onClick={onNext} disabled={index >= total - 1}>Próximo ›</button>
          </div>
        )}

        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "var(--surface-2)", maxHeight: "60vh", overflow: "auto" }}>
          <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{txt(email.corpoTexto)}</div>
        </div>

        {(onUsar || onDispensar) && (
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {onUsar && <button className="btn xs" onClick={onUsar}>Transformar em atualização</button>}
            {onDispensar && <button className="btn sec xs" onClick={onDispensar}>Dispensar este e-mail</button>}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

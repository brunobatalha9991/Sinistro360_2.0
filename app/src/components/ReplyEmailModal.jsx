import { useState } from "react";
import { createPortal } from "react-dom";

// Responder e-mail direto pelo sistema — a pedido do usuário. Nunca envia
// sozinho: só monta o rascunho (destinatário, cópia, assunto, corpo com a
// assinatura já anexada) e só sai da tela quando o usuário clica em
// "Enviar" de propósito.
export function ReplyEmailModal({ email, assinatura, onSend, onClose }) {
  const [to, setTo] = useState(email.remetente || "");
  const [cc, setCc] = useState("");
  const [assunto, setAssunto] = useState(/^re:/i.test(email.assunto || "") ? email.assunto : `Re: ${email.assunto || ""}`);
  const [corpo, setCorpo] = useState(assinatura ? `\n\n${assinatura}` : "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    if (!to.trim()) { setErro("Informe o destinatário."); return; }
    setEnviando(true); setErro(null);
    try {
      await onSend({ to: to.trim(), cc: cc.trim(), assunto, corpo });
      setEnviado(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setErro(e.message || "Falha ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <div style={{ width: 640, maxWidth: "100%", background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Responder e-mail</h3>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>

        <div className="field"><label>Para</label><input value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="field"><label>Cc (opcional)</label><input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="um ou mais e-mails separados por vírgula" /></div>
        <div className="field"><label>Assunto</label><input value={assunto} onChange={(e) => setAssunto(e.target.value)} /></div>
        <div className="field"><label>Mensagem</label><textarea rows={9} value={corpo} onChange={(e) => setCorpo(e.target.value)} /></div>

        {erro && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{erro}</div>}
        {enviado ? (
          <div className="status ok">E-mail enviado.</div>
        ) : (
          <button className="btn" disabled={enviando} onClick={enviar}>{enviando ? "Enviando..." : "Enviar"}</button>
        )}
      </div>
    </div>,
    document.body
  );
}

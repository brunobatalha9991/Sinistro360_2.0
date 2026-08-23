import { useState } from "react";

// Assinatura eletrônica — a pedido do usuário: entra automaticamente no
// corpo do e-mail ao clicar em "Responder" (Emails.jsx), mas continua
// editável antes de enviar.
export function EmailAssinaturaCard({ config, saveConfig, canEdit }) {
  const [texto, setTexto] = useState(config.corp_email_assinatura || "");

  function salvar() {
    if (!canEdit) { alert("Apenas administradores podem alterar esta configuração."); return; }
    saveConfig("corp_email_assinatura", texto);
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Assinatura de E-mail</h3>
      <p className="muted">Adicionada automaticamente ao final das respostas enviadas pelo sistema (aba "Responder" em E-mails) — pode ser editada antes de cada envio.</p>
      <textarea rows={4} placeholder={"Ex.: Atenciosamente,\nEquipe Batalha Corretora"} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <button className="btn sec sm" style={{ marginTop: 8 }} onClick={salvar}>Salvar</button>
    </div>
  );
}

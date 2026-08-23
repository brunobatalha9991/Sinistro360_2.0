import { useEffect, useState } from "react";
import { isGmailConfigured, getGmailToken, getGmailAccountEmail, gmailLogin, gmailLogout, saveGmailAccountEmail } from "../../gmail/googleAuthClient";
import { fetchGmailProfile } from "../../logic/gmailApi";

// Configuração da integração com Gmail (Google Identity Services) — passo a
// passo de cadastro gratuito no Google Cloud Console em
// docs/gmail-integracao.md. Alternativa ao Outlook: uma conta @gmail.com
// pessoal não tem "administrador de organização" nenhum barrando o
// consentimento (diferente de contas Microsoft 365 corporativas).
export function GmailConfigCard({ config, saveConfig, canEdit }) {
  const cfg = config.corp_gmail_cfg || {};
  const [clientId, setClientId] = useState(cfg.clientId || "");
  const [email, setEmail] = useState(getGmailAccountEmail());
  const [status, setStatus] = useState(null);

  const configurado = isGmailConfigured(config);

  useEffect(() => {
    if (getGmailToken()) setEmail(getGmailAccountEmail());
  }, []);

  function salvar() {
    if (!canEdit) { alert("Apenas administradores podem alterar esta configuração."); return; }
    if (!clientId.trim()) { alert("Informe o Client ID."); return; }
    saveConfig("corp_gmail_cfg", { clientId: clientId.trim() });
    setStatus({ cls: "ok", msg: "Configuração salva." });
  }

  async function conectar() {
    setStatus(null);
    try {
      const token = await gmailLogin(config);
      const conta = await fetchGmailProfile(token);
      saveGmailAccountEmail(conta);
      setEmail(conta);
      setStatus({ cls: "ok", msg: `Conectado como ${conta}.` });
    } catch (e) {
      setStatus({ cls: "err", msg: e.message || "Falha ao conectar com o Gmail." });
    }
  }
  function desconectar() {
    gmailLogout();
    setEmail(null);
    setStatus({ cls: "ok", msg: "Desconectado." });
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Gmail (E-mails)</h3>
      <p className="muted">
        Client ID OAuth do Google Cloud Console — passo a passo em <code>docs/gmail-integracao.md</code>. Diferente do Outlook, uma conta @gmail.com pessoal não depende de aprovação de nenhum administrador de organização.
      </p>
      <div className="field"><label>Client ID</label>
        <input placeholder="000000000000-xxxxxxxxxxxx.apps.googleusercontent.com" value={clientId} onChange={(e) => setClientId(e.target.value)} />
      </div>
      <button className="btn sec sm" onClick={salvar}>Salvar</button>

      {configurado && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <p style={{ fontSize: 13 }}>
            Conta: {email ? <span className="badge green">{email}</span> : <span className="badge gray">Não conectada</span>}
          </p>
          {email ? (
            <button className="btn sec sm" onClick={desconectar}>Desconectar</button>
          ) : (
            <button className="btn sm" onClick={conectar}>Conectar com Gmail</button>
          )}
        </div>
      )}
      {status && <div className={"status " + status.cls} style={{ marginTop: 10 }}>{status.msg}</div>}
    </div>
  );
}

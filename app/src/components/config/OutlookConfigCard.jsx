import { useEffect, useState } from "react";
import { isOutlookConfigured, getOutlookAccount, outlookLogin, outlookLogout } from "../../outlook/msalClient";

// Configuração da integração com Outlook (Microsoft Graph via MSAL.js) —
// passo a passo de cadastro gratuito no Azure AD em
// docs/outlook-integracao.md. Só permissão de leitura (Mail.Read); a senha
// da conta Microsoft nunca passa pelo Sinistro360 (login na tela oficial
// da Microsoft).
export function OutlookConfigCard({ config, saveConfig, canEdit }) {
  const cfg = config.corp_outlook_cfg || {};
  const [clientId, setClientId] = useState(cfg.clientId || "");
  const [tenantId, setTenantId] = useState(cfg.tenantId || "");
  const [conta, setConta] = useState(null);
  const [status, setStatus] = useState(null);

  const configurado = isOutlookConfigured(config);

  useEffect(() => {
    if (!configurado) { setConta(null); return; }
    getOutlookAccount(config).then(setConta).catch(() => setConta(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configurado, config.corp_outlook_cfg]);

  function salvar() {
    if (!canEdit) { alert("Apenas administradores podem alterar esta configuração."); return; }
    if (!clientId.trim()) { alert("Informe o Client ID."); return; }
    saveConfig("corp_outlook_cfg", { clientId: clientId.trim(), tenantId: tenantId.trim() });
    setStatus({ cls: "ok", msg: "Configuração salva." });
  }

  async function conectar() {
    setStatus(null);
    try {
      const account = await outlookLogin(config);
      setConta(account);
      setStatus({ cls: "ok", msg: `Conectado como ${account.username}.` });
    } catch (e) {
      setStatus({ cls: "err", msg: e.message || "Falha ao conectar com o Outlook." });
    }
  }
  async function desconectar() {
    try {
      await outlookLogout(config);
      setConta(null);
      setStatus({ cls: "ok", msg: "Desconectado." });
    } catch (e) {
      setStatus({ cls: "err", msg: e.message || "Falha ao desconectar." });
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Outlook (E-mails)</h3>
      <p className="muted">
        Client ID do App Registration gratuito no Azure AD — passo a passo em <code>docs/outlook-integracao.md</code>. Tenant ID é opcional (só necessário se o App Registration tiver sido restrito à sua organização; deixe em branco pra funcionar com qualquer conta Microsoft, inclusive pessoal).
      </p>
      <div className="grid c2">
        <div className="field"><label>Client ID (Application ID)</label>
          <input placeholder="00000000-0000-0000-0000-000000000000" value={clientId} onChange={(e) => setClientId(e.target.value)} />
        </div>
        <div className="field"><label>Tenant ID (opcional)</label>
          <input placeholder="00000000-0000-0000-0000-000000000000" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        </div>
      </div>
      <button className="btn sec sm" onClick={salvar}>Salvar</button>

      {configurado && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <p style={{ fontSize: 13 }}>
            Conta: {conta ? <span className="badge green">{conta.username}</span> : <span className="badge gray">Não conectada</span>}
          </p>
          {conta ? (
            <button className="btn sec sm" onClick={desconectar}>Desconectar</button>
          ) : (
            <button className="btn sm" onClick={conectar}>Conectar com Outlook</button>
          )}
        </div>
      )}
      {status && <div className={"status " + status.cls} style={{ marginTop: 10 }}>{status.msg}</div>}
    </div>
  );
}

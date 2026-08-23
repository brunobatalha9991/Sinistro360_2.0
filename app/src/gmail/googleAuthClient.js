// Login OAuth com conta Google/Gmail via Google Identity Services (GIS) —
// script leve carregado sob demanda (sem SDK/npm), mesma filosofia de
// corpApi.js/geminiApi.js (fetch cru, sem dependência pesada). Diferente do
// Outlook: uma conta @gmail.com pessoal não tem "administrador de
// organização" nenhum barrando o consentimento — é sempre autoatendimento,
// então não sofre do mesmo bloqueio de admin do Microsoft 365. Passo a
// passo de cadastro gratuito no Google Cloud Console em
// docs/gmail-integracao.md.
// Ampliado (a pedido do usuário) além da leitura: gmail.modify pra
// excluir/mover e-mails (rótulos/pastas) e gmail.send pra responder direto
// pelo sistema. Isso muda o consentimento pedido — quem já conectou com o
// escopo antigo (só leitura) precisa clicar em "Conectar com Gmail" de
// novo pra autorizar as permissões novas. Os dois escopos novos são
// "sensíveis" no Google e precisam estar cadastrados na Tela de
// Consentimento OAuth (ver docs/gmail-integracao.md).
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send";
const TOKEN_KEY = "gmail_access_token";
const TOKEN_EXP_KEY = "gmail_token_exp";
const EMAIL_KEY = "gmail_account_email";

let gisLoadPromise = null;
function loadGis() {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o script de login do Google."));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

export function isGmailConfigured(config) {
  return !!(config && config.corp_gmail_cfg && String(config.corp_gmail_cfg.clientId || "").trim());
}

export function getGmailToken() {
  try {
    const tok = sessionStorage.getItem(TOKEN_KEY);
    const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || 0);
    return tok && Date.now() < exp ? tok : null;
  } catch {
    return null;
  }
}
export function getGmailAccountEmail() {
  try { return sessionStorage.getItem(EMAIL_KEY) || null; } catch { return null; }
}

export async function gmailLogin(config) {
  await loadGis();
  const clientId = ((config && config.corp_gmail_cfg) || {}).clientId || "";
  if (!clientId.trim()) throw new Error("Client ID do Gmail não configurado.");
  const token = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
        resolve(resp);
      },
    });
    client.requestAccessToken();
  });
  try {
    sessionStorage.setItem(TOKEN_KEY, token.access_token);
    sessionStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + (Number(token.expires_in || 3000) - 60) * 1000));
  } catch { /* ignore */ }
  return token.access_token;
}

export function gmailLogout() {
  let tok = null;
  try { tok = sessionStorage.getItem(TOKEN_KEY); } catch { /* ignore */ }
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
  } catch { /* ignore */ }
  if (tok && window.google && window.google.accounts && window.google.accounts.oauth2) {
    window.google.accounts.oauth2.revoke(tok, () => {});
  }
}

export function saveGmailAccountEmail(email) {
  try { sessionStorage.setItem(EMAIL_KEY, email || ""); } catch { /* ignore */ }
}

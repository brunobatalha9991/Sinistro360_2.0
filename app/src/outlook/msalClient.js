import { PublicClientApplication } from "@azure/msal-browser";

// Login OAuth com a conta Microsoft/Outlook via MSAL.js — sem backend,
// sem client secret (App Registration do tipo SPA, fluxo PKCE). O passo a
// passo de cadastro gratuito no Azure AD está em docs/outlook-integracao.md.
// O token fica só na sessão do navegador; a senha da conta Microsoft nunca
// passa pelo Sinistro360 (login acontece na tela oficial da Microsoft).
const SCOPES = ["Mail.Read", "User.Read"];

let msalInstance = null;
let initPromise = null;
let cachedClientId = null;

export function isOutlookConfigured(config) {
  return !!(config && config.corp_outlook_cfg && String(config.corp_outlook_cfg.clientId || "").trim());
}

function redirectUri() {
  return window.location.origin + window.location.pathname;
}

// Recria a instância se o Client ID/Tenant salvo mudar (evita instância
// presa numa config antiga depois de editar em Configurações).
function getMsalInstance(config) {
  const clientId = (config.corp_outlook_cfg || {}).clientId || "";
  const tenantId = (config.corp_outlook_cfg || {}).tenantId || "";
  const key = clientId + "|" + tenantId;
  if (msalInstance && cachedClientId === key) return initPromise.then(() => msalInstance);

  cachedClientId = key;
  msalInstance = new PublicClientApplication({
    auth: {
      clientId,
      authority: "https://login.microsoftonline.com/" + (tenantId.trim() || "common"),
      redirectUri: redirectUri(),
    },
    cache: { cacheLocation: "sessionStorage" },
  });
  initPromise = msalInstance.initialize();
  return initPromise.then(() => msalInstance);
}

export async function getOutlookAccount(config) {
  if (!isOutlookConfigured(config)) return null;
  const msal = await getMsalInstance(config);
  const accounts = msal.getAllAccounts();
  return accounts.length ? accounts[0] : null;
}

export async function outlookLogin(config) {
  const msal = await getMsalInstance(config);
  const resp = await msal.loginPopup({ scopes: SCOPES });
  return resp.account;
}

export async function outlookLogout(config) {
  const msal = await getMsalInstance(config);
  const account = msal.getAllAccounts()[0];
  if (account) await msal.logoutPopup({ account });
}

// Token silencioso primeiro (renova sozinho enquanto a sessão MSAL estiver
// válida); só abre popup de novo se realmente precisar de interação.
export async function getOutlookToken(config) {
  const msal = await getMsalInstance(config);
  const account = msal.getAllAccounts()[0];
  if (!account) throw new Error("Conta Outlook não conectada. Clique em \"Conectar com Outlook\".");
  try {
    const resp = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return resp.accessToken;
  } catch {
    const resp = await msal.acquireTokenPopup({ scopes: SCOPES, account });
    return resp.accessToken;
  }
}

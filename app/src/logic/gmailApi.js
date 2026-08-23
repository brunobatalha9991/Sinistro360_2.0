// Chamada crua à Gmail API (estilo corpApi.js/outlookApi.js — fetch puro,
// sem SDK). Devolve o mesmo formato de e-mail normalizado que outlookApi.js
// ({id, assunto, remetente, remetenteNome, recebidoEm, resumo, corpoTexto,
// lido}), pra emailMatching.js/Emails.jsx funcionarem igual pros dois
// provedores.
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

function errorMessage(status) {
  if (status === 401) return "Sessão do Gmail expirada. Conecte de novo.";
  if (status === 403) return "Sem permissão pra ler a caixa de entrada (escopo gmail.readonly).";
  if (status === 429) return "Limite de uso da API do Gmail atingido. Tente novamente em instantes.";
  return `Erro ao consultar o Gmail (HTTP ${status}).`;
}

async function authedFetch(token, path) {
  let resp;
  try {
    resp = await fetch(GMAIL_BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error("Falha de rede ao consultar o Gmail. Verifique sua conexão.");
  }
  if (!resp.ok) throw new Error(errorMessage(resp.status));
  return resp.json();
}

export async function fetchGmailProfile(token) {
  const data = await authedFetch(token, "/users/me/profile");
  return data.emailAddress || "";
}

export function decodeBase64Url(s) {
  if (!s) return "";
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const bin = atob(norm);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

export function extractText(payload) {
  if (!payload) return "";
  if (payload.body && payload.body.data && (!payload.parts || payload.parts.length === 0)) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts && payload.parts.length) {
    const plain = payload.parts.find((p) => p.mimeType === "text/plain");
    if (plain && plain.body && plain.body.data) return decodeBase64Url(plain.body.data);
    const html = payload.parts.find((p) => p.mimeType === "text/html");
    if (html && html.body && html.body.data) return decodeBase64Url(html.body.data).replace(/<[^>]+>/g, " ");
    for (const p of payload.parts) {
      const t = extractText(p);
      if (t) return t;
    }
  }
  return "";
}

export function headerValue(headers, name) {
  const h = (headers || []).find((x) => String(x.name).toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}

function mapMessage(m) {
  const headers = m.payload && m.payload.headers;
  const from = headerValue(headers, "From");
  const assunto = headerValue(headers, "Subject") || "(sem assunto)";
  const match = from.match(/^(.*?)<(.+)>$/);
  const remetenteNome = match ? match[1].trim().replace(/^"|"$/g, "") : from;
  const remetente = match ? match[2].trim() : from;
  return {
    id: m.id, assunto, remetente, remetenteNome,
    recebidoEm: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : "",
    resumo: m.snippet || "",
    corpoTexto: extractText(m.payload) || m.snippet || "",
    lido: !(m.labelIds || []).includes("UNREAD"),
  };
}

export async function fetchInboxMessages(token, { top = 50 } = {}) {
  const list = await authedFetch(token, `/users/me/messages?maxResults=${top}&labelIds=INBOX`);
  const ids = ((list && list.messages) || []).map((m) => m.id);
  const msgs = await Promise.all(ids.map((id) => authedFetch(token, `/users/me/messages/${id}?format=full`)));
  return msgs.map(mapMessage);
}

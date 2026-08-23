// Chamada crua à Gmail API (estilo corpApi.js/outlookApi.js — fetch puro,
// sem SDK). Devolve o mesmo formato de e-mail normalizado que outlookApi.js
// ({id, assunto, remetente, remetenteNome, recebidoEm, resumo, corpoTexto,
// lido}), pra emailMatching.js/Emails.jsx funcionarem igual pros dois
// provedores.
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

function errorMessage(status) {
  if (status === 401) return "Sessão do Gmail expirada. Conecte de novo.";
  if (status === 403) return "Sem permissão pra essa ação — pode ser preciso reconectar o Gmail pra autorizar o novo escopo.";
  if (status === 429) return "Limite de uso da API do Gmail atingido. Tente novamente em instantes.";
  return `Erro ao consultar o Gmail (HTTP ${status}).`;
}

async function authedFetch(token, path, opts) {
  opts = opts || {};
  let resp;
  try {
    resp = await fetch(GMAIL_BASE + path, {
      method: opts.method || "GET",
      headers: { Authorization: `Bearer ${token}`, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error("Falha de rede ao consultar o Gmail. Verifique sua conexão.");
  }
  if (!resp.ok) throw new Error(errorMessage(resp.status));
  const text = await resp.text();
  return text ? JSON.parse(text) : {};
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

// Anexos de verdade (tem attachmentId, não vêm com o conteúdo já embutido
// como o corpo do texto) — percorre as partes MIME recursivamente.
export function extractAttachments(payload, out) {
  out = out || [];
  if (!payload) return out;
  if (payload.filename && payload.body && payload.body.attachmentId) {
    out.push({ attachmentId: payload.body.attachmentId, filename: payload.filename, mimeType: payload.mimeType || "application/octet-stream", size: payload.body.size || 0 });
  }
  if (payload.parts) payload.parts.forEach((p) => extractAttachments(p, out));
  return out;
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
    // Cabeçalho Message-ID de verdade (RFC 2822) — necessário pra responder
    // no mesmo thread (In-Reply-To/References), diferente do "id" da API.
    messageIdHeader: headerValue(headers, "Message-ID"),
    anexos: extractAttachments(m.payload),
  };
}

export async function fetchInboxMessages(token, { top = 50 } = {}) {
  const list = await authedFetch(token, `/users/me/messages?maxResults=${top}&labelIds=INBOX`);
  const ids = ((list && list.messages) || []).map((m) => m.id);
  const msgs = await Promise.all(ids.map((id) => authedFetch(token, `/users/me/messages/${id}?format=full`)));
  return msgs.map(mapMessage);
}

// Move pra Lixeira do Gmail (reversível por lá, diferente de exclusão
// permanente) — a pedido do usuário, "excluir" aqui.
export async function trashMessage(token, id) {
  await authedFetch(token, `/users/me/messages/${id}/trash`, { method: "POST", body: {} });
}

export async function sendRawMessage(token, raw) {
  return authedFetch(token, "/users/me/messages/send", { method: "POST", body: { raw } });
}

export async function fetchAttachmentData(token, messageId, attachmentId) {
  const data = await authedFetch(token, `/users/me/messages/${messageId}/attachments/${attachmentId}`);
  return data.data || "";
}

// "Pastas" = rótulos do Gmail criados pelo usuário (type "user" — exclui os
// de sistema como INBOX/SENT/SPAM, que não fazem sentido como destino de
// uma regra de organização).
export async function listLabels(token) {
  const data = await authedFetch(token, "/users/me/labels");
  return ((data && data.labels) || []).filter((l) => l.type === "user");
}
export async function createLabel(token, name) {
  return authedFetch(token, "/users/me/labels", {
    method: "POST",
    body: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
  });
}
export async function modifyLabels(token, messageId, { addLabelIds, removeLabelIds }) {
  return authedFetch(token, `/users/me/messages/${messageId}/modify`, {
    method: "POST",
    body: { addLabelIds: addLabelIds || [], removeLabelIds: removeLabelIds || [] },
  });
}

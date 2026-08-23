// Monta a mensagem RFC 2822 crua (base64url) exigida pelo endpoint
// POST /users/me/messages/send da Gmail API — sem biblioteca de e-mail,
// só concatenação de texto (mesma filosofia "sem SDK" do resto do app).
function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_");
}

// "Assunto: Olá" com acento precisa virar um "encoded-word" MIME
// (=?UTF-8?B?...?=) pra não corromper cabeçalho — corpo da mensagem não
// precisa disso, só os headers.
function encodeHeaderText(v) {
  const b64 = btoa(unescape(encodeURIComponent(String(v || ""))));
  return `=?UTF-8?B?${b64}?=`;
}

// contents: { to, cc, subject, body, inReplyTo, references }
// `to`/`cc` já vêm prontos (string, pode ter vários endereços separados
// por vírgula) — validação de formato fica pro usuário revisar antes de
// clicar em Enviar.
export function buildRawMessage({ to, cc, subject, body, inReplyTo, references }) {
  const lines = [];
  lines.push(`To: ${to}`);
  if (cc && String(cc).trim()) lines.push(`Cc: ${String(cc).trim()}`);
  lines.push(`Subject: ${encodeHeaderText(subject || "")}`);
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push("Content-Transfer-Encoding: 8bit");
  lines.push("");
  lines.push(body || "");
  return toBase64Url(lines.join("\r\n"));
}

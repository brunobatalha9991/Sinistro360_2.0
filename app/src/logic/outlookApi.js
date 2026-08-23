// Chamada crua à Microsoft Graph API (estilo de corpApi.js/geminiApi.js —
// fetch puro, sem SDK do Graph). Só leitura (escopo Mail.Read).
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function errorMessage(status) {
  if (status === 401) return "Sessão do Outlook expirada. Conecte de novo.";
  if (status === 403) return "Sem permissão pra ler a caixa de entrada — confira o escopo Mail.Read no App Registration.";
  if (status === 429) return "Limite de uso da Microsoft Graph atingido. Tente novamente em instantes.";
  return `Erro ao consultar o Outlook (HTTP ${status}).`;
}

// Pede o corpo em texto puro (não HTML) via header Prefer — simplifica
// muito a lógica de identificação (evita ter que limpar tags HTML).
export async function fetchInboxMessages(token, { top = 50 } = {}) {
  const params = new URLSearchParams({
    "$top": String(top),
    "$orderby": "receivedDateTime desc",
    "$select": "id,subject,from,receivedDateTime,bodyPreview,body,isRead",
  });
  let resp;
  try {
    resp = await fetch(`${GRAPH_BASE}/me/mailFolders/inbox/messages?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.body-content-type="text"',
      },
    });
  } catch {
    throw new Error("Falha de rede ao consultar o Outlook. Verifique sua conexão.");
  }
  if (!resp.ok) throw new Error(errorMessage(resp.status));
  const data = await resp.json();
  const arr = (data && data.value) || [];
  return arr.map(mapMessage);
}

function mapMessage(m) {
  return {
    id: m.id,
    assunto: m.subject || "(sem assunto)",
    remetente: (m.from && m.from.emailAddress && m.from.emailAddress.address) || "",
    remetenteNome: (m.from && m.from.emailAddress && m.from.emailAddress.name) || "",
    recebidoEm: m.receivedDateTime || "",
    resumo: m.bodyPreview || "",
    corpoTexto: (m.body && m.body.content) || m.bodyPreview || "",
    lido: !!m.isRead,
  };
}

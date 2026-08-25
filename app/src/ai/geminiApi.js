// Camada de chamada crua à API do Gemini (estilo de src/logic/corpApi.js —
// fetch puro, sem SDK). A chave fica exposta no bundle do navegador
// (VITE_GEMINI_API_KEY), igual ao padrão já usado para VITE_FIREBASE_API_KEY.
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function isGeminiConfigured() {
  return !!String(import.meta.env.VITE_GEMINI_API_KEY || "").trim();
}

// Nome do modelo configurável — a Google muda nomes de modelo Gemini com
// frequência, então nunca fixar um valor sem permitir override por env.
export function geminiModel() {
  return import.meta.env.VITE_GEMINI_MODEL || "gemini-3.6-flash";
}

function errorMessage(status, data) {
  const apiMsg = data && data.error && data.error.message;
  if (status === 401 || status === 403) {
    return "Chave da API do Gemini inválida ou sem permissão. Verifique VITE_GEMINI_API_KEY em app/.env.local.";
  }
  if (status === 429) return "Limite de uso da API do Gemini atingido. Tente novamente em instantes.";
  if (status >= 500) return "O serviço do Gemini está indisponível no momento. Tente novamente em instantes.";
  return apiMsg || `Erro ao chamar a API do Gemini (HTTP ${status}).`;
}

// Timeout + 1 nova tentativa automática (a pedido do usuário: as respostas
// estavam demorando muito e "caindo a conexão" com frequência, sem nenhum
// tratamento antes — uma falha de rede passageira ou um 5xx/429 do lado do
// Gemini derrubava o turno inteiro na hora, exigindo reformular a pergunta).
// Sem isso, um fetch sem resposta ficava pendurado indefinidamente (o
// navegador não tem timeout próprio pra fetch).
const REQUEST_TIMEOUT_MS = 30000;
const MAX_TENTATIVAS = 2;

async function fetchComTimeoutERetry(url, options) {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const ultima = tentativa === MAX_TENTATIVAS;
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      // 5xx/429 costumam ser passageiros (sobrecarga momentânea do
      // servidor/limite de uso) — vale tentar de novo antes de desistir.
      if (!ultima && (resp.status >= 500 || resp.status === 429)) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      return resp;
    } catch (e) {
      clearTimeout(timer);
      if (!ultima) { await new Promise((r) => setTimeout(r, 800)); continue; }
      throw e.name === "AbortError"
        ? new Error(`O Gemini demorou mais de ${REQUEST_TIMEOUT_MS / 1000}s para responder. Tente novamente.`)
        : new Error("Falha de rede ao chamar a API do Gemini. Verifique sua conexão.");
    }
  }
}

// contents: array no formato do Gemini [{role:"user"|"model", parts:[{text}|{functionCall}|{functionResponse}]}]
// tools: array de function declarations ({name, description, parameters})
export async function generateContent({ systemInstruction, contents, tools }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("VITE_GEMINI_API_KEY não configurada.");

  const body = {
    contents,
    ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
    ...(tools && tools.length ? { tools: [{ functionDeclarations: tools }] } : {}),
  };

  const resp = await fetchComTimeoutERetry(`${BASE_URL}/${geminiModel()}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await resp.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = null; }

  if (!resp.ok) throw new Error(errorMessage(resp.status, data));

  const candidate = data && data.candidates && data.candidates[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  const text = parts.filter((p) => p.text).map((p) => p.text).join("\n").trim();
  const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

  return { text, functionCalls, parts, raw: data };
}

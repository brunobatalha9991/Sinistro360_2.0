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

  let resp;
  try {
    resp = await fetch(`${BASE_URL}/${geminiModel()}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Falha de rede ao chamar a API do Gemini. Verifique sua conexão.");
  }

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

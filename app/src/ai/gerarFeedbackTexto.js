import { generateContent } from "./geminiApi";

// Camada opcional de IA sobre o Feedback/Plano de ação já calculado por
// regras (logic/desempenho.js#gerarFeedbackEPlanoDeAcao) — só reescreve em
// prosa o que o motor determinístico já decidiu, nunca inventa números
// novos. Usada pelo botão "Gerar versão em texto corrido" no perfil do
// usuário (Desempenho).
export async function gerarFeedbackEmTextoCorrido({ nomeUsuario, periodoLabel, analise }) {
  const linhas = [
    `Usuário: ${nomeUsuario}`,
    `Período analisado: ${periodoLabel}`,
    analise.comparavel ? "Comparação feita com a média do time no mesmo período." : "Time com 1 usuário só neste sistema — sem base de comparação, usando regras absolutas.",
    "",
    "Pontos fortes:",
    analise.pontosFortes.length ? analise.pontosFortes.map((t) => `- ${t}`).join("\n") : "(nenhum ponto forte destacado neste período)",
    "",
    "Pontos de atenção:",
    analise.pontosAtencao.length ? analise.pontosAtencao.map((t) => `- ${t}`).join("\n") : "(nenhum ponto de atenção neste período)",
    "",
    "Plano de ação sugerido:",
    analise.planoDeAcao.map((i) => `- ${i.texto}`).join("\n"),
  ];

  const systemInstruction = [
    "Você reescreve, em português do Brasil, um feedback de desempenho que já foi calculado por regras do sistema — em texto corrido, profissional e construtivo, entre 3 e 6 frases.",
    "NUNCA invente números, nomes, prazos ou fatos que não estejam explicitamente nos dados fornecidos — use só o que foi dado a você.",
    "Não repita a informação em formato de lista/tópicos; escreva em prosa natural.",
    "Termine com uma frase de incentivo ou orientação prática.",
  ].join("\n");

  const { text } = await generateContent({ systemInstruction, contents: [{ role: "user", parts: [{ text: linhas.join("\n") }] }] });
  return text || "Não foi possível gerar o texto agora.";
}

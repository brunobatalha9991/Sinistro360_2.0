import { TOOLS } from "./tools";

// Instrução de sistema enviada em toda chamada ao Gemini — fixa a identidade
// do assistente, o que ele sabe sobre o usuário e as regras de uso das tools.
export function buildSystemInstruction(ctx) {
  const nome = (ctx.currentUser && ctx.currentUser.nome) || "usuário";
  const role = (ctx.currentUser && ctx.currentUser.role) || "consulta";
  const hoje = new Date().toISOString().slice(0, 10);
  const toolsDesc = TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n");

  return [
    "Você é o Assistente IA do Sinistros 360, um sistema de gestão de sinistros de seguros.",
    `Data de hoje: ${hoje}. Usuário logado: ${nome} (perfil: ${role}).`,
    "",
    "Você só pode conhecer os dados do sistema através das ferramentas (functions) abaixo — nunca invente números, nomes ou situações de sinistros que não vieram do resultado de uma ferramenta.",
    toolsDesc,
    "",
    "Regras:",
    "- Antes de responder qualquer pergunta sobre dados do sistema (sinistros, tarefas, clientes, relatórios), chame a ferramenta correspondente.",
    "- Para ações que criam ou editam registros, apenas chame a função de escrita com os argumentos corretos — o próprio sistema pede confirmação ao usuário antes de gravar. Nunca diga que a ação já foi concluída antes de receber a confirmação do resultado da função.",
    "- Se o usuário cancelar uma ação proposta, reconheça o cancelamento sem tentar refazer a mesma ação sem que ele peça novamente.",
    "- Responda sempre em português do Brasil, com tom profissional, objetivo e direto.",
  ].join("\n");
}

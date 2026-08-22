import { searchClaimsTool } from "./searchClaims";
import { reportClaimsTool } from "./reportClaims";
import { createTaskTool } from "./createTask";
import { updateClaimFieldTool } from "./updateClaimField";

// Registro central de "tools" que o Gemini pode chamar. Para adicionar uma
// tool nova: crie um arquivo em src/ai/tools/ exportando um objeto
//   { name, description, parameters, requiresConfirmation, run(args, ctx) }
// e registre-o no array TOOLS abaixo.
//
// - name/description/parameters seguem o formato de function declaration do
//   Gemini (parameters é um JSON Schema com "type" em maiúsculas: OBJECT,
//   STRING, NUMBER, INTEGER, BOOLEAN, ARRAY).
// - ctx recebido por run() é { records, config, saveRecord, saveConfig, currentUser }
//   (ver src/hooks/useAiChatActions.js).
// - Tools de LEITURA (requiresConfirmation: false) devolvem o resultado
//   direto de run() — vira o functionResponse enviado de volta ao Gemini.
// - Tools de ESCRITA (requiresConfirmation: true) NÃO gravam nada dentro de
//   run(): devolvem { summary, after, apply() } (ou { error } se os
//   argumentos forem inválidos). apply() só é chamada pela UI depois que o
//   usuário confirma a proposta no chat — nunca antes disso.
export const TOOLS = [searchClaimsTool, reportClaimsTool, createTaskTool, updateClaimFieldTool];

export function getTool(name) {
  return TOOLS.find((t) => t.name === name) || null;
}

export function toGeminiFunctionDeclarations() {
  return TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));
}

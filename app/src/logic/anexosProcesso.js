// Anexos gerais de um processo (proposta de seguro, dados do segurado etc.)
// — a pedido do usuário, separado do fluxo de Solicitação da Mesa de
// Atendimento: pasta-raiz própria no Drive (CONTEXTO_ANEXOS_PROCESSO, ver
// logic/driveUpload.js), pra não misturar os dois tipos de anexo.
import { sanitizarNomePasta } from "./driveUpload";

// Uma subpasta por processo: "numsin_segurado" (valores já efetivos —
// resolvidos pelo componente antes de chamar esta função).
export function caminhoPastaAnexoProcesso(numsin, segurado) {
  const chave = sanitizarNomePasta(`${numsin || "sem-numero"}_${segurado || "sem-nome"}`);
  return chave;
}

// Autoria dos registros de processo (histórico, auditoria, jornada) — a
// pedido do usuário (2026-10-29), o Desempenho conta a PRODUÇÃO para quem
// de fato fez a ação, não para o responsável pelo processo. Desde então
// cada gravação leva também o id do autor (whoId, concludedById,
// lastInteractionById); registros anteriores (e os gravados por abas
// abertas numa versão antiga) só têm o nome, então cai pra comparação por
// nome — sem acento/caixa/espaços nas pontas.
export function normNome(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

// Auditoria gravada pela jornada (JourneyPanel.jsx) — "Jornada: status
// alterado" / "Jornada: caminho definido".
export const PREFIXO_AUDIT_JORNADA = "Jornada: ";
export function ehAcaoJornada(acao) {
  return String(acao || "").startsWith(PREFIXO_AUDIT_JORNADA);
}

// Histórico vindo de importação em lote (Configurações) não é produção de
// ninguém — é carga de dado legado.
export const CANAL_IMPORTADO = "Dados importado";

// `usuario` = { id, nome }.
export function feitoPor(autorId, autorNome, usuario) {
  if (!usuario || !usuario.id) return false;
  if (autorId) return autorId === usuario.id;
  const n = normNome(autorNome);
  return !!n && n !== "—" && n === normNome(usuario.nome);
}

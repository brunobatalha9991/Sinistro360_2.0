// Porte 1:1 de mapSituacao() do HTML original — traduz o texto cru vindo da
// API CORP para um rótulo + cor de badge padronizados.
export function mapSituacao(s) {
  s = String(s || "").toUpperCase();
  if (s.indexOf("SEM IND") >= 0) return { label: "Encerrado sem Indenização", cls: "gray" };
  if (s.indexOf("INDENIZ") >= 0) return { label: "Indenizado", cls: "green" };
  if (s.indexOf("ENCERR") >= 0) return { label: "Encerrado", cls: "gray" };
  if (s.indexOf("ANDAMENTO") >= 0) return { label: "Em andamento", cls: "amber" };
  if (s.indexOf("PENDENTE") >= 0) return { label: "Pendente", cls: "amber" };
  if (s.indexOf("NEGAD") >= 0 || s.indexOf("RECUS") >= 0) return { label: "Negado", cls: "red" };
  if (s.indexOf("ABERT") >= 0) return { label: "Aberto", cls: "blue" };
  return { label: s || "—", cls: "blue" };
}

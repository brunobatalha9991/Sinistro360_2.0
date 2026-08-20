// Mesmo padrão do "var listFilter" global do HTML original: estado do filtro
// da tela Sinistros, que o Dashboard também escreve ao fazer drill-down
// (clicar num gráfico/KPI leva para Sinistros já filtrado). Vive só em
// memória (reseta ao recarregar a página), igual ao original.
export const listFilter = { status: "todos", tipo: "todos", q: "" };

// Porte 1:1 de dashGoToSinistros() do HTML original.
export function dashGoToSinistros(navigate, dashFilter, patch) {
  listFilter.status = "todos";
  listFilter.tipo = "todos";
  listFilter.etapa = "todos";
  listFilter.q = "";
  listFilter.ocoDe = dashFilter.ocoDe || "";
  listFilter.ocoAte = dashFilter.ocoAte || "";
  listFilter.pa = "";
  listFilter.atrasado = false;
  listFilter.semAtu = false;
  listFilter.caminho = "todos";
  listFilter.showFilters = true;
  if (dashFilter.tipo !== "todos") listFilter.tipo = dashFilter.tipo;
  if (dashFilter.status !== "todos") listFilter.status = dashFilter.status;
  Object.assign(listFilter, patch || {});
  navigate("sinistros");
}

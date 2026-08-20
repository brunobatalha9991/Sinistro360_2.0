// Mesmo padrão do "var listFilter" global do HTML original: estado do filtro
// da tela Sinistros, que sobrevive entre navegações dentro da sessão (não é
// salvo em disco, reseta ao recarregar a página) e que o Dashboard também
// escreve ao fazer drill-down (clicar num gráfico leva para Sinistros já
// filtrado). Aqui vira uma store observável simples para o React re-renderizar
// quando ela mudar.
export const listFilter = {
  status: "todos", tipo: "todos", q: "", showFilters: false,
  etapa: "todos", ocoDe: "", ocoAte: "", aviDe: "", aviAte: "",
  pa: "", atrasado: false, semAtu: false, manual: false, aberto: false,
  caminho: "todos", responsavel: "todos", sitatend: "todas", termometro: "todas",
};

const listeners = new Set();
function notify() { listeners.forEach((fn) => fn()); }

export function patchListFilter(patch) { Object.assign(listFilter, patch); notify(); }
export function subscribeListFilter(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Porte 1:1 de n_limpar() do HTML original — note que "q" (busca) e
// "responsavel" NÃO são limpos por este botão, igual ao original.
export function resetListFilter() {
  patchListFilter({
    tipo: "todos", status: "todos", etapa: "todos",
    ocoDe: "", ocoAte: "", aviDe: "", aviAte: "",
    pa: "", atrasado: false, semAtu: false,
    manual: false, aberto: false, sitatend: "todas", caminho: "todos", termometro: "todas",
  });
}

// Porte 1:1 de dashGoToSinistros() do HTML original.
export function dashGoToSinistros(navigate, dashFilter, patch) {
  const next = {
    status: "todos", tipo: "todos", etapa: "todos", q: "",
    ocoDe: dashFilter.ocoDe || "", ocoAte: dashFilter.ocoAte || "",
    pa: "", atrasado: false, semAtu: false, caminho: "todos", showFilters: true,
  };
  if (dashFilter.tipo !== "todos") next.tipo = dashFilter.tipo;
  if (dashFilter.status !== "todos") next.status = dashFilter.status;
  Object.assign(next, patch || {});
  patchListFilter(next);
  navigate("sinistros");
}

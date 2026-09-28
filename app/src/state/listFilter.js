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
  agente: "todos", grupoProdutor: "todos", oficina: "todas",
  // Seguradora e Ramo (a pedido do usuário: todo campo do Dashboard leva à
  // lista filtrada) — "cia" guarda o RÓTULO agrupado do Dashboard, não o
  // texto cru da API: AZUL/ITAU/MITSI caem todos em "PORT" (ver
  // dashCiaLabel em logic/claims.js), senão o clique na seguradora "PORT"
  // do Dashboard não encontraria processo nenhum.
  cia: "todas", ramo: "todos",
  aguardandoRetornoHist: false, limitacaoComunicacaoHist: false, foraDoPrazo: false,
  terceiroSemVinculo: false, semProdutor: false, semProximaAcao: false,
  // Ver/Ocultar de cada subgrupo dentro do card de filtros (a pedido do
  // usuário: com o card principal aberto, muitos subgrupos de uma vez
  // deixavam a tela poluída) — {chave: true} = aberto; ausente/false =
  // ocultado. Começa tudo ocultado (visão otimizada por padrão); é só
  // preferência de visualização, então "Limpar todos os filtros" não mexe
  // aqui (ver resetListFilter).
  gruposAbertos: {},
};

const listeners = new Set();
function notify() { listeners.forEach((fn) => fn()); }

export function patchListFilter(patch) { Object.assign(listFilter, patch); notify(); }
export function subscribeListFilter(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function toggleFilterGroup(key) {
  const atual = { ...(listFilter.gruposAbertos || {}) };
  atual[key] = !atual[key];
  patchListFilter({ gruposAbertos: atual });
}

// Porte 1:1 de n_limpar() do HTML original — note que "q" (busca) e
// "responsavel" NÃO são limpos por este botão, igual ao original.
export function resetListFilter() {
  patchListFilter({
    tipo: "todos", status: "todos", etapa: "todos",
    ocoDe: "", ocoAte: "", aviDe: "", aviAte: "",
    pa: "", atrasado: false, semAtu: false,
    manual: false, aberto: false, sitatend: "todas", caminho: "todos", termometro: "todas",
    agente: "todos", grupoProdutor: "todos", oficina: "todas", cia: "todas", ramo: "todos",
    aguardandoRetornoHist: false, limitacaoComunicacaoHist: false, foraDoPrazo: false,
    terceiroSemVinculo: false, semProdutor: false, semProximaAcao: false,
  });
}

// Porte de dashGoToSinistros() do HTML original, estendido (a pedido do
// usuário: clicar em qualquer campo do Dashboard tem que abrir a lista com
// EXATAMENTE os processos daquele número). O recorte inteiro do Dashboard
// viaja para a tela Sinistros — não só período/tipo/situação, mas também
// seguradora, ramo, oficina, grupo de produtores, agente e os dois chips
// (manual / em aberto). Cada dimensão volta ao valor "todos" quando está
// desligada no Dashboard, pra não sobrar filtro de uma navegação anterior
// restringindo a lista sem aparecer no gráfico clicado. `patch` é o recorte
// do campo clicado e vem por último, sobrescrevendo o resto.
export function dashGoToSinistros(navigate, dashFilter, patch) {
  const next = {
    status: "todos", tipo: "todos", etapa: "todos", q: "",
    ocoDe: dashFilter.ocoDe || "", ocoAte: dashFilter.ocoAte || "",
    pa: "", atrasado: false, semAtu: false, caminho: "todos", showFilters: true,
    cia: dashFilter.cia && dashFilter.cia !== "todas" ? dashFilter.cia : "todas",
    ramo: dashFilter.ramo && dashFilter.ramo !== "todos" ? dashFilter.ramo : "todos",
    oficina: dashFilter.oficina && dashFilter.oficina !== "todas" ? dashFilter.oficina : "todas",
    grupoProdutor: dashFilter.grupoProdutor && dashFilter.grupoProdutor !== "todos" ? dashFilter.grupoProdutor : "todos",
    agente: dashFilter.agente && dashFilter.agente !== "todos" ? dashFilter.agente : "todos",
    manual: !!dashFilter.manual, aberto: !!dashFilter.aberto,
  };
  if (dashFilter.tipo !== "todos") next.tipo = dashFilter.tipo;
  if (dashFilter.status !== "todos") next.status = dashFilter.status;
  if (dashFilter.caminho && dashFilter.caminho !== "todos") next.caminho = dashFilter.caminho;
  Object.assign(next, patch || {});
  patchListFilter(next);
  navigate("sinistros");
}

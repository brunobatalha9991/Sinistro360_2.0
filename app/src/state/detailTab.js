// Mesmo padrão do "var detailTab" global do HTML original — a aba ativa do
// detalhe do sinistro persiste entre navegações dentro da sessão.
let detailTab = "jornada";
const listeners = new Set();

export function getDetailTab() { return detailTab; }
export function setDetailTab(tab) {
  detailTab = tab;
  listeners.forEach((fn) => fn());
}
export function subscribeDetailTab(fn) { listeners.add(fn); return () => listeners.delete(fn); }

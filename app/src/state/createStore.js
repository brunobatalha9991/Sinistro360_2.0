// Fábrica pequena para os "var globais" reativos do HTML original
// (taskFilter, window.demandaFilter, notifPanelOpen) — estado que vive só
// em memória (reseta ao recarregar a página) e precisa avisar o React
// quando muda.
export function createStore(initial) {
  const state = { ...initial };
  const listeners = new Set();
  function notify() { listeners.forEach((fn) => fn()); }
  return {
    state,
    patch(p) { Object.assign(state, p); notify(); },
    set(next) { Object.assign(state, next); notify(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

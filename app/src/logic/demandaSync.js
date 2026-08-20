export const FORM_SLOTS = 7;

function fetchFormResponses(url) {
  if (!url) return Promise.resolve([]);
  return fetch(url).then((r) => r.text()).then((txt) => {
    let d;
    try { d = JSON.parse(txt); } catch { throw new Error("Resposta do formulário não é um JSON válido. Confira o link do Apps Script."); }
    return Array.isArray(d) ? d : d.respostas || d.responses || d.data || d.itens || [];
  });
}
function respId(formKey, raw) {
  const base = raw.id || raw.responseId || raw.timestamp || raw.data || JSON.stringify(raw.campos || raw.fields || raw);
  return "dem_" + formKey + "_" + String(base).replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
}
function respCampos(raw) { return raw.campos || raw.fields || raw.answers || raw.respostas || raw; }

// Busca as respostas de todos os formulários configurados, mescla as novas em
// corp_demandas (sem duplicar, sem perder demanda criada por outro
// usuário/aba durante a espera pela rede — o merge acontece dentro do
// updater do saveRecord) e notifica todo mundo se achar demanda nova.
// Usado tanto pelo botão manual em Demandas.jsx quanto pelo sync automático
// de 5 em 5 minutos (useAutoSyncDemandas).
export function runDemandaSync({ cfg, users, saveRecord }) {
  const newItems = {};
  let chain = Promise.resolve();
  for (let n = 1; n <= FORM_SLOTS; n++) {
    const url = cfg["url" + n];
    const nome = cfg["nome" + n] || `Formulário ${n}`;
    const formKey = "f" + n;
    if (!url) continue;
    chain = chain.then(() => fetchFormResponses(url).then((arr) => {
      (arr || []).forEach((raw) => {
        const id = respId(formKey, raw);
        newItems[id] = { id, formKey, formNome: nome, campos: respCampos(raw), recebidoEm: new Date().toISOString(), lida: false, timestamp: raw.timestamp || raw.data || "" };
      });
    }).catch(() => { /* se um form falhar, os outros continuam */ }));
  }
  return chain.then(() => {
    let novos = 0, total = 0;
    saveRecord("corp_demandas", (current) => {
      const byId = {};
      (current || []).forEach((d) => { byId[d.id] = d; });
      Object.keys(newItems).forEach((id) => { if (!byId[id]) { byId[id] = newItems[id]; novos++; } });
      const lista = Object.values(byId);
      total = lista.length;
      return lista;
    });
    if (novos > 0) {
      const todos = users.map((u) => u.id);
      saveRecord("corp_notifs", (current) => {
        const arr = [...(current || [])];
        todos.forEach((uid) => arr.push({ id: "ntf_" + Math.random().toString(36).slice(2, 9), taskId: "__demanda__", userId: uid, text: `${novos} nova(s) demanda(s) recebida(s) de formulário`, at: new Date().toISOString(), read: false }));
        return arr;
      });
    }
    return { novos, total };
  });
}

// Preferência de colunas da tabela de Sinistros — porte 1:1 do original.
// Fica só no localStorage deste navegador (NÃO faz parte de CONFIG_KEYS/
// RECORD_SPECS no sync com Firestore no HTML original), então aqui também
// fica de fora da camada de dados multiusuário — é preferência pessoal de
// exibição, não dado do negócio.
export const COLS_KEY = "corp_cols_pref";
export const DEFAULT_COLS = {
  order: ["tipo", "origem", "numsin", "segurado", "placa", "cia", "ramo", "situacao", "vinculos", "acoes"],
  widths: {},
};

export function loadCols() {
  try {
    const v = JSON.parse(localStorage.getItem(COLS_KEY));
    if (v && v.order) return v;
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_COLS));
}
export function saveCols(v) { localStorage.setItem(COLS_KEY, JSON.stringify(v)); }

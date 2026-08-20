// Porte 1:1 dos formatadores/utilitários numéricos do HTML original.
export const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#9333ea", "#0891b2", "#64748b", "#db2777", "#65a30d", "#ea580c", "#0ea5e9", "#a16207"];

export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function fmtDateBR(iso) {
  if (!iso) return "—";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
export function money(v) {
  v = Number(v) || 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function txt(v) { return v == null || v === "" ? "—" : String(v); }

export function diasEntre(a, b) {
  if (!a || !b) return null;
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round((db - da) / 86400000);
}
export function mediaArr(arr) {
  if (!arr || !arr.length) return null;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}
export function fmtDias(n) {
  return n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " d";
}
export function fmtPct(n) {
  return n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + "%";
}
export function fmtNum(n) { return n == null ? "—" : Number(n).toLocaleString("pt-BR"); }
export function monthLabel(ym) {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const p = String(ym).split("-");
  return meses[Number(p[1]) - 1] + "/" + p[0].slice(2);
}
export function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback || "";
  } catch { return fallback || ""; }
}

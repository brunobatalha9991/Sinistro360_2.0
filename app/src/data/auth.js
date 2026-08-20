// Autenticação/sessão — mesma lógica do sistema original: usuários próprios
// (não Firebase Auth), sessão em sessionStorage (some ao fechar a aba/navegador).
export const SESSION_KEY = "corp_session";

export const ROLE_LABELS = {
  admin: "Administrador",
  analista: "Analista",
  atendente: "Atendente",
  consulta: "Consulta",
};

export const MODULOS_DISPONIVEIS = [
  ["dashboard", "Dashboard"], ["sinistros", "Sinistros"], ["abertura", "Abertura"],
  ["demandas", "Nova Demanda"], ["tarefas", "Comunicação"], ["clientes", "Clientes"],
  ["seguradoras", "Seguradoras"], ["oficinas", "Oficinas"], ["relatorios", "Relatórios"],
  ["integracao", "Integração CORP"], ["config", "Configurações"],
];

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
}
export function setSession(s) {
  if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(SESSION_KEY);
}

export function findUserById(users, id) {
  return (users || []).find((u) => u.id === id) || null;
}
export function findUserByEmail(users, email) {
  const e = String(email || "").trim().toLowerCase();
  return (users || []).find((u) => String(u.email).trim().toLowerCase() === e) || null;
}

export function userModulos(u) {
  if (!u) return [];
  if (u.role === "admin") return MODULOS_DISPONIVEIS.map((m) => m[0]);
  if (!u.modulos || !u.modulos.length) return MODULOS_DISPONIVEIS.map((m) => m[0]);
  return u.modulos;
}

export function isAdmin(user) { return user?.role === "admin"; }
export function canEdit(user) {
  const r = user?.role;
  return r === "admin" || r === "analista" || r === "atendente";
}

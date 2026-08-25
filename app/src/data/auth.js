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
  ["assistente", "Assistente IA"],
  ["desempenho", "Desempenho"],
  ["emails", "E-mails"],
  ["integracao", "Integração CORP"], ["config", "Configurações"],
];

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
}
export function setSession(s) {
  if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(SESSION_KEY);
}

// "Visão VIP" liga/desliga (a pedido do usuário) — só quem tem VIP
// concedido (u.vip) vê o botão; ligar/desligar é uma escolha pessoal de
// como ver o sistema nesta aba/sessão, não altera o VIP concedido pelo
// admin. Guardado por usuário pra não vazar de um usuário VIP pro
// próximo que logar na mesma aba.
export function getVipViewOff(userId) {
  try { return sessionStorage.getItem("corp_vip_view_off_" + userId) === "1"; } catch { return false; }
}
export function setVipViewOff(userId, off) {
  try {
    if (off) sessionStorage.setItem("corp_vip_view_off_" + userId, "1");
    else sessionStorage.removeItem("corp_vip_view_off_" + userId);
  } catch { /* ignore */ }
}

export function findUserById(users, id) {
  return (users || []).find((u) => u.id === id) || null;
}
export function findUserByEmail(users, email) {
  const e = String(email || "").trim().toLowerCase();
  return (users || []).find((u) => String(u.email).trim().toLowerCase() === e) || null;
}

// "VIP" (a pedido do usuário): um usuário mantém a função exibida
// (Atendente/Analista/Consulta) mas passa a ter todos os acessos de um
// Administrador — ver isAdmin(). Concedido/removido em Configurações →
// Usuários & Acesso (UsersCard.jsx), guardado em u.vip.
export function userModulos(u) {
  if (!u) return [];
  if (isAdmin(u)) return MODULOS_DISPONIVEIS.map((m) => m[0]);
  if (!u.modulos || !u.modulos.length) return MODULOS_DISPONIVEIS.map((m) => m[0]);
  return u.modulos;
}

export function isAdmin(user) { return !!(user?.role === "admin" || user?.vip); }
export function canEdit(user) {
  if (isAdmin(user)) return true;
  const r = user?.role;
  return r === "analista" || r === "atendente";
}

// Porte 1:1 das guardas de rota do render() original: impede acessar por URL
// uma tela fora do que o papel/usuário tem permissão de ver. VIP passa por
// todas essas guardas como se fosse admin, mesmo com currentRole/role
// exibindo a função original.
export function resolveAllowedRoute(route, currentUser, currentRole) {
  let r = route;
  if (r === "config" && !isAdmin(currentUser)) r = "dashboard";
  if (currentRole === "consulta" && !isAdmin(currentUser) && r !== "sinistros" && r !== "sinistro" && r !== "tarefas") {
    r = "sinistros";
  }
  if (currentUser && !isAdmin(currentUser)) {
    const perm = userModulos(currentUser);
    const rotaMod = r === "sinistro" ? "sinistros" : r === "oficina" ? "oficinas" : r === "seguradora" ? "seguradoras" : r === "cliente" ? "clientes" : r;
    if (perm.indexOf(rotaMod) < 0) {
      const primeiro = perm[0] || "sinistros";
      r = primeiro === "sinistro" ? "sinistros" : primeiro;
    }
  }
  return r;
}

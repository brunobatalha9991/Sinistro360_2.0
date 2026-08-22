import { useEffect, useState } from "react";
import { Icon } from "./icons.jsx";
import { NotifBell } from "./NotifBell.jsx";
import { ROLE_LABELS, userModulos } from "../data/auth";
import { useData } from "../data/DataProvider.jsx";
import { visibleClaims, isAtrasado } from "../logic/claims";
import { myUnreadCount, demandaUnreadCount } from "../logic/tasks";

const SIDEBAR_KEY = "corp_sidebar_collapsed";

export const MENU = [
  ["dashboard", "Dashboard", "dashboard"],
  ["sinistros", "Sinistros", "sinistros"],
  ["abertura", "Abertura", "abertura"],
  ["demandas", "Nova Demanda", "demandas"],
  ["tarefas", "Comunicação", "comunicacao"],
  ["clientes", "Clientes", "clientes"],
  ["seguradoras", "Seguradoras", "seguradoras"],
  ["oficinas", "Oficinas", "oficinas"],
  ["relatorios", "Relatórios", "relatorios"],
  ["assistente", "Assistente IA", "assistente"],
  ["desempenho", "Desempenho", "desempenho"],
  ["integracao", "Integração CORP", "integracao"],
  ["config", "Configurações", "config"],
];

function visibleMenu(currentUser, currentRole) {
  let menu = MENU;
  if (currentRole === "consulta") {
    menu = menu.filter((m) => m[0] === "sinistros" || m[0] === "tarefas");
  }
  if (currentUser && currentUser.role !== "admin") {
    const perm = userModulos(currentUser);
    menu = menu.filter((m) => perm.indexOf(m[0]) >= 0);
  }
  return menu;
}

export function Shell({ route, param, crumb, currentUser, currentRole, onNavigate, onLogout, theme, onToggleTheme, children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; }
  });

  function toggleSidebar() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  function collapseSidebar() {
    setCollapsed(true);
    try { localStorage.setItem(SIDEBAR_KEY, "1"); } catch { /* ignore */ }
  }

  // Minimiza o menu sozinho ao clicar em qualquer módulo (abaixo, no <nav>)
  // e também ao entrar em um processo de sinistro, mesmo vindo de fora do
  // menu lateral (linha da lista de Sinistros, link de outra tela...) — só
  // reage quando o menu está aberto, nunca briga com uma reabertura manual.
  useEffect(() => {
    if (route === "sinistro" && !collapsed) collapseSidebar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, param]);

  function handleNavigate(target) {
    if (!collapsed) collapseSidebar();
    onNavigate(target);
  }

  const { records } = useData();
  const menu = visibleMenu(currentUser, currentRole);
  const nome = currentUser?.nome || "Usuário";
  const initials = nome.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const isDark = theme === "dark";

  const overrides = records.corp_overrides || {};
  const atrasadosGlobal = visibleClaims(records.corp_claims).filter((c) => isAtrasado(overrides, c)).length;
  const demandaUnread = demandaUnreadCount(records.corp_demandas);
  const notifUnread = myUnreadCount(records.corp_notifs, currentUser);

  return (
    <div className="app">
      <div className={"sidebar" + (collapsed ? " collapsed" : "")}>
        <div className="brand">
          <Icon name="pulse" />
          <span>Sinistro360</span>
        </div>
        <nav>
          {menu.map((m) => {
            let cls = route === m[0] ? "active" : "";
            if (m[0] === "demandas" && demandaUnread > 0) cls += " blink-demanda";
            if (m[0] === "tarefas" && notifUnread > 0) cls += " blink-demanda";
            return (
              <a key={m[0]} className={cls} title={m[1]} onClick={() => handleNavigate(m[0])}>
                <Icon name={m[2]} />
                <span className="nav-label">{m[1]}</span>
                {m[0] === "sinistros" && atrasadosGlobal > 0 && (
                  <span className="nav-dot" title={`${atrasadosGlobal} processo(s) atrasado(s)`} />
                )}
              </a>
            );
          })}
        </nav>
        <div className="ver">v3.0 • Integração CORP</div>
      </div>

      <div className="main">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              className="sidebar-toggle" type="button"
              title={collapsed ? "Expandir menu" : "Recolher menu"}
              onClick={toggleSidebar}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="crumb">
              <span className="crumb-brand">Sinistro360</span>
              <span className="crumb-sep">›</span>
              <span>{crumb || ""}</span>
            </div>
          </div>
          <div className="user">
            <NotifBell />
            <button
              className="theme-toggle" type="button" aria-label="Alternar tema"
              title={isDark ? "Ativar modo claro" : "Ativar modo escuro fosco"}
              onClick={onToggleTheme}
            >
              <span className="theme-toggle-track">
                <span className="theme-toggle-thumb"><Icon name={isDark ? "moon" : "sun"} /></span>
              </span>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={"badge " + (currentUser?.role === "admin" ? "purple" : currentUser?.role === "consulta" ? "gray" : "blue")}>
                {currentUser ? `${currentUser.nome} • ${ROLE_LABELS[currentUser.role]}` : "—"}
              </span>
              <button className="btn sec sm" onClick={onLogout}>Sair</button>
            </div>
            <div className="avatar">{initials}</div>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

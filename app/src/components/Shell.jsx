import { useState } from "react";
import { Icon } from "./icons.jsx";
import { ROLE_LABELS, userModulos } from "../data/auth";

const SIDEBAR_KEY = "corp_sidebar_collapsed";

export const MENU = [
  ["dashboard", "Dashboard", "dashboard"],
  ["sinistros", "Sinistros", "sinistros"],
  ["abertura", "Abertura", "abertura"],
  ["demandas", "Nova Demanda", "sinistros"],
  ["tarefas", "Comunicação", "integracao"],
  ["clientes", "Clientes", "clientes"],
  ["seguradoras", "Seguradoras", "seguradoras"],
  ["oficinas", "Oficinas", "oficinas"],
  ["relatorios", "Relatórios", "relatorios"],
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

export function Shell({ route, crumb, currentUser, currentRole, onNavigate, onLogout, theme, onToggleTheme, children }) {
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

  const menu = visibleMenu(currentUser, currentRole);
  const nome = currentUser?.nome || "Usuário";
  const initials = nome.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const isDark = theme === "dark";

  return (
    <div className="app">
      <div className={"sidebar" + (collapsed ? " collapsed" : "")}>
        <div className="brand">
          <Icon name="pulse" />
          <span>Sinistro360</span>
        </div>
        <nav>
          {menu.map((m) => (
            <a
              key={m[0]}
              className={route === m[0] ? "active" : ""}
              title={m[1]}
              onClick={() => onNavigate(m[0])}
            >
              <Icon name={m[2]} />
              <span>{m[1]}</span>
            </a>
          ))}
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
            <button className="notif-btn" type="button" title="Notificações">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
            </button>
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

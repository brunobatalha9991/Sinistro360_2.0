import { useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { useHashRoute } from "./hooks/useHashRoute";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { Shell, MENU } from "./components/Shell.jsx";
import { useData } from "./data/DataProvider.jsx";
import { PAGES } from "./pages/index.js";
import { resolveAllowedRoute } from "./data/auth";

// Etapa 3: telas de negócio vão sendo ligadas aqui uma a uma (ver PAGES).
// O que ainda não tem tela própria continua neste placeholder.
function PagePlaceholder({ route, label }) {
  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>{label}</h1>
          <p>Esta tela ainda será portada na Etapa 3 (rota: {route}).</p>
        </div>
      </div>
      <div className="card">
        <div className="muted" style={{ padding: 30, textAlign: "center" }}>
          Placeholder — o conteúdo desta tela ainda não foi portado.
        </div>
      </div>
    </div>
  );
}

function App() {
  const { mode } = useData();
  const { currentUser, currentRole, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { route, navigate } = useHashRoute();

  const allowedRoute = currentUser ? resolveAllowedRoute(route, currentUser, currentRole) : route;

  useEffect(() => {
    if (currentUser && allowedRoute !== route) navigate(allowedRoute);
  }, [currentUser, allowedRoute, route, navigate]);

  if (!currentUser) {
    return <LoginScreen onLogin={login} />;
  }

  const menuItem = MENU.find((m) => m[0] === allowedRoute);
  const label = menuItem ? menuItem[1] : "Dashboard";
  const PageComponent = PAGES[allowedRoute];

  return (
    <>
      {mode === "offline" && (
        <div style={{ background: "#fef3c7", color: "#92400e", fontSize: 12, textAlign: "center", padding: "4px 8px" }}>
          Modo offline (dados fictícios) — nenhuma leitura/escrita no Firebase de produção.
        </div>
      )}
      <Shell
        route={allowedRoute}
        crumb={label}
        currentUser={currentUser}
        currentRole={currentRole}
        onNavigate={navigate}
        onLogout={logout}
        theme={theme}
        onToggleTheme={toggleTheme}
      >
        {PageComponent ? <PageComponent /> : <PagePlaceholder route={allowedRoute} label={label} />}
      </Shell>
    </>
  );
}

export default App;

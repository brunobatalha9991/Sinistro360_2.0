import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { useHashRoute } from "./hooks/useHashRoute";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { Shell, MENU } from "./components/Shell.jsx";
import { useData } from "./data/DataProvider.jsx";

// Etapa 2: casca visual completa (login, sidebar, topbar, tema) já ligada à
// camada de dados offline. O conteúdo de cada tela (Dashboard, Sinistros...)
// entra na Etapa 3, uma por vez.
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
          Placeholder da Etapa 2 — só a casca (menu, topo, tema) está pronta aqui.
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

  if (!currentUser) {
    return <LoginScreen onLogin={login} />;
  }

  const menuItem = MENU.find((m) => m[0] === route);
  const label = menuItem ? menuItem[1] : "Dashboard";

  return (
    <>
      {mode === "offline" && (
        <div style={{ background: "#fef3c7", color: "#92400e", fontSize: 12, textAlign: "center", padding: "4px 8px" }}>
          Modo offline (dados fictícios) — nenhuma leitura/escrita no Firebase de produção.
        </div>
      )}
      <Shell
        route={route}
        crumb={label}
        currentUser={currentUser}
        currentRole={currentRole}
        onNavigate={navigate}
        onLogout={logout}
        theme={theme}
        onToggleTheme={toggleTheme}
      >
        <PagePlaceholder route={route} label={label} />
      </Shell>
    </>
  );
}

export default App;

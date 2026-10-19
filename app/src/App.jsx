import { Suspense, useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { useHashRoute } from "./hooks/useHashRoute";
import { useAutoSyncDemandas } from "./hooks/useAutoSyncDemandas";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { Shell, MENU } from "./components/Shell.jsx";
import { useData } from "./data/DataProvider.jsx";
import { PAGES } from "./pages/index.js";
import { resolveAllowedRoute } from "./data/auth";

// Fallback defensivo — só aparece se a rota não corresponder a nenhuma
// tela registrada em PAGES (não deveria acontecer via navegação normal).
function PageNotFound({ route, label }) {
  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>{label}</h1>
          <p>Rota desconhecida: {route}.</p>
        </div>
      </div>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="page-enter" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
      Carregando...
    </div>
  );
}

function App() {
  const { mode } = useData();
  const { currentUser, currentRole, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { route, param, navigate } = useHashRoute();
  useAutoSyncDemandas(currentUser);

  const allowedRoute = currentUser ? resolveAllowedRoute(route, currentUser, currentRole) : route;

  useEffect(() => {
    if (currentUser && allowedRoute !== route) navigate(allowedRoute);
  }, [currentUser, allowedRoute, route, navigate]);

  if (!currentUser) {
    return <LoginScreen onLogin={login} />;
  }

  const menuItem = MENU.find((m) => m[0] === allowedRoute);
  const label = allowedRoute === "sinistro" ? "Sinistros / Detalhe"
    : allowedRoute === "oficina" ? "Oficinas / Detalhe"
    : allowedRoute === "seguradora" ? "Seguradoras / Detalhe"
    : allowedRoute === "cliente" ? "Clientes / Detalhe"
    : menuItem ? menuItem[1] : "Dashboard";
  const PageComponent = PAGES[allowedRoute];

  return (
    <>
      <SyncBanner />
      {mode === "offline" && (
        <div className="offline-banner" style={{ background: "#fef3c7", color: "#92400e", fontSize: 12, textAlign: "center", padding: "4px 8px" }}>
          Modo offline (dados fictícios) — nenhuma leitura/escrita no Firebase de produção.
        </div>
      )}
      <Shell
        route={allowedRoute}
        param={param}
        crumb={label}
        currentUser={currentUser}
        currentRole={currentRole}
        onNavigate={navigate}
        onLogout={logout}
        theme={theme}
        onToggleTheme={toggleTheme}
      >
        <Suspense fallback={<PageLoading />}>
          {PageComponent ? <PageComponent /> : <PageNotFound route={allowedRoute} label={label} />}
        </Suspense>
      </Shell>
    </>
  );
}

export default App;

// Aviso de gravação não confirmada pelo Firebase (bug relatado 2026-10-19:
// processos criados sumiram ao atualizar a página porque a gravação nunca
// chegou ao servidor, e nada avisava). Só aparece se a gravação demorar
// mais de 5s ou falhar — gravações normais levam menos de 1s.
function SyncBanner() {
  const { syncStatus } = useData();
  const [, setTick] = useState(0);
  const pendingSince = syncStatus && syncStatus.pendingSince;
  useEffect(() => {
    if (!pendingSince) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [pendingSince]);
  if (!syncStatus) return null;
  const atrasado = pendingSince && Date.now() - pendingSince > 5000;
  if (!syncStatus.error && !atrasado) return null;
  return (
    <div style={{ background: "#fee2e2", color: "#991b1b", fontSize: 13, fontWeight: 600, textAlign: "center", padding: "6px 10px" }}>
      {syncStatus.error
        ? `⚠ Falha ao salvar no servidor (${syncStatus.error}). A última alteração NÃO foi salva — anote o que fez, atualize a página (F5) e refaça. Se repetir, avise o suporte.`
        : "⏳ Salvando no servidor... sem confirmação ainda. Verifique sua internet e NÃO feche a página até este aviso sumir."}
    </div>
  );
}

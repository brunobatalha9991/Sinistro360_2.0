import { useMemo } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { useDetailTab } from "../hooks/useDetailTab";
import { useOverrideActions } from "../hooks/useOverrideActions";
import { EmptyState } from "../components/EmptyState.jsx";
import { DetailHeader } from "../components/detail/DetailHeader.jsx";
import { JourneyPanel } from "../components/detail/JourneyPanel.jsx";
import { GeralPanel } from "../components/detail/GeralPanel.jsx";
import { AtendimentoPanel } from "../components/detail/AtendimentoPanel.jsx";
import { FinancePanel } from "../components/detail/FinancePanel.jsx";
import { CommsPanel } from "../components/detail/CommsPanel.jsx";
import { NextActionPanel } from "../components/detail/NextActionPanel.jsx";
import { LinksPanel } from "../components/detail/LinksPanel.jsx";
import { AuditPanel } from "../components/detail/AuditPanel.jsx";
import { visibleClaims, relatedClaims } from "../logic/claims";
import { mapSituacao } from "../logic/situacao";
import { isAdmin, canEdit as canEditRole } from "../data/auth";

// Porte 1:1 de Pages.sinistro() do HTML original — o detalhe do sinistro,
// com todas as abas (jornada, visão geral, histórico, próxima ação,
// financeiro, atendimento, vínculos, auditoria, dados brutos).
export function Sinistro() {
  const { records, config } = useData();
  const { param, navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const [detailTab, setDetailTab] = useDetailTab();
  const actions = useOverrideActions();

  const claims = useMemo(() => visibleClaims(records.corp_claims), [records.corp_claims]);
  const allClaimsRaw = records.corp_claims || [];
  const overrides = records.corp_overrides || {};
  const users = records.corp_users || [];

  const c = claims.find((x) => x.id === param);
  if (!c) {
    return (
      <div className="page-enter">
        <EmptyState>Registro não encontrado.</EmptyState>
      </div>
    );
  }

  const sit = mapSituacao(c.situacao);
  const rel = relatedClaims(overrides, allClaimsRaw, c);
  const canEdit = canEditRole(currentUser);
  const isAdminUser = isAdmin(currentUser);

  const tabs = [
    ["jornada", "Jornada do cliente"],
    ["geral", "Visão geral"],
    ["historico", "Histórico"],
    ["proxima", "Próxima ação"],
    ["financeiro", "Financeiro"],
    ["atendimento", "Atendimento"],
    ["vinculos", `Vínculos (${rel.length})`],
    ["auditoria", "Auditoria Interna"],
    ["raw", "Dados brutos (API)"],
  ];

  function renderPanel() {
    switch (detailTab) {
      case "jornada": return <JourneyPanel c={c} overrides={overrides} config={config} actions={actions} canEdit={canEdit} isAdminUser={isAdminUser} navigate={navigate} />;
      case "historico": return <CommsPanel c={c} overrides={overrides} actions={actions} canEdit={canEdit} />;
      case "proxima": return <NextActionPanel c={c} overrides={overrides} actions={actions} canEdit={canEdit} />;
      case "auditoria": return <AuditPanel c={c} overrides={overrides} />;
      case "vinculos": return <LinksPanel c={c} claims={claims} allClaimsRaw={allClaimsRaw} overrides={overrides} actions={actions} navigate={navigate} setDetailTab={setDetailTab} />;
      case "geral": return <GeralPanel c={c} claims={claims} overrides={overrides} actions={actions} canEdit={canEdit} />;
      case "financeiro": return <FinancePanel c={c} overrides={overrides} actions={actions} canEdit={canEdit} />;
      case "atendimento": return <AtendimentoPanel c={c} claims={claims} overrides={overrides} actions={actions} canEdit={canEdit} />;
      case "raw": return (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Resposta bruta da API</h3>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#0f172a", color: "#a5f3fc", padding: 14, borderRadius: 8, overflow: "auto" }}>
            {JSON.stringify(c._raw, null, 2)}
          </pre>
        </div>
      );
      default: return null;
    }
  }

  return (
    <div className="page-enter" key={c.id}>
      <DetailHeader
        c={c} sit={sit} rel={rel} claims={claims} allClaimsRaw={allClaimsRaw} overrides={overrides}
        users={users} currentUser={currentUser} isAdminUser={isAdminUser} canEdit={canEdit}
        actions={actions} navigate={navigate} setDetailTab={setDetailTab}
      />
      <div className="tabs">
        {tabs.map(([key, label]) => (
          <div key={key} className={"tab" + (detailTab === key ? " active" : "")} onClick={() => setDetailTab(key)}>{label}</div>
        ))}
      </div>
      <div id="panel">{renderPanel()}</div>
    </div>
  );
}

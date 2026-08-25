import { useEffect, useMemo, useRef } from "react";
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
import { AnexosPanel } from "../components/detail/AnexosPanel.jsx";
import { PesquisaSatisfacaoPanel } from "../components/detail/PesquisaSatisfacaoPanel.jsx";
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
  // Lembrete ao sair do processo (a pedido do usuário): se o usuário mexeu
  // em qualquer coisa aqui (histórico, jornada, próxima ação, responsável,
  // termômetro, situação de atendimento etc.) durante esta visita, ao
  // navegar pra fora um alerta lembra de manter tudo em dia — não bloqueia
  // a navegação, só avisa logo depois dela acontecer. `saveAgenteProdutor`
  // fica de fora: é gravado sozinho em segundo plano (cache do /documento
  // do CORP), não é uma ação que o usuário decidiu fazer.
  const interagiuRef = useRef(false);
  const trackedActions = useMemo(() => {
    const wrapped = {};
    Object.keys(actions).forEach((k) => {
      if (typeof actions[k] === "function" && k !== "saveAgenteProdutor") {
        wrapped[k] = (...args) => { interagiuRef.current = true; return actions[k](...args); };
      } else {
        wrapped[k] = actions[k];
      }
    });
    return wrapped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  const allClaimsRaw = records.corp_claims || [];
  const overrides = records.corp_overrides || {};
  const users = records.corp_users || [];
  // overrides/currentUser aplicam o vínculo de acesso por Agente/Produtor
  // (usuários "Consulta" vinculados) — acesso direto por URL a um processo
  // fora do vínculo cai no mesmo "Registro não encontrado" de baixo, sem
  // vazar que o processo existe.
  const claims = useMemo(() => visibleClaims(records.corp_claims, overrides, currentUser), [records.corp_claims, overrides, currentUser]);

  const c = claims.find((x) => x.id === param);
  // Toda vez que um processo é aberto, começa na "Jornada do cliente" (a
  // pedido do usuário) — sem isso, a aba ficava com a última usada em
  // QUALQUER processo (detailTab é um estado global, não por processo).
  useEffect(() => {
    if (c) setDetailTab("jornada");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c && c.id]);
  // Dispara o lembrete (ver trackedActions acima) ao sair DESTE processo —
  // troca de processo ou saída do módulo, tanto faz, sempre que
  // interagiuRef estiver marcado.
  useEffect(() => {
    interagiuRef.current = false;
    return () => {
      if (interagiuRef.current) {
        alert("Lembrete: mantenha o Histórico, a Jornada do cliente, a Situação, o Termômetro, o Responsável e a Próxima ação sempre em dia.");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c && c.id]);
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
  const isConsulta = currentUser?.role === "consulta" && !isAdminUser;

  const tabs = [
    ["jornada", "Jornada do cliente"],
    ["geral", "Visão geral"],
    ["historico", "Histórico"],
    ["proxima", "Próxima ação"],
    ["financeiro", "Financeiro"],
    ["atendimento", "Atendimento"],
    ["vinculos", `Vínculos (${rel.length})`],
    ["satisfacao", "Pesquisa de satisfação"],
    ["anexos", "Anexos"],
    ...(isConsulta ? [] : [
      ["auditoria", "Auditoria Interna"],
      ["raw", "Dados brutos (API)"],
    ]),
  ];

  function renderPanel() {
    switch (detailTab) {
      case "jornada": return <JourneyPanel c={c} overrides={overrides} config={config} actions={trackedActions} canEdit={canEdit} isAdminUser={isAdminUser} currentUser={currentUser} navigate={navigate} />;
      case "historico": return <CommsPanel c={c} overrides={overrides} actions={trackedActions} canEdit={canEdit} config={config} clientes={records.corp_clientes || {}} />;
      case "proxima": return <NextActionPanel c={c} overrides={overrides} actions={trackedActions} canEdit={canEdit} />;
      case "auditoria": return isConsulta ? null : <AuditPanel c={c} overrides={overrides} records={records} />;
      case "vinculos": return <LinksPanel c={c} claims={claims} allClaimsRaw={allClaimsRaw} overrides={overrides} actions={trackedActions} navigate={navigate} setDetailTab={setDetailTab} />;
      case "satisfacao": return <PesquisaSatisfacaoPanel c={c} overrides={overrides} actions={trackedActions} canEdit={canEdit} atendTemplateCfg={config.corp_atendimento_template} />;
      case "anexos": return <AnexosPanel c={c} overrides={overrides} config={config} actions={trackedActions} canEdit={canEdit} currentUser={currentUser} />;
      case "geral": return <GeralPanel c={c} claims={claims} overrides={overrides} actions={trackedActions} canEdit={canEdit} config={config} navigate={navigate} />;
      case "financeiro": return <FinancePanel c={c} overrides={overrides} actions={trackedActions} canEdit={canEdit} />;
      case "atendimento": return <AtendimentoPanel c={c} claims={claims} overrides={overrides} actions={trackedActions} canEdit={canEdit} />;
      case "raw": return isConsulta ? null : (
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
        actions={trackedActions} navigate={navigate} setDetailTab={setDetailTab}
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

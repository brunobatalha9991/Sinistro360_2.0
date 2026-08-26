import { useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { useSeguradoraActions } from "../hooks/useSeguradoraActions";
import { EmptyState } from "../components/EmptyState.jsx";
import { visibleClaims } from "../logic/claims";
import { canEdit as canEditRole } from "../data/auth";
import { seguradoraNomeFromId, seguradoraClaims } from "../logic/seguradoras";
import { CadastroPanel } from "../components/seguradora/CadastroPanel.jsx";
import { AtendimentosPanel } from "../components/seguradora/AtendimentosPanel.jsx";
import { OcorrenciasPanel } from "../components/seguradora/OcorrenciasPanel.jsx";
import { ComunicacaoGestorPanel } from "../components/seguradora/ComunicacaoGestorPanel.jsx";
import { TarefasSeguradoraPanel } from "../components/seguradora/TarefasSeguradoraPanel.jsx";
import { MetricasPanel } from "../components/seguradora/MetricasPanel.jsx";

// Detalhe do módulo Seguradoras (Fase 2) — mesmo esqueleto de Oficina.jsx.
export function Seguradora() {
  const { records } = useData();
  const { param, navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const actions = useSeguradoraActions();
  const [tab, setTab] = useState("cadastro");

  const claims = visibleClaims(records.corp_claims, records.corp_overrides, currentUser);
  const overrides = records.corp_overrides || {};
  const canEdit = canEditRole(currentUser);

  const seguradoraId = param;
  const nome = seguradoraNomeFromId(claims, overrides, seguradoraId);

  if (!nome) {
    return (
      <div className="page-enter">
        <EmptyState>Seguradora não encontrada.</EmptyState>
      </div>
    );
  }

  const cadastro = actions.seguradoras[seguradoraId] || {};
  const cs = seguradoraClaims(claims, overrides, nome);

  const tabs = [
    ["cadastro", "Cadastro"],
    ["atendimentos", `Atendimentos (${cs.length})`],
    ["ocorrencias", "Reclamações e Feedbacks"],
    ["comunicacao", "Comunicação com gestor"],
    ["tarefas", "Tarefas"],
    ["metricas", "Métricas"],
  ];

  function renderPanel() {
    switch (tab) {
      case "cadastro": return <CadastroPanel seguradoraId={seguradoraId} cadastro={cadastro} actions={actions} canEdit={canEdit} />;
      case "atendimentos": return <AtendimentosPanel claims={cs} navigate={navigate} />;
      case "ocorrencias": return <OcorrenciasPanel seguradoraId={seguradoraId} claims={claims} actions={actions} canEdit={canEdit} navigate={navigate} />;
      case "comunicacao": return <ComunicacaoGestorPanel seguradoraId={seguradoraId} actions={actions} canEdit={canEdit} />;
      case "tarefas": return <TarefasSeguradoraPanel seguradoraId={seguradoraId} seguradoraNome={nome} navigate={navigate} />;
      case "metricas": return <MetricasPanel seguradoraNome={nome} claims={claims} overrides={overrides} />;
      default: return null;
    }
  }

  return (
    <div className="page-enter">
      <button className="btn sec sm" style={{ marginBottom: 12 }} onClick={() => navigate("seguradoras")}>← Voltar às seguradoras</button>
      <h1>{nome}</h1>
      <div className="sub">{cs.length} sinistro(s) vinculado(s) • ID interno: {seguradoraId}</div>

      <div className="tabs">
        {tabs.map(([key, label]) => (
          <div key={key} className={"tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>{label}</div>
        ))}
      </div>
      <div id="panel">{renderPanel()}</div>
    </div>
  );
}

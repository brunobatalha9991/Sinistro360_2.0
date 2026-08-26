import { useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { useClienteActions } from "../hooks/useClienteActions";
import { EmptyState } from "../components/EmptyState.jsx";
import { visibleClaims } from "../logic/claims";
import { canEdit as canEditRole } from "../data/auth";
import { clienteNomeFromId, clienteClaims } from "../logic/clientes";
import { setAberturaPrefill } from "../state/aberturaPrefill";
import { CadastroPanel } from "../components/cliente/CadastroPanel.jsx";
import { AtendimentosPanel } from "../components/cliente/AtendimentosPanel.jsx";
import { OcorrenciasPanel } from "../components/cliente/OcorrenciasPanel.jsx";
import { ComunicacaoGestorPanel } from "../components/cliente/ComunicacaoGestorPanel.jsx";
import { TarefasClientePanel } from "../components/cliente/TarefasClientePanel.jsx";
import { MetricasPanel } from "../components/cliente/MetricasPanel.jsx";

// Detalhe do módulo Clientes (Fase 3) — mesmo esqueleto de Oficina.jsx/
// Seguradora.jsx.
export function Cliente() {
  const { records } = useData();
  const { param, navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const actions = useClienteActions();
  const [tab, setTab] = useState("cadastro");

  const claims = visibleClaims(records.corp_claims, records.corp_overrides, currentUser);
  const overrides = records.corp_overrides || {};
  const canEdit = canEditRole(currentUser);

  const clienteId = param;
  const nome = clienteNomeFromId(claims, overrides, clienteId, actions.clientes);

  if (!nome) {
    return (
      <div className="page-enter">
        <EmptyState>Cliente não encontrado.</EmptyState>
      </div>
    );
  }

  const cadastro = actions.clientes[clienteId] || {};
  const cs = clienteClaims(claims, overrides, nome);

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
      case "cadastro": return <CadastroPanel clienteId={clienteId} cadastro={cadastro} actions={actions} canEdit={canEdit} />;
      case "atendimentos": return <AtendimentosPanel claims={cs} navigate={navigate} />;
      case "ocorrencias": return <OcorrenciasPanel clienteId={clienteId} claims={claims} actions={actions} canEdit={canEdit} navigate={navigate} />;
      case "comunicacao": return <ComunicacaoGestorPanel clienteId={clienteId} actions={actions} canEdit={canEdit} />;
      case "tarefas": return <TarefasClientePanel clienteId={clienteId} clienteNome={nome} navigate={navigate} />;
      case "metricas": return <MetricasPanel clienteNome={nome} claims={claims} overrides={overrides} />;
      default: return null;
    }
  }

  return (
    <div className="page-enter">
      <button className="btn sec sm" style={{ marginBottom: 12 }} onClick={() => navigate("clientes")}>← Voltar aos clientes</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1>{nome}</h1>
          <div className="sub">{cs.length} sinistro(s) vinculado(s) • ID interno: {clienteId}</div>
        </div>
        <button
          className="btn sec sm"
          onClick={() => {
            setAberturaPrefill({ segurado: nome });
            navigate("abertura");
          }}
        >
          + Abrir novo atendimento para este cliente
        </button>
      </div>

      <div className="tabs">
        {tabs.map(([key, label]) => (
          <div key={key} className={"tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>{label}</div>
        ))}
      </div>
      <div id="panel">{renderPanel()}</div>
    </div>
  );
}

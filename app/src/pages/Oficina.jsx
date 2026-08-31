import { useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { useOficinaActions } from "../hooks/useOficinaActions";
import { EmptyState } from "../components/EmptyState.jsx";
import { visibleClaims } from "../logic/claims";
import { canEdit as canEditRole } from "../data/auth";
import { oficinaNomeFromId, oficinaClaims } from "../logic/oficinas";
import { CadastroPanel } from "../components/oficina/CadastroPanel.jsx";
import { AtendimentosPanel } from "../components/oficina/AtendimentosPanel.jsx";
import { OcorrenciasPanel } from "../components/oficina/OcorrenciasPanel.jsx";
import { ComunicacaoGestorPanel } from "../components/oficina/ComunicacaoGestorPanel.jsx";
import { TarefasOficinaPanel } from "../components/oficina/TarefasOficinaPanel.jsx";
import { MetricasPanel } from "../components/oficina/MetricasPanel.jsx";

// Detalhe do módulo Oficinas (Fase 1) — mesmo esqueleto de Sinistro.jsx:
// registro resolvido pelo param da URL (aqui, o id/slug da oficina — ver
// oficinaIdFromNome em src/logic/oficinas.js), abas via switch. Diferente
// de um sinistro, a "oficina" não precisa existir em corp_oficinas pra
// ter uma tela — ela existe assim que aparece em pelo menos um sinistro;
// o cadastro é só um complemento manual opcional.
export function Oficina() {
  const { records, config } = useData();
  const { param, navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const actions = useOficinaActions();
  const [tab, setTab] = useState("cadastro");

  const claims = visibleClaims(records.corp_claims, records.corp_overrides, currentUser);
  const overrides = records.corp_overrides || {};
  const templates = config.corp_journey_templates;
  const atendTemplateCfg = config.corp_atendimento_template;
  const canEdit = canEditRole(currentUser);

  const oficinaId = param;
  const nome = oficinaNomeFromId(claims, overrides, oficinaId);

  if (!nome) {
    return (
      <div className="page-enter">
        <EmptyState>Oficina não encontrada.</EmptyState>
      </div>
    );
  }

  const cadastro = actions.oficinas[oficinaId] || {};
  const cs = oficinaClaims(claims, overrides, nome);

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
      case "cadastro": return <CadastroPanel oficinaId={oficinaId} cadastro={cadastro} actions={actions} canEdit={canEdit} />;
      case "atendimentos": return (
        <AtendimentosPanel
          claims={cs} navigate={navigate} oficinaNome={nome} overrides={overrides}
          templates={templates} atendTemplateCfg={atendTemplateCfg} config={config}
        />
      );
      case "ocorrencias": return <OcorrenciasPanel oficinaId={oficinaId} claims={claims} actions={actions} canEdit={canEdit} navigate={navigate} />;
      case "comunicacao": return <ComunicacaoGestorPanel oficinaId={oficinaId} actions={actions} canEdit={canEdit} />;
      case "tarefas": return <TarefasOficinaPanel oficinaId={oficinaId} oficinaNome={nome} navigate={navigate} />;
      case "metricas": return <MetricasPanel oficinaNome={nome} claims={claims} overrides={overrides} />;
      default: return null;
    }
  }

  return (
    <div className="page-enter">
      <button className="btn sec sm" style={{ marginBottom: 12 }} onClick={() => navigate("oficinas")}>← Voltar às oficinas</button>
      <h1>{nome}</h1>
      <div className="sub">{cs.length} sinistro(s) vinculado(s) • ID interno: {oficinaId}</div>

      <div className="tabs">
        {tabs.map(([key, label]) => (
          <div key={key} className={"tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>{label}</div>
        ))}
      </div>
      <div id="panel">{renderPanel()}</div>
    </div>
  );
}

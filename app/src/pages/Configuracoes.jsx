import { useEffect } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "../hooks/useAuth";
import { useOverrideActions } from "../hooks/useOverrideActions";
import { isAdmin } from "../data/auth";
import { EmptyState } from "../components/EmptyState.jsx";
import { HistoricoImportCard } from "../components/config/HistoricoImportCard.jsx";
import { ResponsabilidadeBackfillCard } from "../components/config/ResponsabilidadeBackfillCard.jsx";
import { RamoTemplatesEditor } from "../components/config/RamoTemplatesEditor.jsx";
import { UsersCard } from "../components/config/UsersCard.jsx";
import { AtendimentoStepsEditor } from "../components/config/AtendimentoStepsEditor.jsx";
import { visibleClaims, ensureRamoTemplateInto } from "../logic/claims";
import { getToken, setToken } from "../logic/corpApi";

export function Configuracoes() {
  const { records, config, saveRecord, saveConfig } = useData();
  const { currentUser } = useAuth();
  const actions = useOverrideActions();

  const claims = visibleClaims(records.corp_claims);
  const admin = isAdmin(currentUser);
  const templates = config.corp_journey_templates || {};

  // garante que todos os ramos presentes nos sinistros existam nos templates
  // (mesma regra do ensureRamoTemplate original, chamada ao abrir Configurações)
  useEffect(() => {
    let next = templates;
    claims.forEach((c) => { if (c.ramo) next = ensureRamoTemplateInto(next, c.ramo); });
    if (next !== templates) saveConfig("corp_journey_templates", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims.length, templates]);

  const ramosCount = Object.keys(templates).length;

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>Configurações</h1><p>Modelos de jornada por ramo, aplicados a todos os sinistros</p></div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Dados</h3>
        <p className="muted">Sinistros: {claims.length} • Ramos configurados: {ramosCount} • Token: {getToken() ? "ativo" : "inativo"}</p>
        <button className="btn danger sm" onClick={() => { setToken(""); alert("Sessão encerrada."); }}>Sair (logout)</button>
      </div>

      {!admin ? (
        <div className="card"><EmptyState>Apenas administradores podem editar os modelos de jornada por ramo. Altere o perfil no topo para Administrador.</EmptyState></div>
      ) : (
        <>
          <HistoricoImportCard claims={claims} actions={actions} canEdit={admin} />
          <ResponsabilidadeBackfillCard claims={claims} records={records} saveRecord={saveRecord} canEdit={admin} />
          <UsersCard users={records.corp_users || []} currentUser={currentUser} saveRecord={saveRecord} />
          <AtendimentoStepsEditor atendTemplateCfg={config.corp_atendimento_template} saveConfig={saveConfig} />
          <RamoTemplatesEditor templates={templates} saveConfig={saveConfig} />
        </>
      )}
    </div>
  );
}

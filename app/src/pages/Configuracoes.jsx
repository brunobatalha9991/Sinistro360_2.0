import { useEffect, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "../hooks/useAuth";
import { useOverrideActions } from "../hooks/useOverrideActions";
import { isAdmin } from "../data/auth";
import { EmptyState } from "../components/EmptyState.jsx";
import { HistoricoImportCard } from "../components/config/HistoricoImportCard.jsx";
import { ResponsabilidadeBackfillCard } from "../components/config/ResponsabilidadeBackfillCard.jsx";
import { MemoriasIACard } from "../components/config/MemoriasIACard.jsx";
import { AtribuirResponsavelEmMassaCard } from "../components/config/AtribuirResponsavelEmMassaCard.jsx";
import { DriveUploadConfigCard } from "../components/config/DriveUploadConfigCard.jsx";
import { SolicitacaoFormulariosCard } from "../components/config/SolicitacaoFormulariosCard.jsx";
import { ChecklistMesaAtendimentoCard } from "../components/config/ChecklistMesaAtendimentoCard.jsx";
import { RamoTemplatesEditor } from "../components/config/RamoTemplatesEditor.jsx";
import { UsersCard } from "../components/config/UsersCard.jsx";
import { AtendimentoStepsEditor } from "../components/config/AtendimentoStepsEditor.jsx";
import { AgentesCatalogoCard } from "../components/config/AgentesCatalogoCard.jsx";
import { ImportarAgenteProdutorCard } from "../components/config/ImportarAgenteProdutorCard.jsx";
import { visibleClaims, ensureRamoTemplateInto, distinctProdutores, distinctGruposProdutores, getAgentesEfetivo } from "../logic/claims";
import { getToken, setToken } from "../logic/corpApi";

// Agrupador colapsável — a pedido do usuário: Configurações tinha ~10
// blocos inteiros empilhados, sem organização. Cada grupo junta cards
// relacionados sob um título com botão "Mostrar/Ocultar"; nenhum card
// interno mudou (mesmas props, mesma lógica), só a disposição visual.
function ConfigGroup({ title, subtitle, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "10px 2px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
          {subtitle && <p className="muted" style={{ margin: "2px 0 0", fontSize: 12.5 }}>{subtitle}</p>}
        </div>
        <button type="button" className="btn sec sm" onClick={() => setOpen((v) => !v)}>{open ? "Ocultar" : "Mostrar"}</button>
      </div>
      {open && <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>}
    </div>
  );
}

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
  const overrides = records.corp_overrides || {};
  const agentesEfetivo = getAgentesEfetivo(config, overrides, claims);
  const produtoresEfetivo = distinctProdutores(overrides, claims);
  const gruposProdutoresEfetivo = distinctGruposProdutores(overrides, claims);

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
          <ConfigGroup title="Usuários & Acesso" subtitle="Cadastro, papéis, módulos e vínculo de Agente/Produtor (usuários Consulta) por usuário.">
            <UsersCard
              users={records.corp_users || []} currentUser={currentUser} saveRecord={saveRecord}
              agentesDisponiveis={agentesEfetivo} produtoresDisponiveis={produtoresEfetivo}
              gruposProdutoresDisponiveis={gruposProdutoresEfetivo}
            />
          </ConfigGroup>

          <ConfigGroup title="Processos & Jornada" subtitle="Etapas por ramo, jornadas de atendimento e atribuição de responsável em massa.">
            <AtendimentoStepsEditor atendTemplateCfg={config.corp_atendimento_template} saveConfig={saveConfig} />
            <RamoTemplatesEditor templates={templates} saveConfig={saveConfig} />
            <AtribuirResponsavelEmMassaCard claims={claims} overrides={overrides} users={records.corp_users || []} actions={actions} canEdit={admin} />
          </ConfigGroup>

          <ConfigGroup title="Agentes & Produtores" subtitle="Catálogo de agentes e importação em lote de Agente/Produtor da API CORP — usado no filtro de Sinistros e no vínculo de acesso de usuários Consulta.">
            <AgentesCatalogoCard config={config} saveConfig={saveConfig} overrides={overrides} claims={claims} canEdit={admin} />
            <ImportarAgenteProdutorCard claims={claims} config={config} actions={actions} canEdit={admin} />
          </ConfigGroup>

          <ConfigGroup title="Mesa de Atendimento" subtitle="Checklist de abertura, formulários de solicitação e upload de anexos no Drive.">
            <ChecklistMesaAtendimentoCard config={config} saveConfig={saveConfig} canEdit={admin} />
            <SolicitacaoFormulariosCard config={config} saveConfig={saveConfig} canEdit={admin} />
            <DriveUploadConfigCard config={config} saveConfig={saveConfig} canEdit={admin} />
          </ConfigGroup>

          <ConfigGroup title="Dados, Migração & IA" subtitle="Importação de histórico, migração de responsabilidade legada e aprovação de memórias da IA.">
            <HistoricoImportCard claims={claims} actions={actions} canEdit={admin} />
            <ResponsabilidadeBackfillCard claims={claims} records={records} saveRecord={saveRecord} canEdit={admin} />
            <MemoriasIACard users={records.corp_users || []} />
          </ConfigGroup>
        </>
      )}
    </div>
  );
}

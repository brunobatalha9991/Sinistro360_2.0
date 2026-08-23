// Mesmo "contrato" de dados do sistema atual (HTML monolítico), independente
// de a fonte ser offline (mock local) ou o Firestore real.

// Config pequena: 1 documento/valor inteiro por chave.
export const CONFIG_KEYS = [
  "corp_cfg",
  "corp_task_types",
  "corp_form_endpoints",
  "corp_journey_templates",
  "corp_sit_options",
  "corp_temp_options",
  "corp_atendimento_template",
  "corp_drive_upload_endpoint",
  "corp_solicitacao_formularios",
  "corp_checklist_mesa_atendimento",
  "corp_agentes_catalogo",
  "corp_gmail_cfg",
  "corp_email_assinatura",
  "corp_email_regras",
];

// Registros grandes/multiusuário: 1 documento por registro.
// keyed:true  -> valor é um objeto {id: registro} (caso de corp_overrides)
// keyed:false -> valor é um array [{id, ...}, ...]
export const RECORD_SPECS = {
  corp_claims: { col: "s360_claims", keyed: false },
  corp_users: { col: "s360_users", keyed: false },
  corp_tasks: { col: "s360_tasks", keyed: false },
  corp_notifs: { col: "s360_notifs", keyed: false },
  corp_demandas: { col: "s360_demandas", keyed: false },
  corp_overrides: { col: "s360_overrides", keyed: true },
  // Histórico de responsabilidade por processo (Fase 2 — IA Sinistros).
  // Array de intervalos {claimId, usuarioResponsavelId, inicioResponsabilidadeEm,
  // fimResponsabilidadeEm, ...} — ver src/logic/responsabilidade.js e
  // docs/ia-sinistros/regras-responsabilidade.md. Aditivo: não substitui
  // corp_overrides.responsavelUser, que continua sendo escrito para
  // compatibilidade retroativa com todas as telas existentes.
  corp_responsabilidade_historico: { col: "s360_responsabilidade_historico", keyed: false },
  // Log de auditoria das interações com o Assistente IA (Fase 3 — IA
  // Sinistros). Gravado direto do cliente (sem backend — decisão do
  // usuário), mesmo padrão de gravação de todo o resto do app. Não é à
  // prova de adulteração (ver docs/ia-sinistros/arquitetura-ia.md), mas
  // fica centralizado e visível em vez de só na memória do navegador.
  corp_ai_auditoria: { col: "s360_ai_auditoria", keyed: false },
  // Memória controlada e feedback do Assistente IA (Fase 6 — IA Sinistros).
  // Ver src/logic/memoriaIA.js e docs/ia-sinistros/memoria-e-feedback.md.
  corp_ai_memorias: { col: "s360_ai_memorias", keyed: false },
  corp_ai_feedback: { col: "s360_ai_feedback", keyed: false },
  // Estado local por e-mail (arquivado ou não) — a pedido do usuário, ver
  // src/pages/Emails.jsx. Chave = id composto "provedor:idDoEmail".
  corp_email_estado: { col: "s360_email_estado", keyed: true },
};

export const CONFIG_COLLECTION = "s360_config";

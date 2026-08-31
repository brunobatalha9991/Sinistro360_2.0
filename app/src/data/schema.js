// Mesmo "contrato" de dados do sistema atual (HTML monolítico), independente
// de a fonte ser offline (mock local) ou o Firestore real.

// Config pequena: 1 documento/valor inteiro por chave.
export const CONFIG_KEYS = [
  "corp_cfg",
  "corp_task_types",
  // Sinalizadores configuráveis das tarefas (ex.: "Aguard. cliente",
  // "Aguard. corretora") — a pedido do usuário, mesmo padrão de
  // corp_task_types. Ver TASK_FLAGS_DEFAULT em src/logic/tasks.js.
  "corp_task_flags",
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
  // Templates de mensagem (WhatsApp) vinculados a etapa da jornada — botão
  // "Mensagem para o cliente" no Histórico do sinistro. Array de
  // {id, nome, etapaVinculada, texto} — ver src/logic/msgTemplates.js.
  "corp_msg_templates",
  // Dicas/lembretes programados do Assistente (a pedido do usuário) —
  // entregues via o sino de notificações, no horário e pros papéis
  // configurados (ex.: "09:00", Atendente/Analista). Array de
  // {id, texto, hora, papeis, ativo} — ver src/logic/dicasAssistente.js e
  // ConfiguracoesDicasAssistenteCard.jsx.
  "corp_assistente_dicas",
  // Template padrão da "Tratativa em lote" (módulo Oficinas) — uma
  // pergunta por placa, repetida pra cada processo em aberto selecionado.
  // String única (não é lista); [[placa]] é a variável substituída. Ver
  // src/logic/tratativaLote.js e ConfiguracoesTratativaLoteCard.jsx.
  "corp_tratativa_lote_template",
  // Layout (ordem + tamanho de cada caixa) do cabeçalho do detalhe do
  // processo — a pedido do usuário: caixas arrastáveis/redimensionáveis,
  // compartilhadas pra todo mundo que usa o sistema. Ver DetailHeader.jsx.
  "corp_detail_layout",
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
  // Módulo Oficinas (Fase 1) — cadastro próprio por oficina (CNPJ,
  // endereço, contatos, seguradoras referenciadas), chaveado por
  // oficinaIdFromNome() (src/logic/oficinas.js). Vive fora do fluxo de
  // sincronização de corp_claims, então uma edição nunca é perdida numa
  // nova sincronização da API (a API só traz o nome da oficina como texto
  // livre em cada sinistro, nunca um cadastro rico pra conflitar).
  corp_oficinas: { col: "s360_oficinas", keyed: true },
  // Reclamações e feedbacks por oficina (campo "tipo" diferencia os dois),
  // com vínculo opcional a um processo.
  corp_oficina_ocorrencias: { col: "s360_oficina_ocorrencias", keyed: false },
  // Comunicação do gestor com a oficina (Ligação/Reunião/Visita/WhatsApp/
  // Presencial) — evidência pra alinhar em reuniões, a pedido do usuário.
  corp_oficina_comunicacoes: { col: "s360_oficina_comunicacoes", keyed: false },

  // Módulo Seguradoras (Fase 2) — mesmo padrão do módulo Oficinas acima,
  // adaptado: chaveado por seguradoraIdFromNome() (src/logic/seguradoras.js),
  // usando o campo "cia" em vez de "oficina".
  corp_seguradoras: { col: "s360_seguradoras", keyed: true },
  corp_seguradora_ocorrencias: { col: "s360_seguradora_ocorrencias", keyed: false },
  corp_seguradora_comunicacoes: { col: "s360_seguradora_comunicacoes", keyed: false },

  // Módulo Clientes (Fase 3) — mesmo padrão dos módulos Oficinas/
  // Seguradoras acima, chaveado por clienteIdFromNome() (src/logic/
  // clientes.js), usando o campo "segurado" em vez de "oficina"/"cia".
  corp_clientes: { col: "s360_clientes", keyed: true },
  corp_cliente_ocorrencias: { col: "s360_cliente_ocorrencias", keyed: false },
  corp_cliente_comunicacoes: { col: "s360_cliente_comunicacoes", keyed: false },

  // Link de acompanhamento público (a pedido do usuário) — chaveado pelo
  // token do link (gerarTokenPublico, src/logic/publicTracking.js). Cada
  // valor é o RESUMO CURADO exposto ao cliente, nunca o processo inteiro —
  // é a única coleção deste app pensada pra ter uma regra de LEITURA
  // PÚBLICA no Firestore (o resto continua exigindo o mesmo acesso de
  // sempre). Ver hooks/usePublicTrackingSync.js e
  // src/PublicTrackingPage.jsx (a página pública em si, fora do
  // DataProvider/login — não usa esta constante diretamente, lê o
  // documento direto via data/publicTrackingClient.js).
  corp_public_tracking: { col: "s360_public_tracking", keyed: true },
};

export const CONFIG_COLLECTION = "s360_config";

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
};

export const CONFIG_COLLECTION = "s360_config";

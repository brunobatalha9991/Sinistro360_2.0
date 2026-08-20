// Mesma config e mesmas coleções do sistema atual (Sinistro 360 - 20.08.2026.html).
// Nenhum dado novo é criado aqui — é a mesma base "batalha-sinistro360".
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDb65TZA7ILP1BrbYdsEJLh7VeP_gDTYEE",
  authDomain: "batalha-sinistro360.firebaseapp.com",
  projectId: "batalha-sinistro360",
  storageBucket: "batalha-sinistro360.firebasestorage.app",
  messagingSenderId: "88223946124",
  appId: "1:88223946124:web:50f26126c7bb33d00b72a9",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Config pequena: 1 documento inteiro por chave, coleção "s360_config".
export const CONFIG_COLLECTION = "s360_config";
export const CONFIG_KEYS = [
  "corp_cfg",
  "corp_task_types",
  "corp_form_endpoints",
  "corp_journey_templates",
  "corp_sit_options",
  "corp_temp_options",
  "corp_atendimento_template",
];

// Registros grandes/multiusuário: 1 documento Firestore por registro.
// keyed:true  -> valor local é um objeto {id: registro} (caso de corp_overrides)
// keyed:false -> valor local é um array [{id, ...}, ...]
export const RECORD_SPECS = {
  corp_claims: { col: "s360_claims", keyed: false },
  corp_users: { col: "s360_users", keyed: false },
  corp_tasks: { col: "s360_tasks", keyed: false },
  corp_notifs: { col: "s360_notifs", keyed: false },
  corp_demandas: { col: "s360_demandas", keyed: false },
  corp_overrides: { col: "s360_overrides", keyed: true },
};

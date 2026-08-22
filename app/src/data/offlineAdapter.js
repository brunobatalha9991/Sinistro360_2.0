// Fonte de dados 100% local (localStorage deste app, isolado do domínio de
// produção). Nenhuma chamada de rede é feita — usada enquanto não configuramos
// um projeto Firebase separado para desenvolvimento (ver DataProvider.jsx).
import { CONFIG_KEYS, RECORD_SPECS } from "./schema";
import {
  MOCK_CLAIMS, MOCK_USERS, MOCK_TASKS, MOCK_NOTIFS, MOCK_DEMANDAS,
  MOCK_OVERRIDES, MOCK_CONFIG, MOCK_RESPONSABILIDADE_HISTORICO,
} from "./mockData";

const RECORD_SEED = {
  corp_claims: MOCK_CLAIMS,
  corp_users: MOCK_USERS,
  corp_tasks: MOCK_TASKS,
  corp_notifs: MOCK_NOTIFS,
  corp_demandas: MOCK_DEMANDAS,
  corp_overrides: MOCK_OVERRIDES,
  corp_responsabilidade_historico: MOCK_RESPONSABILIDADE_HISTORICO,
};

function readKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function seedIfEmpty() {
  Object.keys(RECORD_SPECS).forEach((key) => {
    if (localStorage.getItem(key) == null) {
      localStorage.setItem(key, JSON.stringify(RECORD_SEED[key]));
    }
  });
  CONFIG_KEYS.forEach((key) => {
    if (localStorage.getItem(key) == null && MOCK_CONFIG[key] != null) {
      localStorage.setItem(key, JSON.stringify(MOCK_CONFIG[key]));
    }
  });
}

// API mínima que o DataProvider usa, igual em espírito ao offline e ao Firebase:
// getAll() lê tudo de uma vez; subscribe(onChange) chama onChange sempre que
// algo muda (aqui, só quando ESTA aba altera algo, via evento custom).
const CHANGE_EVENT = "s360-offline-change";

export function createOfflineAdapter() {
  seedIfEmpty();

  function getAllRecords() {
    const out = {};
    Object.keys(RECORD_SPECS).forEach((key) => {
      out[key] = readKey(key, RECORD_SPECS[key].keyed ? {} : []);
    });
    return out;
  }
  function getAllConfig() {
    const out = {};
    CONFIG_KEYS.forEach((key) => { out[key] = readKey(key, MOCK_CONFIG[key] ?? null); });
    return out;
  }

  function saveRecord(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
  }
  function saveConfig(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
  }

  function subscribe(onChange) {
    const handler = () => onChange();
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }

  return {
    mode: "offline",
    getAllRecords,
    getAllConfig,
    saveRecord,
    saveConfig,
    subscribe,
  };
}

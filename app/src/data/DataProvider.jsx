import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createOfflineAdapter } from "./offlineAdapter";
import { createFirebaseAdapter, firebaseEnvConfigured } from "./firebaseAdapter";

// Fonte de dados ativa: "offline" (padrão, seguro) ou "firebase" (só se
// VITE_DATA_SOURCE=firebase E as variáveis VITE_FIREBASE_* estiverem
// definidas em app/.env.local, apontando para um projeto DE DESENVOLVIMENTO
// — nunca o de produção). Ver app/.env.example.
const DataContext = createContext(null);

function resolveAdapter() {
  const wantsFirebase = import.meta.env.VITE_DATA_SOURCE === "firebase";
  if (wantsFirebase && firebaseEnvConfigured()) return createFirebaseAdapter();
  if (wantsFirebase && !firebaseEnvConfigured()) {
    console.warn(
      "[DataProvider] VITE_DATA_SOURCE=firebase mas as variáveis VITE_FIREBASE_* não estão definidas — usando offline."
    );
  }
  return createOfflineAdapter();
}

export function DataProvider({ children }) {
  const adapter = useMemo(resolveAdapter, []);
  const [records, setRecords] = useState(() => adapter.getAllRecords());
  const [config, setConfig] = useState(() => adapter.getAllConfig());

  useEffect(() => {
    return adapter.subscribe(() => {
      setRecords(adapter.getAllRecords());
      setConfig(adapter.getAllConfig());
    });
  }, [adapter]);

  function saveRecord(key, value) {
    adapter.saveRecord(key, value);
    setRecords(adapter.getAllRecords());
  }
  function saveConfig(key, value) {
    adapter.saveConfig(key, value);
    setConfig(adapter.getAllConfig());
  }

  const value = { mode: adapter.mode, records, config, saveRecord, saveConfig };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData() precisa estar dentro de <DataProvider>");
  return ctx;
}

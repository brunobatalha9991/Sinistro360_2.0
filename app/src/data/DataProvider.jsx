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
  const readSync = () => (adapter.getSyncStatus ? adapter.getSyncStatus() : { pending: 0, pendingSince: null, error: null });
  const [syncStatus, setSyncStatus] = useState(readSync);

  useEffect(() => {
    return adapter.subscribe(() => {
      setRecords(adapter.getAllRecords());
      setConfig(adapter.getAllConfig());
    });
  }, [adapter]);
  useEffect(() => {
    if (!adapter.subscribeStatus) return undefined;
    return adapter.subscribeStatus(() => setSyncStatus(readSync()));
  }, [adapter]);

  // Aceita um valor OU uma função updater(current) => next — igual ao
  // setState do React. Isso importa porque `records`/`config` no contexto
  // só atualizam no próximo render; se uma ação salvar duas vezes seguida
  // (ex.: vincular dois processos, que grava os dois lados do vínculo),
  // usar a função updater garante que a segunda gravação parte do dado que
  // a primeira acabou de salvar, e não de um retrato desatualizado.
  // Updater que devolve o próprio `current` = nada mudou: não grava nem
  // re-renderiza. Sem isso, efeitos que gravam ao renderizar (ex.:
  // usePublicTrackingSync) entravam em laço — cada setRecords gerava
  // referências novas, o efeito rodava de novo e chamava saveRecord de novo
  // (bug 2026-10-19).
  function saveRecord(key, valueOrUpdater) {
    const current = adapter.getAllRecords()[key];
    const value = typeof valueOrUpdater === "function" ? valueOrUpdater(current) : valueOrUpdater;
    if (value === current) return;
    adapter.saveRecord(key, value);
    setRecords(adapter.getAllRecords());
  }
  function saveConfig(key, valueOrUpdater) {
    const current = adapter.getAllConfig()[key];
    const value = typeof valueOrUpdater === "function" ? valueOrUpdater(current) : valueOrUpdater;
    if (value === current) return;
    adapter.saveConfig(key, value);
    setConfig(adapter.getAllConfig());
  }

  const value = { mode: adapter.mode, records, config, saveRecord, saveConfig, syncStatus };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData() precisa estar dentro de <DataProvider>");
  return ctx;
}

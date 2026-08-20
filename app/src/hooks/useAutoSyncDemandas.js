import { useEffect, useRef } from "react";
import { useData } from "../data/DataProvider.jsx";
import { runDemandaSync } from "../logic/demandaSync";

const INTERVAL_MS = 5 * 60 * 1000;

// Porte 1:1 do setInterval global do HTML original: enquanto houver um
// usuário logado e pelo menos um formulário vinculado, busca demandas novas
// a cada 5 minutos, silenciosamente (sem mexer na tela) — igual ao clique
// manual em "Sincronizar formulários", só que automático. Se uma busca
// falhar, tenta de novo no próximo ciclo.
export function useAutoSyncDemandas(currentUser) {
  const { config, records, saveRecord } = useData();
  const stateRef = useRef();
  stateRef.current = { currentUser, config, records, saveRecord };

  useEffect(() => {
    const id = setInterval(() => {
      const { currentUser, config, records, saveRecord } = stateRef.current;
      if (!currentUser) return;
      const cfg = config.corp_form_endpoints || {};
      const temAlgum = Object.keys(cfg).some((k) => k.startsWith("url") && cfg[k]);
      if (!temAlgum) return;
      const users = records.corp_users || [];
      runDemandaSync({ cfg, users, saveRecord }).catch(() => { /* silencioso: tenta de novo em 5 min */ });
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}

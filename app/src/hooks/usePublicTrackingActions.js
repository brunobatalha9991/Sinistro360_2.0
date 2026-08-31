import { useData } from "../data/DataProvider.jsx";
import { snapshotsIguais } from "../logic/publicTracking";

// Escrita em corp_public_tracking — separada de useOverrideActions.js de
// propósito: é a ÚNICA coleção deste app pensada pra ter uma regra de
// LEITURA PÚBLICA no Firestore (ver logic/publicTracking.js), então
// mantê-la isolada deixa claro, no código, o que é exposto por fora.
export function usePublicTrackingActions() {
  const { records, saveRecord } = useData();

  return {
    tracking: records.corp_public_tracking || {},
    // Só regrava quando o conteúdo visível de fato mudou (snapshotsIguais
    // ignora `atualizadoEm`) — evita escrita a cada render de quem estiver
    // com o processo aberto.
    syncPublicTracking(token, snapshot) {
      saveRecord("corp_public_tracking", (current) => {
        const cur = current || {};
        if (snapshotsIguais(cur[token], snapshot)) return cur;
        return { ...cur, [token]: snapshot };
      });
    },
    revogarPublicTracking(token) {
      saveRecord("corp_public_tracking", (current) => {
        const cur = current || {};
        if (!cur[token]) return cur;
        return { ...cur, [token]: { ...cur[token], ativo: false, atualizadoEm: new Date().toISOString() } };
      });
    },
  };
}

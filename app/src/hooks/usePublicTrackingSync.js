import { useEffect } from "react";
import { usePublicTrackingActions } from "./usePublicTrackingActions";
import { montarSnapshotPublico } from "../logic/publicTracking";

// Mantém o resumo público (corp_public_tracking) em dia enquanto alguém
// tem o processo aberto — a pedido do usuário, sem backend/cron aqui:
// funciona no melhor esforço, sincronizando sempre que a Visão geral do
// processo é carregada/re-renderizada com o link já ativo, não num
// horário fixo. Um processo com link gerado mas nunca mais reaberto
// internamente fica com o resumo desatualizado até alguém abrir de novo.
// `overrides`/`c` ganham referência nova a cada atualização do Firestore
// (mesmo de outro processo) — não custa nada rodar de novo à toa: quem
// evita escrita redundante é o snapshotsIguais dentro de syncPublicTracking.
export function usePublicTrackingSync(c, overrides, templates, atendTemplateCfg) {
  const { syncPublicTracking } = usePublicTrackingActions();
  const tracking = (overrides[c.id] || {}).publicTracking;

  useEffect(() => {
    if (!tracking || !tracking.ativo) return;
    syncPublicTracking(tracking.token, montarSnapshotPublico(c, overrides, templates, atendTemplateCfg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, overrides, templates, atendTemplateCfg, tracking && tracking.token, tracking && tracking.ativo]);
}

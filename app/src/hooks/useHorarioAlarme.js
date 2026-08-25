import { useEffect, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { claimAlarmesHoraAtivos, getResponsavel, campoEfetivo } from "../logic/claims";

// Checa a cada 20s (a pedido do usuário: precisa ser percebido "de
// imediato") se algum processo em que o usuário logado é o responsável
// tem uma etapa de Atendimento com horário configurado (ver
// stepHoraConfig em logic/claims.js) cuja data+hora já passou e a etapa
// ainda não tem desfecho. Usado pelo alarme visual (HorarioAlarmeModal.jsx),
// montado no Shell pra tocar em qualquer tela do app, não só na Jornada.
const INTERVALO_MS = 20 * 1000;

export function useHorarioAlarme(currentUser) {
  const { records, config } = useData();
  const [, forceTick] = useState(0);
  const [dismissed, setDismissed] = useState({});

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), INTERVALO_MS);
    return () => clearInterval(id);
  }, []);

  const overrides = records.corp_overrides || {};
  const atendTemplateCfg = config.corp_atendimento_template;
  const claims = records.corp_claims || [];

  const alarmes = [];
  if (currentUser) {
    claims.forEach((c) => {
      const resp = getResponsavel(overrides, c.id);
      if (!resp || resp.id !== currentUser.id) return;
      claimAlarmesHoraAtivos(overrides, atendTemplateCfg, c).forEach((a) => {
        const key = `${c.id}:${a.stepId}:${a.date}:${a.hora}`;
        if (dismissed[key]) return;
        alarmes.push({
          ...a, key, claimId: c.id,
          numsin: campoEfetivo(overrides, c, "numsin"),
          segurado: campoEfetivo(overrides, c, "segurado"),
        });
      });
    });
  }

  function dismiss(key) {
    setDismissed((d) => ({ ...d, [key]: true }));
  }
  function dismissAll() {
    setDismissed((d) => {
      const next = { ...d };
      alarmes.forEach((a) => { next[a.key] = true; });
      return next;
    });
  }

  return { alarmes, dismiss, dismissAll };
}

import { useEffect, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { dicasPendentesHoje, dicaNotifId } from "../logic/dicasAssistente";

// Checa a cada minuto — a hora configurada é "HH:MM", não precisa de mais
// granularidade que essa (mesmo padrão de useTarefaAlarme.js/
// useHorarioAlarme.js: setInterval + tick força a reavaliação do relógio,
// já que nada mais garante que o componente vá re-renderizar sozinho no
// instante exato em que o horário configurado é alcançado).
const CHECK_MS = 60 * 1000;

// Entrega as "Dicas do Assistente" (Configurações) pro usuário logado,
// como notificação normal no sino — a pedido do usuário. Sem backend/cron
// aqui: dispara na primeira vez que este usuário reavalia o relógio (a
// cada minuto, enquanto a aba estiver aberta, ou ao abrir/recarregar a
// página) a partir do horário configurado, uma vez por dica por dia
// (dicaNotifId garante o dedupe mesmo com o hook rodando de novo).
export function useDicasAssistente(currentUser) {
  const { records, config, saveRecord } = useData();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), CHECK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const dicas = config.corp_assistente_dicas || [];
    const notifs = records.corp_notifs || [];
    const pendentes = dicasPendentesHoje(dicas, notifs, currentUser);
    if (!pendentes.length) return;
    const agora = new Date();
    const hojeISO = agora.toISOString().slice(0, 10);
    const atISO = agora.toISOString();
    saveRecord("corp_notifs", (cur) => [
      ...(cur || []),
      ...pendentes.map((d) => ({
        id: dicaNotifId(d.id, currentUser.id, hojeISO),
        taskId: "__dica__",
        userId: currentUser.id,
        text: d.texto,
        at: atISO,
        read: false,
        tipo: "dica",
      })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, currentUser, config.corp_assistente_dicas, records.corp_notifs]);
}

import { useEffect, useRef, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { alarmesAgenda, agendaCfg } from "../logic/agenda";

// Alarmes da Agenda do usuário logado (ver alarmesAgenda em
// logic/agenda.js), reavaliados a cada 15s — mesmo padrão de
// useTarefaAlarme.js. Nada é guardado aqui: soneca, lembrete respondido,
// início e fim vêm dos feedbacks gravados, então o alarme some/volta igual
// em todas as abas e computadores do usuário.
//
// Também dispara a notificação do Windows/navegador (uma vez por alarme
// nesta aba), que aparece mesmo com a aba minimizada — só com o
// Sinistro360 aberto, já que o app não tem servidor pra mandar push.
const CHECK_MS = 15 * 1000;

const TITULO_NOTIF = {
  lembrete: "⏰ Em breve na sua agenda",
  iniciar: "▶ Hora de iniciar",
  finalizar: "✓ Hora de finalizar",
  perdida: "⚠ Ação sem registro",
};

export function notificacaoSuportada() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function useAgendaAlarme(currentUser) {
  const { records, config } = useData();
  const [agora, setAgora] = useState(() => new Date());
  const notificados = useRef(new Set());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const cfg = agendaCfg(config);
  const alarmes = currentUser
    ? alarmesAgenda(records.corp_agenda || [], records.corp_agenda_feedback || [], currentUser.id, agora, cfg)
    : [];

  const chaves = alarmes.map((a) => a.key).join(",");
  useEffect(() => {
    if (!notificacaoSuportada() || Notification.permission !== "granted") return;
    alarmes.forEach((a) => {
      if (notificados.current.has(a.key)) return;
      notificados.current.add(a.key);
      try {
        const n = new Notification(TITULO_NOTIF[a.fase] || "Agenda", {
          body: `${a.oc.icone ? a.oc.icone + " " : ""}${a.oc.titulo} — ${a.oc.inicio}${a.oc.tipo === "marco" ? "" : "–" + a.oc.fim}`,
          tag: "s360-agenda-" + a.key,
          requireInteraction: a.fase !== "lembrete",
        });
        n.onclick = () => { window.focus(); n.close(); };
      } catch { /* navegador sem suporte a notificação fora de service worker */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaves]);

  return { alarmes, cfg, agora };
}

// Roteiro do dia no topo do sistema (a pedido do usuário) — resume a Agenda
// de hoje para o widget da barra superior (components/RoteiroWidget.jsx):
// o que está acontecendo agora, quanto falta, o que vem a seguir, o que
// ficou para trás e como está o dia. Tudo derivado dos blocos e feedbacks
// da Agenda (logic/agenda.js) — nada novo é gravado.
import { ocorrenciasDoDia, indexarFeedbacks, statusOcorrencia, instante, dataLocalISO, AGENDA_CFG_DEFAULT } from "./agenda";

// Estados do widget (cor/ícone em RoteiroWidget):
//   estourada   — ação em andamento passou do horário previsto de fim
//   atrasada    — o horário de uma ação já começou e ela não foi iniciada
//   encerrando  — ação em andamento termina em até 2 min
//   em_andamento
//   em_breve    — próxima ação começa em até 5 min (ou dentro do lembrete)
//   livre       — nada agora; há algo mais tarde
//   fim         — nada mais hoje
//   sem_agenda  — nenhuma ação hoje
export const ENCERRANDO_MS = 2 * 60000;
export const EM_BREVE_MS = 5 * 60000;

export function resumoRoteiro({ blocos, feedbacks, userId, agora = new Date(), cfg = AGENDA_CFG_DEFAULT }) {
  const hoje = dataLocalISO(agora);
  const t = agora.getTime();
  const idx = indexarFeedbacks(feedbacks);
  const ocs = ocorrenciasDoDia(blocos, userId, hoje).map((oc) => {
    const e = idx[oc.key] || {};
    const iniMs = instante(oc.data, oc.inicio);
    const fimMs = oc.tipo === "marco" ? iniMs : instante(oc.data, oc.fim);
    return {
      oc, iniMs, fimMs,
      status: statusOcorrencia(oc, idx, agora),
      inicioRealMs: e.inicio ? new Date(e.inicio.at).getTime() : null,
      fimRealMs: e.fim ? new Date(e.fim.at).getTime() : null,
    };
  });

  const emAndamento = ocs.filter((x) => x.status === "em_andamento").sort((a, b) => (a.inicioRealMs || 0) - (b.inicioRealMs || 0));
  // Não iniciadas com o horário correndo agora (início <= agora < fim).
  const atrasadas = ocs.filter((x) => x.status === "atrasada" && x.oc.tipo !== "marco" && t < x.fimMs);
  // Passaram do horário sem nenhum registro (perdidas hoje).
  const semRegistro = ocs.filter((x) => x.status === "atrasada" && (x.oc.tipo === "marco" ? t >= x.iniMs : t >= x.fimMs));
  const estouradas = emAndamento.filter((x) => t > x.fimMs);
  const proximas = ocs.filter((x) => x.status === "pendente" && x.iniMs > t).sort((a, b) => a.iniMs - b.iniMs);

  const atual = emAndamento[0] || atrasadas[0] || null;
  const proxima = proximas[0] || null;

  let estado;
  if (!ocs.length) estado = "sem_agenda";
  else if (atual && atual.status === "em_andamento" && t > atual.fimMs) estado = "estourada";
  else if (atual && atual.status === "atrasada") estado = "atrasada";
  else if (atual && atual.fimMs - t <= ENCERRANDO_MS) estado = "encerrando";
  else if (atual) estado = "em_andamento";
  else if (proxima && proxima.iniMs - t <= Math.max(EM_BREVE_MS, (proxima.oc.lembreteMin || 0) * 60000)) estado = "em_breve";
  else if (proxima) estado = "livre";
  else estado = "fim";

  // Progresso do dia (só ações, não marcos como almoço/fim de expediente).
  const acoes = ocs.filter((x) => x.oc.tipo !== "marco");
  const concluidas = acoes.filter((x) => x.status === "concluida").length;
  const vencidas = acoes.filter((x) => t >= x.fimMs).length;
  const minPlanejados = acoes.reduce((s, x) => s + Math.max(0, (x.fimMs - x.iniMs) / 60000), 0);
  const minExecutados = acoes.reduce((s, x) => {
    if (!x.inicioRealMs) return s;
    const fim = x.fimRealMs || (x.status === "em_andamento" ? t : x.inicioRealMs);
    return s + Math.max(0, (fim - x.inicioRealMs) / 60000);
  }, 0);
  const pontuais = acoes.filter((x) => x.inicioRealMs && x.inicioRealMs - x.iniMs <= (Number(cfg.toleranciaMin) || 5) * 60000).length;
  const iniciadas = acoes.filter((x) => x.inicioRealMs).length;
  const expIni = instante(hoje, cfg.inicio || "08:30");
  const expFim = instante(hoje, cfg.fim || "18:00");
  const pctExpediente = Math.min(1, Math.max(0, (t - expIni) / Math.max(1, expFim - expIni)));

  return {
    ocs, atual, proxima, proximas, emAndamento, atrasadas, semRegistro, estouradas, estado,
    alertas: atrasadas.length + semRegistro.length + estouradas.length,
    progresso: {
      total: acoes.length, concluidas, vencidas,
      pctConcluidas: acoes.length ? concluidas / acoes.length : null,
      minPlanejados, minExecutados,
      pontualidade: iniciadas ? pontuais / iniciadas : null,
      pctExpediente,
      restanteExpedienteMin: Math.max(0, (expFim - t) / 60000),
    },
  };
}

// 754000 -> "12:34"; 3_754_000 -> "1:02:34". Negativo vira "+12:34".
export function fmtCronometro(ms) {
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const txt = h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return (neg ? "+" : "") + txt;
}

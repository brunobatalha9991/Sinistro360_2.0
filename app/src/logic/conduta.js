// Registros de conduta do módulo Desempenho (a pedido do usuário): Admin/VIP
// registram advertências, falhas, apontamentos, ausências, feedbacks,
// reclamações, ocorrências, normativas, informativos, lembretes e
// comunicados para os usuários operacionais. Cada registro trava a tela do
// usuário até ele clicar em "Ciente"; quando o registro pede feedback, a
// tela só sai com o feedback escrito (ou adia 3 min com a soneca).
//
// Registro (corp_conduta): { id, loteId, userId, tipo, titulo, texto,
//   autorId, at, exigeFeedback, perguntaFeedback, cienteAt, feedback,
//   sonecaAte, sonecas }
// `loteId` agrupa os registros criados juntos para vários usuários.

export const TIPOS_CONDUTA = [
  { key: "advertencia", label: "Advertência", icone: "⚠️", badge: "red", negativo: true },
  { key: "falha", label: "Falha", icone: "❌", badge: "red", negativo: true },
  { key: "apontamento", label: "Apontamento", icone: "📌", badge: "orange", negativo: true },
  { key: "ausencia", label: "Ausência", icone: "🚫", badge: "orange", negativo: true },
  { key: "reclamacao", label: "Reclamação", icone: "😠", badge: "red", negativo: true },
  { key: "ocorrencia", label: "Ocorrência", icone: "📋", badge: "orange", negativo: true },
  { key: "feedback", label: "Feedback", icone: "💬", badge: "blue", negativo: false },
  { key: "normativa", label: "Normativa", icone: "📜", badge: "purple", negativo: false },
  { key: "informativo", label: "Informativo", icone: "ℹ️", badge: "blue", negativo: false },
  { key: "lembrete", label: "Lembrete", icone: "⏰", badge: "amber", negativo: false },
  { key: "comunicado", label: "Comunicado", icone: "📢", badge: "blue", negativo: false },
];

export const SONECA_CONDUTA_MIN = 3;
export const FEEDBACK_CONDUTA_MIN_CHARS = 5;

export function tipoConduta(key) {
  return TIPOS_CONDUTA.find((t) => t.key === key) || { key, label: key, icone: "📋", badge: "gray", negativo: false };
}

// Quem aparece no Desempenho e pode receber registros: a equipe
// operacional (Atendente/Analista), pela função de verdade — VIP não muda isso.
export function ehOperacional(u) {
  return !!(u && (u.role === "atendente" || u.role === "analista"));
}

// Registros que travam a tela agora: sem "ciente" e fora da soneca.
// Mais antigos primeiro.
export function condutaPendentes(registros, userId, agora) {
  const t = agora.getTime();
  return (registros || [])
    .filter((r) => r && r.userId === userId && !r.cienteAt && !(r.sonecaAte && new Date(r.sonecaAte).getTime() > t))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

function noPeriodo(r, deISO, ateISO) {
  const d = String(r.at || "").slice(0, 10);
  if (deISO && d < deISO) return false;
  if (ateISO && d > ateISO) return false;
  return true;
}

export function metricasConduta({ registros, userId, deISO, ateISO }) {
  const lista = (registros || []).filter((r) => r && r.userId === userId && noPeriodo(r, deISO, ateISO));
  const porTipo = {};
  TIPOS_CONDUTA.forEach((t) => { porTipo[t.key] = 0; });
  let negativos = 0, pendentesCiente = 0, feedbacksSolicitados = 0, feedbacksRespondidos = 0, sonecas = 0;
  let somaCienteMin = 0, nCiente = 0;
  lista.forEach((r) => {
    porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1;
    if (tipoConduta(r.tipo).negativo) negativos++;
    if (!r.cienteAt) pendentesCiente++;
    else {
      const min = (new Date(r.cienteAt) - new Date(r.at)) / 60000;
      if (min >= 0) { somaCienteMin += min; nCiente++; }
    }
    if (r.exigeFeedback) {
      feedbacksSolicitados++;
      if (r.feedback) feedbacksRespondidos++;
    }
    sonecas += r.sonecas || 0;
  });
  return {
    total: lista.length,
    porTipo,
    negativos,
    pendentesCiente,
    feedbacksSolicitados,
    feedbacksRespondidos,
    sonecas,
    tempoMedioCienteMin: nCiente ? somaCienteMin / nCiente : null,
    registros: lista.sort((a, b) => String(b.at).localeCompare(String(a.at))),
  };
}

// Soma a conduta ao feedback automático do perfil (mesma ideia do
// comAgenda em Desempenho.jsx).
export function comConduta(analise, mc) {
  if (!mc || !mc.total) return analise;
  const atencao = analise.pontosAtencao.slice();
  const fortes = analise.pontosFortes.slice();
  const negativos = TIPOS_CONDUTA.filter((t) => t.negativo && mc.porTipo[t.key]).map((t) => `${mc.porTipo[t.key]} ${t.label.toLowerCase()}(s)`);
  if (negativos.length) atencao.push(`Registros de conduta no período: ${negativos.join(", ")}.`);
  if (mc.pendentesCiente) atencao.push(`${mc.pendentesCiente} registro(s) de conduta ainda sem "ciente".`);
  if (mc.sonecas >= 3) atencao.push(`Adiou ${mc.sonecas} vez(es) a resposta a registros de conduta (soneca).`);
  if (!mc.negativos && mc.total) fortes.push("Nenhum registro de conduta negativo no período.");
  return { ...analise, pontosFortes: fortes, pontosAtencao: atencao };
}

export function fmtMinutos(min) {
  if (min == null) return "—";
  if (min < 60) return Math.round(min) + " min";
  const h = min / 60;
  if (h < 24) return h.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " h";
  return (h / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " d";
}

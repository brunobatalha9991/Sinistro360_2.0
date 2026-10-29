// Linha do tempo do que o usuário FEZ no período (a pedido do usuário,
// 2026-10-29): toda interação em processo (histórico, jornada, próxima
// ação, criação/edição, anexos, temperatura...), na Comunicação Interna
// (criou, comentou, deu ciente, mudou status, respondeu intervenção) e na
// Agenda (iniciou/concluiu/não realizou ação, alterou a agenda) — cada uma
// com o vínculo para abrir o processo/CI. Autoria via logic/autoria.js.
import { visibleClaims, loadComms, loadAudit, getUserJourney } from "./claims";
import { feitoPor, ehAcaoJornada, CANAL_IMPORTADO } from "./autoria";
import { FEEDBACK_TIPOS, inicioDiaLocalISO, fimDiaLocalISO, dataLocalISO } from "./agenda";

export const GRUPOS_ATIVIDADE = [
  { key: "historico", label: "Histórico", icone: "📝" },
  { key: "jornada", label: "Jornada", icone: "🛤" },
  { key: "proxima_acao", label: "Próxima ação", icone: "📌" },
  { key: "processo", label: "Outras atualizações", icone: "🛠" },
  { key: "ci", label: "Comunicação Interna", icone: "📨" },
  { key: "agenda", label: "Agenda", icone: "🗓" },
];

function resumo(txt, n = 220) {
  const s = String(txt || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function rotuloProcesso(c) {
  return [c.segurado, c.numsin || (c.nosnum ? "#" + c.nosnum : ""), c.placa].filter(Boolean).join(" • ") || "processo";
}
function grupoDaAcao(acao) {
  if (ehAcaoJornada(acao)) return "jornada";
  if (/^Próxima ação/.test(acao)) return "proxima_acao";
  return "processo";
}
const ICONE_ACAO = [
  [/^Processo criado|^Vinculado/, "🆕"], [/^Anexo/, "📎"], [/^Responsável/, "👤"], [/^Temperatura/, "🌡"],
  [/^Situação de atendimento/, "🚦"], [/^Mensagem de template/, "💬"], [/^Prazo do histórico renovado/, "⏳"],
  [/^Comunicação (editada|excluída)/, "✏️"], [/^Pesquisa/, "⭐"], [/^Link de acompanhamento/, "🔗"],
  [/^Próxima ação concluída/, "✅"], [/^Próxima ação/, "📌"], [/^Jornada/, "🛤"], [/^Agente\/Produtor|^Observações/, "✏️"],
];
function iconeAcao(acao) {
  const hit = ICONE_ACAO.find(([re]) => re.test(acao || ""));
  return hit ? hit[1] : "🛠";
}

// `usuario` = { id, nome }. deISO/ateISO = datas locais (AAAA-MM-DD) ou null.
export function atividadesDoUsuario({ claims, overrides, tasks, feedbacksAgenda, usuario, deISO, ateISO }) {
  const ini = deISO ? inicioDiaLocalISO(deISO) : "";
  const fim = ateISO ? fimDiaLocalISO(ateISO) : "9999";
  const dentro = (at) => !!at && String(at) >= ini && String(at) <= fim;
  const out = [];
  const add = (e) => out.push({ ...e, data: dataLocalISO(new Date(e.at)) });

  visibleClaims(claims || []).forEach((c) => {
    const proc = rotuloProcesso(c);
    const rota = ["sinistro", c.id];
    loadComms(overrides, c.id).forEach((m) => {
      if (m.canal === CANAL_IMPORTADO || !dentro(m.at) || !feitoPor(m.whoId, m.who, usuario)) return;
      const flags = [m.aguardandoRetorno && "aguardando retorno", m.limitacaoComunicacao && "limitação de comunicação", Number(m.avaliacao) > 0 && `nota ${m.avaliacao}`].filter(Boolean);
      add({ at: m.at, grupo: "historico", icone: "📝", titulo: `Registrou histórico (${m.canal || "—"}${m.meio ? " • " + m.meio : ""})${m.titulo ? " — " + m.titulo : ""}`, detalhe: resumo(m.text) + (flags.length ? ` [${flags.join(", ")}]` : ""), alvo: proc, rota });
    });
    let jornadaAudit = false;
    loadAudit(overrides, c.id).forEach((a) => {
      if (ehAcaoJornada(a.acao) && feitoPor(a.whoId, a.who, usuario)) jornadaAudit = true;
      if (a.acao === "Comunicação registrada" || !dentro(a.at) || !feitoPor(a.whoId, a.who, usuario)) return;
      add({ at: a.at, grupo: grupoDaAcao(a.acao), icone: iconeAcao(a.acao), titulo: a.acao, detalhe: resumo(a.detalhe), alvo: proc, rota });
    });
    // Jornada antes da auditoria "Jornada: ..." (2026-10-29): só a última
    // interação de cada etapa.
    if (!jornadaAudit) {
      Object.entries((getUserJourney(overrides, c.id) || {}).steps || {}).forEach(([id, sd]) => {
        if (!sd || !dentro(sd.lastInteractionAt) || !feitoPor(sd.lastInteractionById, sd.lastInteractionBy, usuario)) return;
        add({ at: sd.lastInteractionAt, grupo: "jornada", icone: "🛤", titulo: `Jornada: ${sd.title || id}${sd.status ? " → " + sd.status : ""}`, detalhe: sd.concludedAt ? "etapa concluída" : "última interação registrada na etapa", alvo: proc, rota });
      });
    }
  });

  (tasks || []).forEach((t) => {
    if (!t) return;
    const alvo = `${t.ci || "CI"}${t.titulo ? " — " + t.titulo : ""}`;
    const rota = ["tarefas", "open-" + t.id];
    if (t.origem === usuario.id && dentro(t.createdAt)) add({ at: t.createdAt, grupo: "ci", icone: "🆕", titulo: "Abriu a CI", detalhe: resumo(t.descricao || t.tipo || ""), alvo, rota });
    (t.comments || []).forEach((cm) => {
      if (cm.userId !== usuario.id || !dentro(cm.at)) return;
      const titulo = cm.respostaIntervencaoId ? "Respondeu à intervenção" : cm.intervencaoId ? "Fez uma intervenção" : "Comentou na CI";
      add({ at: cm.at, grupo: "ci", icone: "💬", titulo, detalhe: resumo(cm.text), alvo, rota });
    });
    const ciente = t.ciente && t.ciente[usuario.id];
    if (ciente && dentro(ciente)) add({ at: ciente, grupo: "ci", icone: "👁", titulo: "Deu ciente na CI", detalhe: "", alvo, rota });
    (t.log || []).forEach((e) => {
      if (e.who !== usuario.id || !dentro(e.at)) return;
      const acao = String(e.acao || "");
      // Já aparecem pelos comentários/abertura.
      if (/comentou:|^Tarefa criada|^Resposta à intervenção|^Intervenção de/.test(acao)) return;
      const sem = resumo(acao.replace(new RegExp("^" + (usuario.nome || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*"), ""), 120);
      add({ at: e.at, grupo: "ci", icone: /Conclu/.test(acao) ? "✅" : "🔄", titulo: sem ? sem.charAt(0).toUpperCase() + sem.slice(1) : "Atualizou a CI", detalhe: "", alvo, rota });
    });
  });

  (feedbacksAgenda || []).forEach((f) => {
    if ((f.autorId || f.userId) !== usuario.id || !dentro(f.at) || f.tipo === "soneca") return;
    const t = FEEDBACK_TIPOS[f.tipo] || { label: f.tipo };
    const mud = (f.mudancas || []).length ? ` • ${f.mudancas.length} mudança(s): ${f.mudancas.map((x) => x.texto).join("; ")}` : "";
    add({ at: f.at, grupo: "agenda", icone: "🗓", titulo: f.tipo === "alteracao" ? "Alterou a agenda" : `Agenda: ${t.label} — ${f.icone ? f.icone + " " : ""}${f.titulo || ""}`, detalhe: resumo(f.texto + mud, 400), alvo: f.previstoInicio ? `previsto ${f.previstoInicio}${f.previstoFim && f.previstoFim !== f.previstoInicio ? "–" + f.previstoFim : ""}` : "", rota: ["agenda"] });
  });

  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

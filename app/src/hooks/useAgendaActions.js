import { useData } from "../data/DataProvider.jsx";
import { isAdmin } from "../data/auth";
import { uid } from "../logic/format";
import { aplicarModelo, FEEDBACK_TIPOS } from "../logic/agenda";

// Gravações do módulo Agenda (ver logic/agenda.js). Todo feedback também
// vira notificação no sino de cada Administrador/VIP (a pedido do
// usuário), menos pra quem escreveu.
export function useAgendaActions() {
  const { records, saveRecord } = useData();
  const users = records.corp_users || [];

  function salvarBloco(bloco) {
    const agoraISO = new Date().toISOString();
    saveRecord("corp_agenda", (cur) => {
      const list = cur || [];
      if (bloco.id && list.some((b) => b.id === bloco.id)) {
        return list.map((b) => (b.id === bloco.id ? { ...b, ...bloco, atualizadoEm: agoraISO } : b));
      }
      return [...list, { excecoes: {}, ...bloco, id: bloco.id || uid("agb"), criadoEm: agoraISO }];
    });
  }

  // Altera só um dia de um bloco recorrente (arrastar, "só este dia").
  function salvarExcecao(blocoId, dataISO, patch) {
    saveRecord("corp_agenda", (cur) => (cur || []).map((b) => {
      if (b.id !== blocoId) return b;
      const exc = { ...(b.excecoes || {}) };
      exc[dataISO] = { ...(exc[dataISO] || {}), ...patch };
      return { ...b, excecoes: exc, atualizadoEm: new Date().toISOString() };
    }));
  }

  function excluirBloco(blocoId) {
    saveRecord("corp_agenda", (cur) => (cur || []).filter((b) => b.id !== blocoId));
  }

  function aplicarModeloParaUsuarios({ modelo, presets, userIds, dataInicio, recorrencia, substituir, autorId }) {
    const agoraISO = new Date().toISOString();
    saveRecord("corp_agenda", (cur) => userIds.reduce((acc, userId) => aplicarModelo({
      blocosAtuais: acc, modelo, presets, userId, dataInicio, recorrencia, substituir, autorId,
      novoId: () => uid("agb"), agoraISO,
    }), cur || []));
  }

  // oc = ocorrência (logic/agenda.js ocorrenciasDoDia); fase só pra soneca.
  function registrarFeedback({ oc, tipo, texto, fase, autor, extra }) {
    const at = new Date().toISOString();
    const fbItem = {
      id: uid("agf"),
      userId: oc.bloco.userId, autorId: autor ? autor.id : null,
      blocoId: oc.blocoId, data: oc.data, tipo, texto: String(texto || "").trim(), at,
      titulo: oc.titulo, icone: oc.icone, presetId: oc.presetId,
      previstoInicio: oc.inicio, previstoFim: oc.fim,
      ...(fase ? { fase } : {}),
      ...(extra || {}),
    };
    saveRecord("corp_agenda_feedback", (cur) => [...(cur || []), fbItem]);

    const dono = users.find((u) => u.id === fbItem.userId);
    const gestores = users.filter((u) => isAdmin(u) && u.id !== fbItem.autorId);
    if (!gestores.length) return;
    const rotulo = (FEEDBACK_TIPOS[tipo] || {}).label || tipo;
    saveRecord("corp_notifs", (cur) => [
      ...(cur || []),
      ...gestores.map((g) => ({
        id: uid("ntf"), taskId: "__agenda__", userId: g.id, tipo: "agenda_feedback", feedbackId: fbItem.id, read: false, at,
        text: `${dono ? dono.nome : "Usuário"} • ${rotulo} — ${oc.icone ? oc.icone + " " : ""}${oc.titulo} (${oc.inicio}): ${fbItem.texto}`,
      })),
    ]);
  }

  // Comentário sobre um feedback da agenda (a pedido do usuário) — o gestor
  // comenta a partir da notificação recebida (ou da aba Feedbacks) e o
  // operador dono da agenda é notificado; se quem comenta é o próprio
  // operador (resposta), notifica os Administradores/VIP.
  function comentarFeedback({ feedbackId, texto, autor }) {
    const t = String(texto || "").trim();
    if (!t || !autor) return;
    const fb = (records.corp_agenda_feedback || []).find((f) => f.id === feedbackId);
    if (!fb) return;
    const at = new Date().toISOString();
    const comentario = { id: uid("agc"), autorId: autor.id, texto: t, at };
    saveRecord("corp_agenda_feedback", (cur) => (cur || []).map((f) => (
      f.id === feedbackId ? { ...f, comentarios: [...(f.comentarios || []), comentario] } : f
    )));

    const alvos = autor.id === fb.userId
      ? users.filter((u) => isAdmin(u) && u.id !== autor.id)
      : users.filter((u) => u.id === fb.userId);
    if (!alvos.length) return;
    saveRecord("corp_notifs", (cur) => [
      ...(cur || []),
      ...alvos.map((u) => ({
        id: uid("ntf"), taskId: "__agenda__", userId: u.id, tipo: "agenda_comentario", feedbackId, read: false, at,
        text: `${autor.nome} comentou em ${fb.icone ? fb.icone + " " : ""}${fb.titulo} (${fb.previstoInicio}): ${t.slice(0, 120)}`,
      })),
    ]);
  }

  return { salvarBloco, salvarExcecao, excluirBloco, aplicarModeloParaUsuarios, registrarFeedback, comentarFeedback };
}

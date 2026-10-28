import { useData } from "../data/DataProvider.jsx";
import { isAdmin } from "../data/auth";
import { uid } from "../logic/format";
import { tipoConduta, SONECA_CONDUTA_MIN } from "../logic/conduta";

// Gravações dos registros de conduta (ver logic/conduta.js). O usuário
// recebe o registro no sino; o "ciente" e o feedback dele voltam como
// notificação pro autor e pros demais Administradores/VIPs.
export function useCondutaActions() {
  const { records, saveRecord } = useData();
  const users = records.corp_users || [];

  function criarRegistros({ userIds, tipo, titulo, texto, exigeFeedback, perguntaFeedback, autor }) {
    const at = new Date().toISOString();
    const loteId = uid("lote");
    const t = tipoConduta(tipo);
    const novos = userIds.map((userId) => ({
      id: uid("cdt"), loteId, userId, tipo, titulo: titulo.trim(), texto: texto.trim(),
      autorId: autor.id, at, exigeFeedback: !!exigeFeedback,
      perguntaFeedback: exigeFeedback ? String(perguntaFeedback || "").trim() : "",
      cienteAt: null, feedback: "", sonecaAte: null, sonecas: 0,
    }));
    saveRecord("corp_conduta", (cur) => [...(cur || []), ...novos]);
    saveRecord("corp_notifs", (cur) => [
      ...(cur || []),
      ...novos.map((r) => ({
        id: uid("ntf"), taskId: "__conduta__", userId: r.userId, tipo: "conduta", read: false, at,
        text: `${t.icone} ${t.label} de ${autor.nome}: ${r.titulo}${r.exigeFeedback ? " — feedback solicitado" : ""}`,
      })),
    ]);
  }

  function atualizar(id, patch) {
    saveRecord("corp_conduta", (cur) => (cur || []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function darCiente(reg, feedback, usuario) {
    const at = new Date().toISOString();
    const fb = String(feedback || "").trim();
    atualizar(reg.id, { cienteAt: at, sonecaAte: null, ...(fb ? { feedback: fb, feedbackAt: at } : {}) });
    const t = tipoConduta(reg.tipo);
    const gestores = users.filter((u) => u.id !== usuario.id && (u.id === reg.autorId || isAdmin(u)));
    if (!gestores.length) return;
    saveRecord("corp_notifs", (cur) => [
      ...(cur || []),
      ...gestores.map((g) => ({
        id: uid("ntf"), taskId: "__conduta__", userId: g.id, tipo: "conduta_resposta", read: false, at, alvoId: reg.userId,
        text: `${usuario.nome} deu ciente em ${t.label.toLowerCase()} "${reg.titulo}"${fb ? `: ${fb}` : ""}`,
      })),
    ]);
  }

  function soneca(reg) {
    atualizar(reg.id, { sonecaAte: new Date(Date.now() + SONECA_CONDUTA_MIN * 60000).toISOString(), sonecas: (reg.sonecas || 0) + 1 });
  }

  function excluirRegistro(id) {
    saveRecord("corp_conduta", (cur) => (cur || []).filter((r) => r.id !== id));
  }

  return { criarRegistros, darCiente, soneca, excluirRegistro };
}

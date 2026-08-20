import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";

// Central de gravações em corp_overrides (jornada, financeiro, comunicação,
// próxima ação, responsável, temperatura, situação de atendimento, vínculos,
// auditoria, campos editados). Toda gravação aqui usa a forma "updater" do
// saveRecord (current => next) em vez de um valor pronto — isso importa
// porque várias ações do original disparam DUAS gravações em sequência no
// mesmo clique (ex.: "Salvar próxima ação" grava nextAction e depois grava
// um registro de auditoria; vincular dois processos grava os dois lados do
// vínculo). Sem o updater, a segunda gravação partiria de um retrato
// desatualizado e apagaria a primeira.
//
// Também corrige dois bugs do HTML original: lá, o "quem fez" (auditoria e
// histórico de comunicação) e o "perfil" vinham de um State.session/getRole()
// que nunca era atualizado com o usuário realmente logado — todo registro
// ficava eternamente atribuído a "Marina Costa"/"Admin". Aqui uso o usuário
// da sessão de verdade.
export function useOverrideActions() {
  const { records, saveRecord } = useData();
  const { currentUser } = useAuth();

  function setOvr(claimId, patch) {
    saveRecord("corp_overrides", (current) => {
      const cur = current || {};
      return { ...cur, [claimId]: { ...(cur[claimId] || {}), ...patch } };
    });
  }

  return {
    overrides: records.corp_overrides || {},

    setOverrideCampo(claimId, campo, valor) {
      valor = valor == null ? "" : String(valor);
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const existing = cur[claimId] || {};
        const campos = { ...(existing.campos || {}) };
        if (valor.trim() === "") delete campos[campo]; else campos[campo] = valor;
        return { ...cur, [claimId]: { ...existing, campos } };
      });
    },
    saveFinance: (claimId, f) => setOvr(claimId, { finance: f }),
    saveComms: (claimId, list) => setOvr(claimId, { comms: list }),
    saveNextAction: (claimId, na) => setOvr(claimId, { nextAction: na }),
    saveResponsavel: (claimId, user) => setOvr(claimId, { responsavelUser: user ? { id: user.id, nome: user.nome } : null }),
    saveSitAtend: (claimId, v) => setOvr(claimId, { sitAtend: v }),
    saveTemp: (claimId, v) => setOvr(claimId, { temperatura: v }),
    saveJourneyNotes: (claimId, v) => setOvr(claimId, { journeyNotes: v }),
    saveUserJourney: (claimId, uj) => setOvr(claimId, { journeyUser: uj }),
    setManualLinks: (claimId, ids) => setOvr(claimId, { links: ids }),

    addLink(aId, bId) {
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const linksA = (cur[aId] || {}).links || [];
        const linksB = (cur[bId] || {}).links || [];
        const next = { ...cur };
        if (linksA.indexOf(bId) < 0) next[aId] = { ...(cur[aId] || {}), links: [...linksA, bId] };
        if (linksB.indexOf(aId) < 0) next[bId] = { ...(cur[bId] || {}), links: [...linksB, aId] };
        return next;
      });
    },
    removeLink(aId, bId) {
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const next = { ...cur };
        next[aId] = { ...(cur[aId] || {}), links: ((cur[aId] || {}).links || []).filter((x) => x !== bId) };
        next[bId] = { ...(cur[bId] || {}), links: ((cur[bId] || {}).links || []).filter((x) => x !== aId) };
        return next;
      });
    },
    logAudit(claimId, acao, detalhe) {
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const existing = cur[claimId] || {};
        const entry = {
          id: "au_" + Math.random().toString(36).slice(2, 9),
          at: new Date().toISOString(),
          who: (currentUser && currentUser.nome) || "—",
          role: (currentUser && currentUser.role) || "consulta",
          acao, detalhe: detalhe || "",
        };
        return { ...cur, [claimId]: { ...existing, audit: [...(existing.audit || []), entry] } };
      });
    },
  };
}

import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";
import { alterarResponsavel } from "../logic/responsabilidade";

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
    // Anexa 1 comentário lendo o array mais atual (não um retrato antigo) —
    // usado pela importação em lote, que pode gravar várias linhas em
    // sequência rápida.
    appendComment(claimId, comment) {
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const existing = cur[claimId] || {};
        return { ...cur, [claimId]: { ...existing, comms: [...(existing.comms || []), comment] } };
      });
    },
    saveNextAction: (claimId, na) => setOvr(claimId, { nextAction: na }),
    // Mantém overrides.responsavelUser (valor único, lido em várias telas
    // de forma síncrona) E grava o intervalo correspondente no histórico de
    // responsabilidade (corp_responsabilidade_historico) — ver
    // src/logic/responsabilidade.js e docs/ia-sinistros/regras-responsabilidade.md.
    saveResponsavel(claimId, user, opts) {
      setOvr(claimId, { responsavelUser: user ? { id: user.id, nome: user.nome } : null });
      const agoraISO = new Date().toISOString();
      saveRecord("corp_responsabilidade_historico", (current) => alterarResponsavel(current, {
        claimId, novoUsuarioId: user ? user.id : null,
        motivoAlteracao: (opts && opts.motivo) || "Definido manualmente",
        observacao: (opts && opts.observacao) || "",
        alteradoPorUsuarioId: currentUser ? currentUser.id : null,
        origemAlteracao: (opts && opts.origem) || "manual",
        agoraISO,
      }));
    },
    saveSitAtend: (claimId, v) => setOvr(claimId, { sitAtend: v }),
    saveTemp: (claimId, v) => setOvr(claimId, { temperatura: v }),
    saveJourneyNotes: (claimId, v) => setOvr(claimId, { journeyNotes: v }),
    // Pesquisa de satisfação (Fase 4 — Oficinas/Seguradoras/Clientes): um
    // registro por processo, com 3 alvos (corretora/seguradora/oficina),
    // cada um com nota (estrelas) + comentário OU "não se aplica". Nunca
    // bloqueia nada — é um registro manual disponibilizado quando o
    // processo já chegou em Indenizado/Sem Indenização (ver isFinalizado em
    // claims.js), a pedido do usuário.
    savePesquisaSatisfacao(claimId, dados) {
      setOvr(claimId, { pesquisaSatisfacao: { ...dados, respondidoEm: new Date().toISOString(), respondidoPor: (currentUser && currentUser.nome) || "—" } });
    },
    // Snapshot de Agente/Produtor (endpoint /documento do CORP) — gravado
    // sob demanda (ao abrir Visão geral/Anexos de um processo) ou via
    // importação em lote (Configurações). Alimenta o filtro de Agente/
    // Produtor em Sinistros e o vínculo de acesso de usuários "Consulta".
    saveAgenteProdutor: (claimId, snapshot) => setOvr(claimId, { agenteProdutor: snapshot }),

    // Edição manual dos pares Agente/Produtor (a pedido do usuário): editar,
    // adicionar ou remover um par não pode ser desfeito pela próxima consulta
    // ao /documento do CORP. Recalcula agentes/produtores (dedup, mesma
    // lógica de normalizeAgenteProdutorSnapshot) a partir dos pares e marca
    // agenteProdutorManual — é essa marca que faz useDocumentoCorp parar de
    // sobrescrever este processo dali em diante (ver useDocumentoCorp.js).
    saveAgenteProdutorPares(claimId, pares) {
      const limpos = (pares || []).map((p) => ({ agente: (p.agente || "").trim(), produtor: (p.produtor || "").trim() }));
      const agentes = []; const produtores = [];
      const seenA = {}; const seenP = {};
      limpos.forEach((p) => {
        if (p.agente && !seenA[p.agente]) { seenA[p.agente] = true; agentes.push(p.agente); }
        if (p.produtor && !seenP[p.produtor]) { seenP[p.produtor] = true; produtores.push(p.produtor); }
      });
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const existing = cur[claimId] || {};
        const prevAp = existing.agenteProdutor || {};
        return {
          ...cur,
          [claimId]: {
            ...existing,
            agenteProdutorManual: true,
            agenteProdutor: { ...prevAp, agentes, produtores, prodDocs: limpos, atualizadoEm: new Date().toISOString() },
          },
        };
      });
    },

    // Alertas de e-mail (Gmail) — a pedido do usuário: quando um e-mail
    // bate com um processo (por nº de sinistro/placa/nome, ou vínculo
    // manual), fica registrado aqui SEM gravar nada no histórico sozinho —
    // só um alerta visual (ver DetailHeader.jsx) até o usuário decidir
    // "Transformar em atualização". Deduplica por emailId, então rodar a
    // identificação de novo (ex.: reabrir a caixa de entrada) não duplica.
    addEmailAlerta(claimId, alerta) {
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const existing = cur[claimId] || {};
        const atuais = existing.emailAlertas || [];
        if (atuais.some((a) => a.emailId === alerta.emailId)) return cur;
        return { ...cur, [claimId]: { ...existing, emailAlertas: [...atuais, alerta] } };
      });
    },
    dismissEmailAlerta(claimId, emailId) {
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const existing = cur[claimId] || {};
        return { ...cur, [claimId]: { ...existing, emailAlertas: (existing.emailAlertas || []).map((a) => (a.emailId === emailId ? { ...a, dismissed: true } : a)) } };
      });
    },
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
    // Anexos gerais do processo (proposta de seguro, dados do segurado etc.)
    // — a pedido do usuário, ver components/detail/AnexosPanel.jsx e
    // logic/anexosProcesso.js. Arquivo em si vive no Drive; aqui só guarda
    // a referência (nome/url/id/descrição/quem enviou).
    addAnexo(claimId, anexo) {
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const existing = cur[claimId] || {};
        return { ...cur, [claimId]: { ...existing, anexos: [...(existing.anexos || []), anexo] } };
      });
    },
    removeAnexo(claimId, anexoId) {
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const existing = cur[claimId] || {};
        return { ...cur, [claimId]: { ...existing, anexos: (existing.anexos || []).filter((a) => a.id !== anexoId) } };
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
    // Exclusão definitiva do processo (a pedido do usuário) — remove de
    // corp_claims e limpa o override associado (jornada, histórico,
    // financeiro, auditoria...). Só disponível pra Administrador, Atendente
    // e Analista (mesmo perfil de canEdit — ver DetailHeader.jsx). Um
    // processo vindo da API pode voltar numa próxima sincronização se o
    // período consultado incluir ele de novo — só é definitivo mesmo pra
    // processos criados manualmente.
    excluirProcesso(claimId) {
      saveRecord("corp_claims", (current) => (current || []).filter((c) => c.id !== claimId));
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        if (!cur[claimId]) return cur;
        const { [claimId]: _drop, ...rest } = cur;
        return rest;
      });
    },

    // Link de acompanhamento público (a pedido do usuário) — guarda aqui só
    // o VÍNCULO (token + está ativo?) do lado do processo; o resumo em si
    // que o cliente vê fica em corp_public_tracking, gravado por
    // usePublicTrackingActions (coleção separada, pensada pra ter regra de
    // leitura pública própria — ver logic/publicTracking.js). Gerar de
    // novo depois de revogado cria um TOKEN NOVO — o antigo nunca volta a
    // funcionar, mesmo que alguém ainda tenha o link salvo.
    gerarLinkAcompanhamento(claimId, token) {
      setOvr(claimId, { publicTracking: { token, ativo: true, criadoEm: new Date().toISOString(), criadoPor: (currentUser && currentUser.nome) || "—" } });
    },
    revogarLinkAcompanhamento(claimId) {
      saveRecord("corp_overrides", (current) => {
        const cur = current || {};
        const existing = cur[claimId] || {};
        if (!existing.publicTracking) return cur;
        return { ...cur, [claimId]: { ...existing, publicTracking: { ...existing.publicTracking, ativo: false } } };
      });
    },
  };
}

// Histórico de responsabilidade por processo — Fase 2 do plano de IA
// Corporativa (docs/ia-sinistros/regras-responsabilidade.md).
//
// Modelo: 1 entrada por INTERVALO de vigência de um responsável, nunca
// sobrescrita — trocar o responsável fecha o intervalo aberto (define
// fimResponsabilidadeEm) e abre um novo. Nunca há dois intervalos abertos
// (fimResponsabilidadeEm == null) nem sobrepostos para o mesmo claimId.
//
// Definição de "responsável no dia" adotada (decisão registrada em
// docs/ia-sinistros/regras-responsabilidade.md): responsável no MOMENTO DA
// AÇÃO — cada evento é atribuído a quem estava vigente no instante exato em
// que ocorreu, usando responsavelVigenteEm(). Não é "predominante no dia"
// nem "proporcional por horas".
export const TIMEZONE_OFICIAL = "America/Sao_Paulo";

function uidRsp() { return "rsp_" + Math.random().toString(36).slice(2, 9); }

export function getHistoricoDoProcesso(historico, claimId) {
  return (historico || [])
    .filter((h) => h.claimId === claimId)
    .slice()
    .sort((a, b) => String(a.inicioResponsabilidadeEm).localeCompare(String(b.inicioResponsabilidadeEm)));
}

export function intervaloAberto(historico, claimId) {
  return (historico || []).find((h) => h.claimId === claimId && h.fimResponsabilidadeEm == null) || null;
}

// Responsável vigente no instante exato informado (ISO 8601). Comparação
// lexicográfica de strings ISO é seguro aqui porque todo timestamp é
// gravado em UTC (new Date().toISOString()) — o fuso oficial
// (TIMEZONE_OFICIAL) só entra na hora de EXIBIR/agrupar por "dia" na UI,
// nunca na comparação de instantes.
export function responsavelVigenteEm(historico, claimId, instanteISO) {
  const alvo = String(instanteISO);
  return (historico || []).find((h) => (
    h.claimId === claimId &&
    String(h.inicioResponsabilidadeEm) <= alvo &&
    (h.fimResponsabilidadeEm == null || String(h.fimResponsabilidadeEm) > alvo)
  )) || null;
}

// Verifica se existe algum par de intervalos sobrepostos para o mesmo
// claimId no array inteiro — usado nos testes e como checagem defensiva.
export function existeSobreposicao(historico) {
  const porClaim = {};
  (historico || []).forEach((h) => { (porClaim[h.claimId] = porClaim[h.claimId] || []).push(h); });
  return Object.values(porClaim).some((lista) => {
    const ordenada = lista.slice().sort((a, b) => String(a.inicioResponsabilidadeEm).localeCompare(String(b.inicioResponsabilidadeEm)));
    for (let i = 1; i < ordenada.length; i++) {
      const anterior = ordenada[i - 1];
      const atual = ordenada[i];
      if (anterior.fimResponsabilidadeEm == null || String(anterior.fimResponsabilidadeEm) > String(atual.inicioResponsabilidadeEm)) {
        return true;
      }
    }
    return false;
  });
}

// Função pura: recebe o array atual de histórico e devolve um NOVO array
// (nunca muta o recebido) com o intervalo aberto fechado e, se houver novo
// responsável, um novo intervalo aberto criado. Idempotente: se o
// responsável vigente já é o mesmo que está sendo definido, devolve a
// MESMA referência de array (nenhuma gravação desnecessária).
export function alterarResponsavel(historicoAtual, {
  claimId, novoUsuarioId, motivoAlteracao, observacao, alteradoPorUsuarioId,
  origemAlteracao, agoraISO,
}) {
  const lista = historicoAtual || [];
  const aberto = intervaloAberto(lista, claimId);

  if (aberto && aberto.usuarioResponsavelId === (novoUsuarioId || null)) {
    return lista; // sem mudança real — evita gravação/entrada redundante
  }
  if (!aberto && !novoUsuarioId) {
    return lista; // já estava sem responsável, continua sem responsável
  }

  const agora = agoraISO || new Date().toISOString();
  const next = lista.map((h) => (
    h === aberto ? { ...h, fimResponsabilidadeEm: agora, updatedAt: agora } : h
  ));

  if (novoUsuarioId) {
    next.push({
      id: uidRsp(),
      claimId,
      usuarioResponsavelId: novoUsuarioId,
      inicioResponsabilidadeEm: agora,
      fimResponsabilidadeEm: null,
      motivoAlteracao: motivoAlteracao || "Definido manualmente",
      observacao: observacao || "",
      alteradoPorUsuarioId: alteradoPorUsuarioId || null,
      origemAlteracao: origemAlteracao || "manual",
      createdAt: agora,
      updatedAt: agora,
    });
  }
  return next;
}

// Reconstrução best-effort do histórico legado a partir do log de auditoria
// em texto livre (corp_overrides[claimId].audit[]) já existente — único
// rastro disponível hoje sobre trocas de responsável anteriores a esta
// implementação. NUNCA apresentar o resultado como fato: toda entrada
// gerada aqui recebe origemAlteracao: "estimado_legado" e um motivo que
// deixa explícita a limitação, conforme decisão registrada em
// docs/ia-sinistros/regras-responsabilidade.md.
//
// Limitações conhecidas (documentadas, não escondidas):
// - Só enxerga trocas feitas pela tela de detalhe (DetailHeader.jsx), que é
//   o único ponto que grava "Responsável definido" na auditoria hoje.
// - O responsável inicial definido via Abertura.jsx não deixa entrada de
//   auditoria específica — quando é o único dado disponível, a data de
//   início do primeiro intervalo é a data desta migração, não a data real
//   de início (fica marcado como tal no motivoAlteracao).
export function estimarHistoricoLegado(claim, overrides, users, agoraISO) {
  const agora = agoraISO || new Date().toISOString();
  const ovr = (overrides && overrides[claim.id]) || {};
  const auditoria = (ovr.audit || [])
    .filter((a) => a.acao === "Responsável definido")
    .slice()
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));

  function resolverUsuarioIdPorNome(nome) {
    if (!nome || nome === "(removido)") return null;
    const u = (users || []).find((x) => x.nome === nome);
    return u ? u.id : null;
  }

  const intervalos = [];
  auditoria.forEach((entry) => {
    const usuarioId = resolverUsuarioIdPorNome(entry.detalhe);
    const anterior = intervalos[intervalos.length - 1];
    if (anterior) anterior.fimResponsabilidadeEm = entry.at;
    if (usuarioId) {
      intervalos.push({
        id: uidRsp(), claimId: claim.id, usuarioResponsavelId: usuarioId,
        inicioResponsabilidadeEm: entry.at, fimResponsabilidadeEm: null,
        motivoAlteracao: "Reconstruído a partir da auditoria interna do processo (data real do evento).",
        observacao: "Gerado automaticamente pela migração de histórico legado.",
        alteradoPorUsuarioId: null, origemAlteracao: "estimado_legado",
        createdAt: agora, updatedAt: agora,
      });
    }
  });

  // Se o responsável atual (overrides.responsavelUser) não bate com o
  // último intervalo reconstruído (ex.: nenhuma auditoria disponível, só o
  // valor atual), fecha o que sobrou e abre um intervalo final SEM data de
  // início confiável — usa a data da migração, deixando isso explícito.
  const atual = ovr.responsavelUser || null;
  const ultimo = intervalos[intervalos.length - 1];
  if (atual && (!ultimo || ultimo.usuarioResponsavelId !== atual.id)) {
    if (ultimo) ultimo.fimResponsabilidadeEm = agora;
    intervalos.push({
      id: uidRsp(), claimId: claim.id, usuarioResponsavelId: atual.id,
      inicioResponsabilidadeEm: agora, fimResponsabilidadeEm: null,
      motivoAlteracao: "Responsável atual sem data de início confiável na auditoria — data de início é a da migração, não a data real de atribuição.",
      observacao: "Gerado automaticamente pela migração de histórico legado.",
      alteradoPorUsuarioId: null, origemAlteracao: "estimado_legado",
      createdAt: agora, updatedAt: agora,
    });
  }

  return intervalos;
}

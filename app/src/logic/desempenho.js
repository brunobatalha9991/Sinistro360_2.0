// Analytics de desempenho — Fase 5 (IA Sinistros). Depende inteiramente do
// histórico de responsabilidade da Fase 2 (corp_responsabilidade_historico)
// para respeitar a regra de justiça: um usuário nunca é penalizado por
// tempo/atraso anterior ao início da sua responsabilidade sobre o processo.
//
// Escopo deliberadamente simplificado em relação ao pedido original —
// decisão registrada em docs/ia-sinistros/metricas-desempenho.md: a
// corretora confirmou até 5 usuários ativos e nenhum SLA formal além da
// "Próxima ação" já existente, então não há equipe/carteira/SLA formal a
// filtrar ainda.
import { visibleClaims, getResponsavel, isFinalizado, isAtrasado } from "./claims";
import { getHistoricoDoProcesso } from "./responsabilidade";

function sobrepoe(intervalo, inicioISO, fimISO) {
  const iniOk = !fimISO || String(intervalo.inicioResponsabilidadeEm) < fimISO;
  const fimOk = !inicioISO || intervalo.fimResponsabilidadeEm == null || String(intervalo.fimResponsabilidadeEm) > inicioISO;
  return iniOk && fimOk;
}

export function intervalosDoUsuarioNoPeriodo(historico, usuarioId, inicioISO, fimISO) {
  return (historico || []).filter((h) => h.usuarioResponsavelId === usuarioId && sobrepoe(h, inicioISO, fimISO));
}

export function estoqueAtualDoUsuario(claims, overrides, usuarioId, atendTemplateCfg) {
  return visibleClaims(claims).filter((c) => {
    const r = getResponsavel(overrides, c.id);
    return r && r.id === usuarioId && !isFinalizado(overrides, c, atendTemplateCfg);
  });
}

function duracaoDias(inicioISO, fimISO) {
  const ms = new Date(fimISO).getTime() - new Date(inicioISO).getTime();
  return ms / 86400000;
}

export function calcularMetricasUsuario({ claims, overrides, historico, usuarioId, periodoInicioISO, periodoFimISO, atendTemplateCfg }) {
  const intervalos = intervalosDoUsuarioNoPeriodo(historico, usuarioId, periodoInicioISO, periodoFimISO);
  const assumidos = intervalos.filter((h) => (
    (!periodoInicioISO || String(h.inicioResponsabilidadeEm) >= periodoInicioISO) &&
    (!periodoFimISO || String(h.inicioResponsabilidadeEm) <= periodoFimISO)
  ));
  const claimIdsNoPeriodo = [...new Set(intervalos.map((h) => h.claimId))];

  const estoqueAtual = estoqueAtualDoUsuario(claims, overrides, usuarioId, atendTemplateCfg);
  const atrasadosAtual = estoqueAtual.filter((c) => isAtrasado(overrides, c));
  const semHistorico = estoqueAtual.filter((c) => !getHistoricoDoProcesso(historico, c.id).length);

  const fechados = intervalos.filter((h) => h.fimResponsabilidadeEm != null);
  const tempoMedioResponsabilidadeDias = fechados.length
    ? fechados.reduce((soma, h) => soma + duracaoDias(h.inicioResponsabilidadeEm, h.fimResponsabilidadeEm), 0) / fechados.length
    : null;

  return {
    usuarioId,
    periodo: { inicio: periodoInicioISO || null, fim: periodoFimISO || null },
    processosAssumidosNoPeriodo: assumidos.length,
    processosSobResponsabilidadeNoPeriodo: claimIdsNoPeriodo.length,
    estoqueAtual: estoqueAtual.length,
    atrasadosAtual: atrasadosAtual.length,
    tempoMedioResponsabilidadeDias,
    processosSemHistoricoEstruturado: semHistorico.length,
    claimIdsEstoqueAtual: estoqueAtual.map((c) => c.id),
    claimIdsAtrasados: atrasadosAtual.map((c) => c.id),
  };
}

export function calcularMetricasTodosUsuarios({ users, claims, overrides, historico, periodoInicioISO, periodoFimISO, atendTemplateCfg }) {
  return (users || []).map((u) => ({
    usuarioId: u.id, usuarioNome: u.nome,
    ...calcularMetricasUsuario({ claims, overrides, historico, usuarioId: u.id, periodoInicioISO, periodoFimISO, atendTemplateCfg }),
  }));
}

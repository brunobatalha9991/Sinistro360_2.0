// Analytics de desempenho — Fase 5 (IA Sinistros), ampliado numa "v2" a
// pedido do usuário (gestão de equipe: Atendentes/Analistas). Continua
// dependendo do histórico de responsabilidade da Fase 2
// (corp_responsabilidade_historico) para respeitar a regra de justiça: um
// usuário nunca é penalizado por tempo/atraso/evento anterior ao início da
// sua responsabilidade sobre o processo — cada evento novo (histórico,
// próxima ação, desfecho) só conta pro usuário que era o responsável
// VIGENTE no instante exato em que aconteceu (responsavelVigenteEm),
// não "o responsável atual".
import {
  visibleClaims, getResponsavel, isFinalizado, isAtrasado, isSemAtualizacao, situacaoEfetiva,
  loadComms, loadAudit, comFlagContaComoMetrica,
  pesquisaSatisfacaoCompleta, ultimaEtapaEfetiva, getUserJourney, inicioAndamentoEm,
} from "./claims";
import { getHistoricoDoProcesso, responsavelVigenteEm } from "./responsabilidade";
import { taskParticipants } from "./tasks";
import { mediaArr } from "./format";

function sobrepoe(intervalo, inicioISO, fimISO) {
  const iniOk = !fimISO || String(intervalo.inicioResponsabilidadeEm) < fimISO;
  const fimOk = !inicioISO || intervalo.fimResponsabilidadeEm == null || String(intervalo.fimResponsabilidadeEm) > inicioISO;
  return iniOk && fimOk;
}

export function intervalosDoUsuarioNoPeriodo(historico, usuarioId, inicioISO, fimISO) {
  return (historico || []).filter((h) => h.usuarioResponsavelId === usuarioId && sobrepoe(h, inicioISO, fimISO));
}

export function estoqueAtualDoUsuario(claims, overrides, usuarioId, atendTemplateCfg, templates) {
  return visibleClaims(claims).filter((c) => {
    const r = getResponsavel(overrides, c.id);
    return r && r.id === usuarioId && !isFinalizado(overrides, c, atendTemplateCfg, templates);
  });
}

function duracaoDias(inicioISO, fimISO) {
  const ms = new Date(fimISO).getTime() - new Date(inicioISO).getTime();
  return ms / 86400000;
}
// Interseção, em dias, de [aIni,aFim) com [bIni,bFim) — todos em ms desde a
// época (Infinity representa "sem limite" pra um lado ou outro).
function overlapDias(aIni, aFim, bIni, bFim) {
  const ini = Math.max(aIni, bIni);
  const fim = Math.min(aFim, bFim);
  return fim > ini ? (fim - ini) / 86400000 : 0;
}
// Cruza os marcos de transição de cada processo (Pendente→Em andamento via
// inicioAndamentoEm, Em andamento→Finalizado via ultimaEtapaEfetiva) com os
// intervalos FECHADOS de responsabilidade do usuário (mesmo grupo usado em
// tempoMedioResponsabilidadeDias) — pra saber quantos dias, em média, cada
// intervalo de responsabilidade dele passou em cada situação. Processo cuja
// transição é `indeterminado` (caminho por ramo já escolhido, mas sem
// nenhuma evidência de quando) fica de fora da conta — não inventa que
// "ainda está pendente" quando na verdade só falta o dado.
function temposPorSituacaoNosFechados(claims, overrides, templates, atendTemplateCfg, fechados) {
  const claimsPorId = {};
  (claims || []).forEach((c) => { claimsPorId[c.id] = c; });
  const pendenteArr = [], andamentoArr = [];
  const aproximados = new Set(), indisponiveis = new Set();

  fechados.forEach((h) => {
    const c = claimsPorId[h.claimId];
    if (!c) return;
    const { em: b1, aproximado, indeterminado } = inicioAndamentoEm(overrides, templates, atendTemplateCfg, c);
    if (indeterminado) { indisponiveis.add(c.id); return; }
    if (aproximado) aproximados.add(c.id);

    const step = ultimaEtapaEfetiva(overrides, templates, atendTemplateCfg, c);
    const sdFim = step && ((getUserJourney(overrides, c.id) || {}).steps || {})[step.id];
    const b2 = (sdFim && sdFim.concludedAt) || null;

    const iniH = new Date(h.inicioResponsabilidadeEm).getTime();
    const fimH = new Date(h.fimResponsabilidadeEm).getTime();
    const b1Ms = b1 ? new Date(b1).getTime() : Infinity;
    const b2Ms = b2 ? new Date(b2).getTime() : Infinity;
    pendenteArr.push(overlapDias(iniH, fimH, -Infinity, b1Ms));
    andamentoArr.push(overlapDias(iniH, fimH, b1Ms, b2Ms));
  });

  return { pendenteArr, andamentoArr, aproximados: aproximados.size, indisponiveis: indisponiveis.size };
}
function dentroPeriodo(iso, inicioISO, fimISO) {
  if (!iso) return false;
  const v = String(iso);
  if (inicioISO && v < inicioISO) return false;
  if (fimISO && v > fimISO) return false;
  return true;
}
// Só conta um evento (comunicação, próxima ação, desfecho) pro usuário se
// ele era o responsável VIGENTE no instante exato do evento — a mesma
// regra de justiça da Fase 2, aplicada evento a evento em vez de "quem é o
// responsável agora".
function eventoDoUsuario(historico, claimId, atISO, usuarioId) {
  const r = responsavelVigenteEm(historico, claimId, atISO);
  return !!(r && r.usuarioResponsavelId === usuarioId);
}
function atComm(m) { return m.at || (m.date ? m.date + "T12:00:00.000Z" : null); }

// Histórico de comunicações (aba Histórico) atribuído ao usuário no
// período: quantidade, "aguardando retorno"/"limitação de comunicação"
// (mesmo critério de perpetuação de métrica já usado no filtro de
// Sinistros — comFlagContaComoMetrica) e nota média das avaliações.
function historicoDoUsuarioNoPeriodo(claims, overrides, historico, usuarioId, periodoInicioISO, periodoFimISO) {
  let qtd = 0, aguardandoRetorno = 0, limitacaoComunicacao = 0;
  const notas = [];
  (claims || []).forEach((c) => {
    loadComms(overrides, c.id).forEach((m) => {
      const at = atComm(m);
      if (!dentroPeriodo(at, periodoInicioISO, periodoFimISO)) return;
      if (!eventoDoUsuario(historico, c.id, at, usuarioId)) return;
      qtd++;
      if (comFlagContaComoMetrica(m, "aguardandoRetorno")) aguardandoRetorno++;
      if (comFlagContaComoMetrica(m, "limitacaoComunicacao")) limitacaoComunicacao++;
      if (Number(m.avaliacao) > 0) notas.push(Number(m.avaliacao));
    });
  });
  return { qtd, aguardandoRetorno, limitacaoComunicacao, avaliacaoMedia: mediaArr(notas) };
}

// Próximas ações DEFINIDAS (registradas) no período — usa a auditoria
// interna ("Próxima ação definida", gravada em NextActionPanel.jsx), não o
// valor atual de nextAction (que não guarda quantas vezes foi trocado).
function proximasAcoesRegistradasNoPeriodo(claims, overrides, historico, usuarioId, periodoInicioISO, periodoFimISO) {
  let qtd = 0;
  (claims || []).forEach((c) => {
    loadAudit(overrides, c.id).forEach((a) => {
      if (a.acao !== "Próxima ação definida") return;
      if (!dentroPeriodo(a.at, periodoInicioISO, periodoFimISO)) return;
      if (!eventoDoUsuario(historico, c.id, a.at, usuarioId)) return;
      qtd++;
    });
  });
  return qtd;
}

// Processos FINALIZADOS (Indenizado/Encerrado sem Indenização) no
// período, atribuídos a quem era responsável no instante do desfecho —
// data do desfecho = concludedAt da ÚLTIMA etapa efetiva (ver
// ultimaEtapaEfetiva/JourneyPanel.jsx). Aproximação honesta: não existe um
// campo "situação mudou em X", este é o timestamp mais confiável que o
// sistema já grava.
function finalizadosNoPeriodo(claims, overrides, templates, atendTemplateCfg, historico, usuarioId, periodoInicioISO, periodoFimISO) {
  let indenizados = 0, semIndenizacao = 0;
  const claimIds = [];
  (claims || []).forEach((c) => {
    const sit = situacaoEfetiva(overrides, c, atendTemplateCfg, templates).label;
    if (sit !== "Indenizado" && sit !== "Encerrado sem Indenização") return;
    const step = ultimaEtapaEfetiva(overrides, templates, atendTemplateCfg, c);
    if (!step) return;
    const sd = ((getUserJourney(overrides, c.id) || {}).steps || {})[step.id];
    const concludedAt = sd && sd.concludedAt;
    if (!dentroPeriodo(concludedAt, periodoInicioISO, periodoFimISO)) return;
    if (!eventoDoUsuario(historico, c.id, concludedAt, usuarioId)) return;
    if (sit === "Indenizado") indenizados++; else semIndenizacao++;
    claimIds.push(c.id);
  });
  return { indenizados, semIndenizacao, total: indenizados + semIndenizacao, claimIds };
}

// Tarefas de Comunicação interna (origem OU destinatário) criadas no
// período — "assistencias" é o subconjunto Mesa de Atendimento.
function tarefasDoUsuarioNoPeriodo(tasks, usuarioId, periodoInicioISO, periodoFimISO) {
  let tarefas = 0, assistencias = 0;
  (tasks || []).forEach((t) => {
    if (taskParticipants(t).indexOf(usuarioId) < 0) return;
    if (!dentroPeriodo(t.createdAt, periodoInicioISO, periodoFimISO)) return;
    tarefas++;
    if (t.tipo === "Mesa de Atendimento") assistencias++;
  });
  return { tarefas, assistencias };
}

// Dias desde a última comunicação registrada em cada processo do estoque
// atual — null quando não há nenhuma (não entra na média, é reportado à
// parte como "sem histórico").
function diasSemAtualizacao(overrides, c) {
  const comms = loadComms(overrides, c.id);
  const ultimo = comms.length ? comms[comms.length - 1] : null;
  const d = ultimo ? (ultimo.date || (ultimo.at ? String(ultimo.at).slice(0, 10) : null)) : null;
  if (!d) return null;
  return (Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000;
}

export function calcularMetricasUsuario({
  claims, overrides, historico, usuarioId, periodoInicioISO, periodoFimISO,
  atendTemplateCfg, templates, tasks,
}) {
  const intervalos = intervalosDoUsuarioNoPeriodo(historico, usuarioId, periodoInicioISO, periodoFimISO);
  const assumidos = intervalos.filter((h) => (
    (!periodoInicioISO || String(h.inicioResponsabilidadeEm) >= periodoInicioISO) &&
    (!periodoFimISO || String(h.inicioResponsabilidadeEm) <= periodoFimISO)
  ));
  const claimIdsNoPeriodo = [...new Set(intervalos.map((h) => h.claimId))];

  const estoqueAtual = estoqueAtualDoUsuario(claims, overrides, usuarioId, atendTemplateCfg, templates);
  const atrasadosAtual = estoqueAtual.filter((c) => isAtrasado(overrides, c));
  const semHistorico = estoqueAtual.filter((c) => !getHistoricoDoProcesso(historico, c.id).length);
  const pendentesAtual = estoqueAtual.filter((c) => situacaoEfetiva(overrides, c, atendTemplateCfg, templates).label === "Pendente").length;
  const emAndamentoAtual = estoqueAtual.length - pendentesAtual;
  const diasSemAtu = estoqueAtual.map((c) => diasSemAtualizacao(overrides, c)).filter((d) => d != null);
  const semAtualizacaoAtual = estoqueAtual.filter((c) => isSemAtualizacao(overrides, c, atendTemplateCfg, templates)).length;
  const pesquisasCompletas = estoqueAtual.filter((c) => pesquisaSatisfacaoCompleta(overrides, c.id)).length;

  const fechados = intervalos.filter((h) => h.fimResponsabilidadeEm != null);
  const tempoMedioResponsabilidadeDias = fechados.length
    ? fechados.reduce((soma, h) => soma + duracaoDias(h.inicioResponsabilidadeEm, h.fimResponsabilidadeEm), 0) / fechados.length
    : null;
  const porSituacao = temposPorSituacaoNosFechados(claims, overrides, templates || {}, atendTemplateCfg, fechados);
  const tempoMedioPendenteDias = mediaArr(porSituacao.pendenteArr);
  const tempoMedioAndamentoDias = mediaArr(porSituacao.andamentoArr);

  const historicoPeriodo = historicoDoUsuarioNoPeriodo(claims, overrides, historico, usuarioId, periodoInicioISO, periodoFimISO);
  const proximasAcoesQtd = proximasAcoesRegistradasNoPeriodo(claims, overrides, historico, usuarioId, periodoInicioISO, periodoFimISO);
  const finalizados = finalizadosNoPeriodo(claims, overrides, templates || {}, atendTemplateCfg, historico, usuarioId, periodoInicioISO, periodoFimISO);
  const { tarefas: tarefasQtd, assistencias: assistenciasQtd } = tarefasDoUsuarioNoPeriodo(tasks, usuarioId, periodoInicioISO, periodoFimISO);

  return {
    usuarioId,
    periodo: { inicio: periodoInicioISO || null, fim: periodoFimISO || null },
    processosAssumidosNoPeriodo: assumidos.length,
    processosSobResponsabilidadeNoPeriodo: claimIdsNoPeriodo.length,
    estoqueAtual: estoqueAtual.length,
    pendentesAtual, emAndamentoAtual,
    atrasadosAtual: atrasadosAtual.length,
    semAtualizacaoAtual,
    mediaDiasSemAtualizacao: mediaArr(diasSemAtu),
    pesquisasSatisfacaoCompletas: pesquisasCompletas,
    tempoMedioResponsabilidadeDias,
    tempoMedioPendenteDias, tempoMedioAndamentoDias,
    processosTransicaoAproximada: porSituacao.aproximados,
    processosTransicaoIndisponivel: porSituacao.indisponiveis,
    processosSemHistoricoEstruturado: semHistorico.length,
    historicosRegistrados: historicoPeriodo.qtd,
    aguardandoRetornoQtd: historicoPeriodo.aguardandoRetorno,
    limitacaoComunicacaoQtd: historicoPeriodo.limitacaoComunicacao,
    avaliacaoMediaHistorico: historicoPeriodo.avaliacaoMedia,
    proximasAcoesRegistradas: proximasAcoesQtd,
    finalizadosNoPeriodo: finalizados.total,
    indenizadosNoPeriodo: finalizados.indenizados,
    semIndenizacaoNoPeriodo: finalizados.semIndenizacao,
    tarefasNoPeriodo: tarefasQtd,
    assistenciasNoPeriodo: assistenciasQtd,
    claimIdsEstoqueAtual: estoqueAtual.map((c) => c.id),
    claimIdsAtrasados: atrasadosAtual.map((c) => c.id),
  };
}

export function calcularMetricasTodosUsuarios({ users, claims, overrides, historico, periodoInicioISO, periodoFimISO, atendTemplateCfg, templates, tasks }) {
  return (users || []).map((u) => ({
    usuarioId: u.id, usuarioNome: u.nome, usuarioFoto: u.fotoUrl || null,
    ...calcularMetricasUsuario({ claims, overrides, historico, usuarioId: u.id, periodoInicioISO, periodoFimISO, atendTemplateCfg, templates, tasks }),
  }));
}

function mediaCampo(lista, campo) {
  const vals = (lista || []).map((x) => x[campo]).filter((v) => v != null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}
// "bom"/"ruim"/"dentro" — compara `valor` com a média do time, com uma
// margem de tolerância (não sinaliza diferença de ruído). `menorMelhor`
// inverte o sentido (ex.: atrasados — menor é melhor; nota — maior é melhor).
function classificar(valor, mediaTime, menorMelhor, tolerancia = 0.15) {
  if (valor == null || mediaTime == null) return null;
  if (mediaTime === 0) {
    if (valor === 0) return "dentro";
    return menorMelhor ? "ruim" : "bom";
  }
  const diff = (valor - mediaTime) / mediaTime;
  if (Math.abs(diff) <= tolerancia) return "dentro";
  const acima = diff > 0;
  return (acima && !menorMelhor) || (!acima && menorMelhor) ? "bom" : "ruim";
}
function fmtDimensao(v, tipo) {
  if (v == null) return "—";
  if (tipo === "pct") return (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "%";
  if (tipo === "dias") return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " d";
  if (tipo === "nota") return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return String(Math.round(v));
}
const DIMENSOES_FEEDBACK = [
  { campo: "pctAtrasados", label: "processos atrasados no estoque", menorMelhor: true, fmt: "pct" },
  { campo: "pctSemAtualizacao", label: "processos sem atualização no estoque", menorMelhor: true, fmt: "pct" },
  { campo: "tempoMedioAndamentoDias", label: "tempo médio em Em andamento", menorMelhor: true, fmt: "dias" },
  { campo: "tempoMedioPendenteDias", label: "tempo médio em Pendente", menorMelhor: true, fmt: "dias" },
  { campo: "avaliacaoMediaHistorico", label: "nota média das comunicações", menorMelhor: false, fmt: "nota" },
  { campo: "finalizadosNoPeriodo", label: "processos finalizados no período", menorMelhor: false, fmt: "num" },
];
function comPercentuais(x) {
  return {
    ...x,
    pctAtrasados: x.estoqueAtual > 0 ? x.atrasadosAtual / x.estoqueAtual : 0,
    pctSemAtualizacao: x.estoqueAtual > 0 ? x.semAtualizacaoAtual / x.estoqueAtual : 0,
  };
}

// Feedback e Plano de ação GERADOS PELO SISTEMA (a pedido do usuário: nada
// digitado manualmente, tudo a partir do cruzamento dos indicadores já
// calculados). Compara o usuário com a MÉDIA DO TIME no mesmo período — mais
// justo que limiares fixos arbitrários, dado que a equipe é pequena e não há
// SLA formal (ver docs/ia-sinistros/metricas-desempenho.md). Com time de 1
// pessoa só (sem base de comparação), cai em regras absolutas. Determinístico
// e sem IA — sempre disponível, sempre auditável (dá pra explicar cada frase
// apontando pro número que a gerou).
export function gerarFeedbackEPlanoDeAcao(m, todosDoTime) {
  const todos = (todosDoTime || []).map(comPercentuais);
  const usuario = comPercentuais(m);
  const comparavel = todos.length > 1;

  const pontosFortes = [], pontosAtencao = [];
  if (comparavel) {
    DIMENSOES_FEEDBACK.forEach((d) => {
      const mediaTime = mediaCampo(todos, d.campo);
      const cls = classificar(usuario[d.campo], mediaTime, d.menorMelhor);
      if (!cls || cls === "dentro") return;
      const texto = `${fmtDimensao(usuario[d.campo], d.fmt)} de ${d.label} (média do time: ${fmtDimensao(mediaTime, d.fmt)})`;
      (cls === "bom" ? pontosFortes : pontosAtencao).push(texto);
    });
  } else {
    if (m.atrasadosAtual > 0) pontosAtencao.push(`${m.atrasadosAtual} processo(s) atrasado(s) no estoque atual`);
    if (m.semAtualizacaoAtual > 0) pontosAtencao.push(`${m.semAtualizacaoAtual} processo(s) sem atualização no estoque atual`);
    if (m.avaliacaoMediaHistorico != null && m.avaliacaoMediaHistorico < 3) pontosAtencao.push(`Nota média das comunicações abaixo do esperado (${fmtDimensao(m.avaliacaoMediaHistorico, "nota")}/5)`);
    if (m.atrasadosAtual === 0 && m.semAtualizacaoAtual === 0) pontosFortes.push("Nenhum processo atrasado ou sem atualização no estoque atual");
  }

  const planoDeAcao = [];
  if (m.atrasadosAtual > 0) {
    planoDeAcao.push({ texto: `Revisar e definir nova "Próxima ação" para ${m.atrasadosAtual} processo(s) atrasado(s)`, filtro: { atrasado: true } });
  }
  if (m.semAtualizacaoAtual > 0) {
    planoDeAcao.push({ texto: `Registrar contato/atualização em ${m.semAtualizacaoAtual} processo(s) sem atualização há mais de 3 dias`, filtro: { semAtu: true } });
  }
  if (m.pendentesAtual > 0) {
    const mediaPendentesTime = comparavel ? mediaCampo(todos, "pendentesAtual") : null;
    if (!comparavel || m.pendentesAtual > (mediaPendentesTime || 0) * 1.15) {
      planoDeAcao.push({ texto: `Avançar ${m.pendentesAtual} processo(s) ainda Pendente(s) — iniciar jornada/definir caminho`, filtro: { status: "Pendente" } });
    }
  }
  if (m.avaliacaoMediaHistorico != null && m.avaliacaoMediaHistorico < 3) {
    planoDeAcao.push({ texto: "Priorizar a qualidade do contato registrado no Histórico — nota média abaixo do esperado", filtro: null });
  }
  if (!planoDeAcao.length) planoDeAcao.push({ texto: "Nenhuma pendência crítica no momento — manter o ritmo atual", filtro: null });

  return { pontosFortes, pontosAtencao, planoDeAcao, comparavel };
}

// Entrega e Produção (Índice de Desempenho v4 — a pedido do usuário,
// 2026-10-29: "o que tinha para fazer hoje, o que foi feito").
//
// DEMANDA DO DIA — reconstruída como estava no INÍCIO de cada dia, a partir
// do que o sistema já grava (nada de "foto" que dependa de alguém estar
// com o sistema aberto):
//   - carteira: processos em que o usuário era o responsável vigente no
//     início do dia (corp_responsabilidade_historico; processo sem nenhum
//     intervalo registrado cai no responsável atual), sem os já finalizados
//     antes do dia;
//   - entra na demanda o processo da carteira com PRÓXIMA AÇÃO vencida ou
//     vencendo no dia (prazo vigente no início do dia = último "Próxima
//     ação definida" da auditoria antes do dia) e/ou SEM ATUALIZAÇÃO (último
//     histórico registrado antes do dia com data de mais de 3 dias, mesma
//     regra de isSemAtualizacao, respeitando o "Dentro do prazo" renovado).
// Cada processo da demanda termina o dia como:
//   - "feito": o próprio usuário registrou histórico nele no dia (vale 1);
//   - "parcial": mexeu (jornada, próxima ação, qualquer atualização) mas sem
//     histórico (vale 0,5 — decisão do usuário);
//   - "outro": outro usuário registrou histórico (sai da conta — não pune
//     nem premia);
//   - "pendente": nada (vale 0).
// No dia de HOJE a cobrança é proporcional ao quanto do expediente já
// passou — às 9h ninguém deve ter feito tudo; no fim do dia, sim.
//
// PRODUÇÃO — processos diferentes em que o usuário atuou em cada dia
// (histórico, auditoria, jornada) contra a meta diária = carteira ÷ 3
// (cada processo precisa de atualização a cada 3 dias), com mínimo
// configurável (corp_desempenho_cfg.metaMinimaDiaria, padrão 10).
import { visibleClaims, loadComms, loadAudit, getUserJourney, getNextAction, getResponsavel, isFinalizado, ultimaEtapaEfetiva } from "./claims";
import { feitoPor, ehAcaoJornada, CANAL_IMPORTADO } from "./autoria";
import { dataLocalISO, addDias, inicioDiaLocalISO, fimDiaLocalISO, hhmmToMin, diaSemana } from "./agenda";

export const DIAS_SEM_ATUALIZACAO = 3;
export const DESEMPENHO_CFG_DEFAULT = { metaMinimaDiaria: 10, toleranciaChegadaMin: 10 };
export const MAX_DIAS_ENTREGA = 31;
export const PESO_PARCIAL = 0.5;

export function desempenhoCfg(config) {
  return { ...DESEMPENHO_CFG_DEFAULT, ...((config && config.corp_desempenho_cfg) || {}) };
}

function dataDe(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso || "").slice(0, 10) : dataLocalISO(d);
}
function prazoDoDetalhe(detalhe) {
  const m = String(detalhe || "").match(/prazo (\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// ---------- índice por processo (montado uma vez por versão dos dados) ----------
const cache = new WeakMap();

export function indiceProcessos({ claims, overrides, historico, templates, atendTemplateCfg }) {
  const ov = overrides || {};
  const hit = cache.get(ov);
  if (hit && hit.claims === claims && hit.historico === historico && hit.templates === templates && hit.atend === atendTemplateCfg) return hit.valor;

  const intervalos = {};
  (historico || []).forEach((h) => { (intervalos[h.claimId] = intervalos[h.claimId] || []).push(h); });

  const valor = visibleClaims(claims || []).map((c) => {
    const comms = loadComms(ov, c.id).map((m) => {
      const at = m.at || (m.date ? new Date(m.date + "T12:00:00").toISOString() : null);
      return { at, data: m.date || (at ? dataDe(at) : ""), autorId: m.whoId, autorNome: m.who, importado: m.canal === CANAL_IMPORTADO };
    }).filter((m) => m.at);

    const prazos = [], renovacoes = [], acoes = [];
    let jornadaAudit = false;
    loadAudit(ov, c.id).forEach((a) => {
      if (!a.at) return;
      if (a.acao === "Próxima ação definida") prazos.push({ at: a.at, prazo: prazoDoDetalhe(a.detalhe) });
      else if (a.acao === "Próxima ação concluída/removida") prazos.push({ at: a.at, prazo: null });
      if (a.acao === "Prazo do histórico renovado") renovacoes.push(a.at);
      if (/importad[ao] via planilha$/.test(a.acao || "") || a.acao === "Comunicação registrada") return;
      if (ehAcaoJornada(a.acao)) jornadaAudit = true;
      acoes.push({ at: a.at, autorId: a.whoId, autorNome: a.who });
    });
    // Jornada antes da auditoria "Jornada: ..." (2026-10-29): só a última
    // interação de cada etapa.
    if (!jornadaAudit) {
      Object.values((getUserJourney(ov, c.id) || {}).steps || {}).forEach((sd) => {
        if (sd && sd.lastInteractionAt) acoes.push({ at: sd.lastInteractionAt, autorId: sd.lastInteractionById, autorNome: sd.lastInteractionBy });
      });
    }

    let finalizadoEm = null;
    if (isFinalizado(ov, c, atendTemplateCfg, templates)) {
      const step = ultimaEtapaEfetiva(ov, templates || {}, atendTemplateCfg, c);
      const sd = step && ((getUserJourney(ov, c.id) || {}).steps || {})[step.id];
      finalizadoEm = (sd && sd.concludedAt) || "0000";
    }
    const na = getNextAction(ov, c.id);
    return {
      c, comms, prazos, renovacoes, acoes, finalizadoEm,
      intervalos: intervalos[c.id] || [],
      responsavelAtualId: (getResponsavel(ov, c.id) || {}).id || null,
      prazoAtual: na && na.date ? na.date : null,
    };
  });
  cache.set(ov, { claims, historico, templates, atend: atendTemplateCfg, valor });
  return valor;
}

function responsavelNoInicio(p, iniISO) {
  if (!p.intervalos.length) return p.responsavelAtualId;
  const h = p.intervalos.find((x) => String(x.inicioResponsabilidadeEm) <= iniISO && (x.fimResponsabilidadeEm == null || String(x.fimResponsabilidadeEm) > iniISO));
  return h ? h.usuarioResponsavelId : null;
}

// Prazo da próxima ação vigente no início do dia (null = sem próxima ação
// ou sem como saber).
function prazoNoInicio(p, iniISO) {
  let ult = null;
  p.prazos.forEach((e) => { if (String(e.at) < iniISO && (!ult || String(e.at) > String(ult.at))) ult = e; });
  if (ult) return ult.prazo;
  return p.prazos.length ? null : p.prazoAtual;
}

function semAtualizacaoNoInicio(p, data, iniISO) {
  const limite = addDias(data, -DIAS_SEM_ATUALIZACAO);
  if (p.renovacoes.some((at) => String(at) < iniISO && addDias(dataDe(at), DIAS_SEM_ATUALIZACAO) >= data)) return { sem: false };
  let ult = null;
  p.comms.forEach((m) => { if (String(m.at) < iniISO) ult = m; });
  if (!ult || !ult.data) return { sem: true, dias: null };
  if (ult.data >= limite) return { sem: false };
  return { sem: true, dias: Math.round((new Date(data + "T12:00:00") - new Date(ult.data + "T12:00:00")) / 86400000) };
}

function noIntervalo(at, ini, fim) {
  const s = String(at || "");
  return s >= ini && s <= fim;
}

// Fração do expediente já passada (dias anteriores = 1).
export function progressoExpediente(data, agora, inicio = "08:30", fim = "18:00") {
  const hoje = dataLocalISO(agora);
  if (data < hoje) return 1;
  if (data > hoje) return 0;
  const min = agora.getHours() * 60 + agora.getMinutes();
  const ini = hhmmToMin(inicio), f = hhmmToMin(fim);
  if (f <= ini) return 1;
  return Math.max(0, Math.min(1, (min - ini) / (f - ini)));
}

function labelProcesso(c) {
  return [c.segurado, c.numsin || (c.nosnum ? "#" + c.nosnum : ""), c.placa].filter(Boolean).join(" • ") || "processo";
}

// `usuario` = { id, nome }. `indice` = indiceProcessos(...).
export function entregaDoDia({ indice, usuario, data, agora = new Date(), cfg = DESEMPENHO_CFG_DEFAULT, expediente = {} }) {
  const ini = inicioDiaLocalISO(data);
  const fim = fimDiaLocalISO(data);
  const itens = [];
  let carteira = 0;
  const atuados = new Set();

  indice.forEach((p) => {
    const meuNoDia = (x) => noIntervalo(x.at, ini, fim) && feitoPor(x.autorId, x.autorNome, usuario);
    const historicoMeu = p.comms.filter((m) => !m.importado && meuNoDia(m));
    const acoesMinhas = p.acoes.filter(meuNoDia);
    if (historicoMeu.length || acoesMinhas.length) atuados.add(p.c.id);

    if (responsavelNoInicio(p, ini) !== usuario.id) return;
    if (p.finalizadoEm && String(p.finalizadoEm) < ini) return;
    carteira++;

    const motivos = [];
    const prazo = prazoNoInicio(p, ini);
    if (prazo && prazo <= data) motivos.push({ tipo: "proxima_acao", prazo, texto: prazo < data ? `Próxima ação vencida desde ${prazo.slice(8, 10)}/${prazo.slice(5, 7)}` : "Próxima ação vencendo no dia" });
    const sa = semAtualizacaoNoInicio(p, data, ini);
    if (sa.sem) motivos.push({ tipo: "sem_atualizacao", dias: sa.dias, texto: sa.dias == null ? "Sem nenhum histórico registrado" : `Sem atualização há ${sa.dias} dia(s)` });
    if (!motivos.length) return;

    let status = "pendente", em = null;
    if (historicoMeu.length) { status = "feito"; em = historicoMeu[0].at; }
    else if (p.comms.some((m) => !m.importado && noIntervalo(m.at, ini, fim))) { status = "outro"; em = p.comms.find((m) => !m.importado && noIntervalo(m.at, ini, fim)).at; }
    else if (acoesMinhas.length) { status = "parcial"; em = acoesMinhas[0].at; }
    itens.push({ claimId: p.c.id, titulo: labelProcesso(p.c), motivos, status, em, rota: ["sinistro", p.c.id] });
  });

  const conta = (s) => itens.filter((i) => i.status === s).length;
  const feitos = conta("feito"), parciais = conta("parcial"), porOutro = conta("outro"), pendentes = conta("pendente");
  const devidos = itens.length - porOutro;
  const progresso = progressoExpediente(data, agora, expediente.inicio, expediente.fim);
  const meta = Math.max(Number(cfg.metaMinimaDiaria) || 0, carteira / DIAS_SEM_ATUALIZACAO);
  const ordem = { pendente: 0, parcial: 1, feito: 2, outro: 3 };
  itens.sort((a, b) => ordem[a.status] - ordem[b.status] || a.titulo.localeCompare(b.titulo));
  return {
    data, carteira, itens, feitos, parciais, porOutro, pendentes, devidos,
    pesoFeito: feitos + PESO_PARCIAL * parciais,
    progresso, esperado: devidos * progresso,
    atuados: atuados.size, meta, metaEsperada: meta * progresso,
  };
}

// Dias úteis do período (no máximo os últimos MAX_DIAS_ENTREGA, nunca
// depois de hoje), agregados.
export function entregaNoPeriodo({ indice, usuario, deISO, ateISO, agora = new Date(), cfg = DESEMPENHO_CFG_DEFAULT, expediente = {} }) {
  const hoje = dataLocalISO(agora);
  const fim = ateISO && ateISO < hoje ? ateISO : hoje;
  let inicio = deISO || addDias(fim, -(MAX_DIAS_ENTREGA - 1));
  if (inicio < addDias(fim, -(MAX_DIAS_ENTREGA - 1))) inicio = addDias(fim, -(MAX_DIAS_ENTREGA - 1));
  const dias = [];
  for (let d = inicio; d <= fim; d = addDias(d, 1)) {
    const w = diaSemana(d);
    if (w === 0 || w === 6) continue;
    dias.push(entregaDoDia({ indice, usuario, data: d, agora, cfg, expediente }));
  }
  const soma = (k) => dias.reduce((s, x) => s + x[k], 0);
  const esperado = soma("esperado"), metaEsperada = soma("metaEsperada");
  return {
    dias, inicio, fim, truncado: !!deISO && deISO < inicio,
    devidos: soma("devidos"), feitos: soma("feitos"), parciais: soma("parciais"), porOutro: soma("porOutro"), pendentes: soma("pendentes"),
    atuados: soma("atuados"), meta: soma("meta"), esperado, metaEsperada,
    taxaEntrega: esperado > 0 ? Math.min(1, soma("pesoFeito") / esperado) : null,
    taxaProducao: metaEsperada > 0 ? Math.min(1, soma("atuados") / metaEsperada) : null,
  };
}

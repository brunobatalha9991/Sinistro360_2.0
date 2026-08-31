// Porte 1:1 das regras de negócio do HTML original. As funções recebem os
// dados como parâmetro (records/overrides/templates vindos do useData()) em
// vez de ler localStorage diretamente — mesmo comportamento, fonte explícita.
import { mapSituacao } from "./situacao";
import { diasEntre, mediaArr } from "./format";
import { isAdmin } from "../data/auth";

export const STATUS_DEFAULT = ["Aguardando", "Em andamento", "Concluído"];
const CONCLUSAO_STATUS = ["Aguardando", "Indenizado", "Sem Indenização", "Constatação"];

// Uma etapa é "concluída" (verde) quando o status bate com step.doneStatuses,
// configurado pelo admin em Configurações → Jornadas (nem sempre o nome do
// status é "Concluído", e pode haver mais de um — ex.: "Indenizado"). Sem
// essa lista configurada ainda (undefined, não [] vazio), cai no critério
// antigo por texto — assim etapas já existentes continuam funcionando sem
// precisar de migração até o admin abrir e configurar explicitamente.
export function stepStatusEhConcluida(step, status) {
  if (!status) return false;
  if (step && Array.isArray(step.doneStatuses)) return step.doneStatuses.indexOf(status) >= 0;
  const s = String(status).toLowerCase();
  // "indeniz" cobre o vocabulário padrão de ramo (Indenizado) — mas não
  // "Sem Indenização", que é negativo (ver stepStatusEhNegativa logo abaixo).
  return s.indexOf("conclu") >= 0 || (s.indexOf("indeniz") >= 0 && s.indexOf("sem indeniz") < 0);
}
// Encerramento negativo (vermelho) — mesmo critério de stepStatusEhConcluida:
// com a lista configurada pelo admin, usa ela; sem configurar ainda, cai no
// texto ("cancel..."/"sem indeniz...") — assim um status "Cancelado" ou "Sem
// Indenização" já é reconhecido como negativo sem precisar configurar nada,
// igual "Concluído"/"Indenizado" já eram pra verde.
export function stepStatusEhNegativa(step, status) {
  if (!status) return false;
  if (step && Array.isArray(step.negativoStatuses)) return step.negativoStatuses.indexOf(status) >= 0;
  const s = String(status).toLowerCase();
  return s.indexOf("cancel") >= 0 || s.indexOf("sem indeniz") >= 0;
}
// "Constatação" (a pedido do usuário, 2026-08-31): desfecho de Perda Parcial/
// Integral em que o atendimento foi aberto só pra dar cobertura ao terceiro —
// não há indenização ao segurado, mas também não é negativo (ver
// isFinalizado/statusColorMap, onde entra como um 3º grupo, ao lado de
// Indenizado/Sem Indenização). Mesmo critério de configuração por
// step.constatacaoStatuses (Configurações → Jornadas) ou, sem configurar
// ainda, por texto ("constat...").
export function stepStatusEhConstatacao(step, status) {
  if (!status) return false;
  if (step && Array.isArray(step.constatacaoStatuses)) return step.constatacaoStatuses.indexOf(status) >= 0;
  const s = String(status).toLowerCase();
  return s.indexOf("constat") >= 0;
}
// "Resolvida" = a etapa já teve um desfecho, positivo (verde) ou negativo
// (vermelho) — usada pra achar a etapa atual (a primeira ainda sem
// desfecho) em currentStage() e no colapsar/expandir da Jornada do cliente.
export function stepStatusResolvida(step, status) {
  return stepStatusEhConcluida(step, status) || stepStatusEhNegativa(step, status);
}
// Configuração de data por status (Configurações → Jornadas): se mostra o
// campo de data e o título dele. Sem configuração pra aquele status, mantém
// o campo "Data" sempre visível — comportamento de antes. Sem status
// selecionado (padrão, "— Status —"), nunca mostra data — não há status
// nenhum ainda pra basear a configuração.
export function stepDateConfig(step, status) {
  if (!status) return { show: false, label: "Data" };
  const cfg = step && step.dateByStatus && step.dateByStatus[status];
  if (!cfg) return { show: true, label: "Data" };
  return { show: cfg.show !== false, label: cfg.label || "Data" };
}
// Campo de horário por status — só existe nas Etapas de Atendimento
// (Configurações → Jornadas), opt-in (ao contrário da data, que vem
// visível por padrão): sem configurar, não mostra hora nenhuma. Sem status
// selecionado, idem — nunca mostra.
export function stepHoraConfig(step, status) {
  if (!status) return { show: false, label: "Horário" };
  const cfg = step && step.horaByStatus && step.horaByStatus[status];
  if (!cfg || !cfg.show) return { show: false, label: "Horário" };
  return { show: true, label: cfg.label || "Horário" };
}

export function defaultRamoTemplate() {
  return {
    comuns: [{ id: "vistoria", title: "Vistoria", statusOptions: [...STATUS_DEFAULT] }],
    parcial: [
      { id: "rep_autorizados", title: "Reparos autorizados", statusOptions: [...STATUS_DEFAULT] },
      { id: "pecas", title: "Peças", statusOptions: [...STATUS_DEFAULT] },
      { id: "reparo", title: "Reparo", statusOptions: [...STATUS_DEFAULT] },
      { id: "conclusao", title: "Conclusão", statusOptions: [...CONCLUSAO_STATUS], doneStatuses: ["Indenizado"], negativoStatuses: ["Sem Indenização"], constatacaoStatuses: ["Constatação"] },
    ],
    integral: [
      { id: "documentacao", title: "Documentação", statusOptions: [...STATUS_DEFAULT] },
      { id: "transf", title: "Transf. do veículo", statusOptions: [...STATUS_DEFAULT] },
      { id: "analise_final", title: "Análise final", statusOptions: [...STATUS_DEFAULT] },
      { id: "conclusao", title: "Conclusão", statusOptions: [...CONCLUSAO_STATUS], doneStatuses: ["Indenizado"], negativoStatuses: ["Sem Indenização"], constatacaoStatuses: ["Constatação"] },
    ],
    outros: [{ id: "doc_inicial", title: "Documentação Inicial", statusOptions: [...STATUS_DEFAULT] }],
  };
}
export function defaultAtendTemplate() {
  return {
    steps: [
      { id: "at_inicial", title: "Atendimento inicial", statusOptions: [...STATUS_DEFAULT] },
      { id: "at_encaminhamento", title: "Encaminhamento", statusOptions: [...STATUS_DEFAULT] },
      { id: "at_conclusao", title: "Conclusão", statusOptions: [...STATUS_DEFAULT] },
    ],
  };
}

export function getRamoTemplate(templates, ramo) {
  return (templates && templates[ramo]) || defaultRamoTemplate();
}
// As etapas "comuns" (antes da definição do caminho Perda Parcial/Integral —
// inclui a Vistoria, mas ela não é mais fixa: pode ser reordenada, e outras
// etapas podem ser criadas antes ou depois dela) ficam em tpl.comuns, uma
// lista comum como parcial/integral. Ramos salvos antes dessa mudança só
// tinham tpl.vistoriaStatus (status da Vistoria fixa em 1º lugar) — esta
// função lê os dois formatos, sem precisar migrar nada gravado no Firestore.
export function getComunsSteps(tpl) {
  if (tpl && Array.isArray(tpl.comuns)) return tpl.comuns;
  return [{ id: "vistoria", title: "Vistoria", statusOptions: (tpl && tpl.vistoriaStatus) || [...STATUS_DEFAULT] }];
}
// Terceiro caminho "Outros" (a pedido do usuário), ao lado de Perda Parcial/
// Integral — ramos já salvos antes dessa opção existir não têm tpl.outros
// ainda; o padrão em todos eles (novos ou já existentes) é uma única etapa
// "Documentação Inicial", igual ao padrão de Vistoria em getComunsSteps.
export function getOutrosSteps(tpl) {
  if (tpl && Array.isArray(tpl.outros)) return tpl.outros;
  return [{ id: "doc_inicial", title: "Documentação Inicial", statusOptions: [...STATUS_DEFAULT] }];
}
// Porte 1:1 de ensureRamoTemplate() do HTML original, mas puro: devolve um
// NOVO objeto de templates com o ramo garantido (template padrão + etapas
// comuns + etapas de "Outros"), ou o MESMO objeto (por referência) se já
// não faltava nada — assim quem chama sabe se precisa salvar ou não.
export function ensureRamoTemplateInto(templates, ramo) {
  if (!ramo) return templates;
  const t = templates || {};
  if (t[ramo] && Array.isArray(t[ramo].comuns) && Array.isArray(t[ramo].outros)) return t;
  const existing = t[ramo] || defaultRamoTemplate();
  const withComuns = { ...existing, comuns: getComunsSteps(existing), outros: getOutrosSteps(existing) };
  return { ...t, [ramo]: withComuns };
}
export function getAtendTemplate(atendTemplateCfg) {
  return atendTemplateCfg && atendTemplateCfg.steps && atendTemplateCfg.steps.length
    ? atendTemplateCfg
    : defaultAtendTemplate();
}
// Lista de etapas de Atendimento efetivamente em uso por este processo,
// já resolvendo a trilha por tipo (branch) escolhida — mesma montagem
// usada em JourneyPanel.jsx, extraída aqui pra ser reaproveitada pelo
// alarme de horário (useHorarioAlarme.js).
export function atendimentoStepsList(atendTemplateCfg, uj) {
  const tpl = getAtendTemplate(atendTemplateCfg);
  const steps = (uj && uj.steps) || {};
  const lista = [];
  for (const step of tpl.steps || []) {
    lista.push(step);
    if (step.branch) {
      const escolhido = (steps[step.id] || {}).status || "";
      if (escolhido) {
        const trilha = (step.branches && step.branches[escolhido]) || [];
        lista.push(...trilha);
      }
      break;
    }
  }
  return lista;
}
// Última etapa efetiva de um processo (ramo ou Atendimento), já resolvendo
// caminho/trilha escolhida — mesmo critério de situacaoEfetivaAtendimento,
// generalizado aqui pra também servir o caminho por ramo (Perda Parcial/
// Integral/Outros). Usado pelo módulo Desempenho pra saber a data do
// desfecho (sd.concludedAt) de um processo, pra atribuir "finalizado em
// tal dia" a quem era responsável naquele instante.
export function ultimaEtapaEfetiva(overrides, templates, atendTemplateCfg, c) {
  const uj = getUserJourney(overrides, c.id) || {};
  if (isAtendimento(c)) {
    const lista = atendimentoStepsList(atendTemplateCfg, uj);
    return lista.length ? lista[lista.length - 1] : null;
  }
  const tpl = getRamoTemplate(templates, c.ramo);
  const lista = uj.caminho === "parcial" ? (tpl.parcial || [])
    : uj.caminho === "integral" ? (tpl.integral || [])
    : uj.caminho === "outros" ? getOutrosSteps(tpl) : [];
  return lista.length ? lista[lista.length - 1] : null;
}
// Instante em que o processo deixou de ser "Pendente" e passou a "Em
// andamento" — mesmo critério de situacaoEfetiva/situacaoEfetivaAtendimento,
// mas devolvendo O INSTANTE da transição em vez do rótulo atual. Usado pelo
// módulo Desempenho pra cruzar com o histórico de responsabilidade e saber
// quanto tempo cada processo ficou Pendente/Em andamento sob cada usuário.
// - Atendimento: é quando a primeira etapa efetiva foi concluída
//   (sd.concludedAt) — dado que já existe, nada aproximado aqui.
// - Por ramo: é quando o caminho (Perda Parcial/Integral/Outros) foi
//   escolhido (uj.caminhoDefinidoEm, gravado a partir de agora em
//   JourneyPanel.setCaminho). Processo cujo caminho já estava escolhido
//   ANTES dessa gravação existir não tem essa data — aproxima pela data mais
//   antiga encontrada nas etapas do caminho escolhido (`aproximado: true`).
//   Sem nenhuma evidência nem assim, `indeterminado: true` — quem chama não
//   deve tratar isso como "ainda Pendente", só não tem como saber quando.
export function inicioAndamentoEm(overrides, templates, atendTemplateCfg, c) {
  const uj = getUserJourney(overrides, c.id) || {};
  if (isAtendimento(c)) {
    const lista = atendimentoStepsList(atendTemplateCfg, uj);
    if (!lista.length) return { em: null, aproximado: false, indeterminado: false };
    const primeira = lista[0];
    const sd = (uj.steps || {})[primeira.id] || {};
    if (!stepStatusEhConcluida(primeira, sd.status)) return { em: null, aproximado: false, indeterminado: false };
    return sd.concludedAt
      ? { em: sd.concludedAt, aproximado: false, indeterminado: false }
      : { em: null, aproximado: false, indeterminado: true };
  }
  if (!uj.caminho) return { em: null, aproximado: false, indeterminado: false };
  if (uj.caminhoDefinidoEm) return { em: uj.caminhoDefinidoEm, aproximado: false, indeterminado: false };
  const tpl = getRamoTemplate(templates, c.ramo);
  const passos = uj.caminho === "parcial" ? (tpl.parcial || [])
    : uj.caminho === "integral" ? (tpl.integral || [])
    : uj.caminho === "outros" ? getOutrosSteps(tpl) : [];
  const datas = [];
  passos.forEach((step) => {
    const sd = (uj.steps || {})[step.id];
    if (!sd) return;
    if (sd.firstSetAt) datas.push(sd.firstSetAt);
    if (sd.concludedAt) datas.push(sd.concludedAt);
  });
  if (!datas.length) return { em: null, aproximado: true, indeterminado: true };
  datas.sort();
  return { em: datas[0], aproximado: true, indeterminado: false };
}
// Etapas de Atendimento deste processo com horário configurado (ver
// stepHoraConfig), data+hora já no passado e ainda sem desfecho — o
// alarme visual (useHorarioAlarme.js) dispara pra cada uma dessas.
export function claimAlarmesHoraAtivos(overrides, atendTemplateCfg, c) {
  if (!isAtendimento(c)) return [];
  const uj = getUserJourney(overrides, c.id);
  const steps = uj.steps || {};
  const agora = Date.now();
  const out = [];
  atendimentoStepsList(atendTemplateCfg, uj).forEach((step) => {
    const sd = steps[step.id];
    if (!sd || !sd.date || !sd.hora) return;
    if (stepStatusEhConcluida(step, sd.status) || stepStatusEhNegativa(step, sd.status)) return;
    const cfg = stepHoraConfig(step, sd.status);
    if (!cfg.show) return;
    const alvo = new Date(`${sd.date}T${sd.hora}`).getTime();
    if (isNaN(alvo) || alvo > agora) return;
    out.push({ stepId: step.id, title: step.title, label: cfg.label, date: sd.date, hora: sd.hora });
  });
  return out;
}
export function isAtendimento(c) { return !!(c && c.partyType === "Aviso"); }
export function isManualClaim(c) { return !!(c && c.origem === "manual"); }

// Porte 1:1 de partyTypeFromTipo() do HTML original.
export function partyTypeFromTipo(tipo) {
  const t = String(tipo || "").toUpperCase();
  if (t.indexOf("TERCEIRO") >= 0) return "Terceiro";
  if (t.indexOf("ATENDIMENTO") >= 0) return "Aviso";
  return "Segurado";
}

export function getOvr(overrides, id) { return (overrides && overrides[id]) || {}; }
export function campoEfetivo(overrides, c, campo) {
  if (!c) return "";
  const ov = getOvr(overrides, c.id).campos || {};
  if (ov[campo] != null && String(ov[campo]).trim() !== "") return ov[campo];
  return c[campo];
}
export function getUserJourney(overrides, claimId) {
  const ovr = getOvr(overrides, claimId);
  return ovr.journeyUser || { caminho: "", steps: {} };
}
// Alguma etapa da Jornada do cliente foi marcada como "Fora do prazo" (ver
// JourneyPanel.jsx) — usado no filtro do módulo Sinistros.
export function claimTemEtapaForaDoPrazo(overrides, claimId) {
  const steps = (getUserJourney(overrides, claimId) || {}).steps || {};
  return Object.values(steps).some((sd) => sd && sd.foraDoPrazo);
}
export function getNextAction(overrides, claimId) { return getOvr(overrides, claimId).nextAction || null; }
// Pesquisa de satisfação (Fase 4 — Oficinas/Seguradoras/Clientes) — ver
// useOverrideActions.savePesquisaSatisfacao.
export function getPesquisaSatisfacao(overrides, claimId) { return getOvr(overrides, claimId).pesquisaSatisfacao || null; }
// Considera "completa" quando os 3 alvos têm uma decisão (nota > 0 OU
// marcado como não se aplica) — usado pra saber se ainda falta preencher
// alguma coisa, sem exigir que todos tenham dado nota de verdade.
export function pesquisaSatisfacaoCompleta(overrides, claimId) {
  const p = getPesquisaSatisfacao(overrides, claimId);
  if (!p) return false;
  return ["corretora", "seguradora", "oficina"].every((alvo) => {
    const a = p[alvo];
    return a && (a.naoAplica || Number(a.nota) > 0);
  });
}
export function getResponsavel(overrides, claimId) { return getOvr(overrides, claimId).responsavelUser || null; }
export function getSitAtend(overrides, claimId) { return getOvr(overrides, claimId).sitAtend || ""; }
export function getTemp(overrides, claimId) { return getOvr(overrides, claimId).temperatura || ""; }
export function loadComms(overrides, claimId) { return getOvr(overrides, claimId).comms || []; }

// "Aguardando retorno" e "Limitação de comunicação" (Histórico) perpetuam
// como indicador/métrica mesmo desmarcados depois — a pedido do usuário,
// pra não perder a evidência numa reunião com a oficina só porque alguém
// desmarcou o botão. Só NÃO conta como métrica se for desmarcado em menos
// de 8h da marcação (ver toggleComFlag em CommsPanel.jsx, que grava
// `${campo}Desde` ao marcar e trava `${campo}Metrica` ao desmarcar depois
// das 8h). Marcado agora (m[campo] true) sempre conta, travado ou não.
export function comFlagContaComoMetrica(m, campo) {
  if (!m) return false;
  return !!(m[campo] || m[campo + "Metrica"]);
}
// Processo tem, em qualquer comunicação do Histórico, o indicador `campo`
// contando como métrica (ver comFlagContaComoMetrica) — usado no filtro do
// módulo Sinistros.
export function claimTemFlagHistorico(overrides, claimId, campo) {
  return loadComms(overrides, claimId).some((m) => comFlagContaComoMetrica(m, campo));
}
export function getManualLinks(overrides, claimId) { return getOvr(overrides, claimId).links || []; }
export function getFinance(overrides, claimId) { return getOvr(overrides, claimId).finance || {}; }
export function loadAudit(overrides, claimId) { return getOvr(overrides, claimId).audit || []; }
export function getJourneyNotes(overrides, claimId) { return getOvr(overrides, claimId).journeyNotes || ""; }
export function campoFoiEditado(overrides, c, campo) {
  const ov = getOvr(overrides, c.id).campos || {};
  return !!(ov[campo] != null && String(ov[campo]).trim() !== "");
}

// Porte 1:1 de tempColor() do HTML original.
export function tempColor(t) {
  t = String(t || "").toLowerCase();
  if (t.indexOf("grave") >= 0) return "red";
  if (t.indexOf("moder") >= 0) return "orange";
  if (t.indexOf("aten") >= 0) return "amber";
  if (t.indexOf("tranq") >= 0) return "green";
  return "gray";
}

function journeyTouched(uj) {
  if (!uj) return false;
  if (uj.caminho) return true;
  const steps = uj.steps || {};
  for (const k in steps) {
    const s = steps[k] || {};
    if ((s.status && String(s.status).trim() !== "") || (s.date && String(s.date).trim() !== "") || (s.note && String(s.note).trim() !== "")) return true;
  }
  return false;
}
// Situação efetiva de um Atendimento — a pedido do usuário, baseada na
// ÚLTIMA etapa efetiva do fluxo (já resolvendo a trilha por tipo escolhida,
// ver atendimentoStepsList) e nas marcações verde/vermelho configuradas
// pelo admin (doneStatuses/negativoStatuses — ver stepStatusEhConcluida/
// stepStatusEhNegativa), não mais no NOME fixo da etapa ("Encerramento"/
// "Status da assistência"): última etapa concluída (verde) → Indenizado;
// última etapa negativa (vermelho) → Encerrado sem Indenização; sem
// nenhuma das duas ainda, mas a primeira etapa já concluída → Em
// andamento; senão, Pendente. Funciona mesmo sem `atendTemplateCfg` (ou
// ainda não configurado): atendimentoStepsList cai no template padrão.
function situacaoEfetivaAtendimento(uj, atendTemplateCfg) {
  const lista = atendimentoStepsList(atendTemplateCfg, uj);
  if (!lista.length) return { label: "Pendente", cls: "amber" };
  const steps = uj.steps || {};
  const ultima = lista[lista.length - 1];
  const sdUltima = steps[ultima.id] || {};
  if (stepStatusEhConcluida(ultima, sdUltima.status)) return { label: "Indenizado", cls: "green" };
  if (stepStatusEhNegativa(ultima, sdUltima.status)) return { label: "Encerrado sem Indenização", cls: "gray" };
  const primeira = lista[0];
  const sdPrimeira = steps[primeira.id] || {};
  if (stepStatusEhConcluida(primeira, sdPrimeira.status)) return { label: "Em andamento", cls: "amber" };
  return { label: "Pendente", cls: "amber" };
}
// Situação efetiva de um processo por ramo (Perda Parcial/Integral/Outros)
// — a pedido do usuário (bug relatado 2026-08-31): mesmo critério de
// situacaoEfetivaAtendimento acima, baseado na ÚLTIMA etapa EFETIVA do
// caminho escolhido (ultimaEtapaEfetiva — já resolve caminho/reordenação/
// renomeação de etapas) e nas marcações verde/vermelho configuradas pelo
// admin, não mais no id fixo "conclusao" nem no nome literal do status.
// Antes, uma etapa final renomeada (ex.: "Encerramento" em vez de
// "Conclusão") ou com id diferente de "conclusao" nunca era detectada —
// o processo ficava preso em "Em andamento" mesmo com a etapa final já
// marcada como Indenizado/Sem Indenização.
export function situacaoEfetiva(overrides, c, atendTemplateCfg, templates) {
  const uj = getUserJourney(overrides, c.id) || {};
  if (!journeyTouched(uj)) return mapSituacao(c.situacao);
  if (isAtendimento(c)) return situacaoEfetivaAtendimento(uj, atendTemplateCfg);
  if (!uj.caminho) return { label: "Pendente", cls: "amber" };
  const ultima = ultimaEtapaEfetiva(overrides, templates, atendTemplateCfg, c);
  if (!ultima) return { label: "Em andamento", cls: "amber" };
  const sdUltima = (uj.steps || {})[ultima.id] || {};
  if (stepStatusEhConcluida(ultima, sdUltima.status)) return { label: "Indenizado", cls: "green" };
  if (stepStatusEhNegativa(ultima, sdUltima.status)) return { label: "Encerrado sem Indenização", cls: "gray" };
  if (stepStatusEhConstatacao(ultima, sdUltima.status)) return { label: "Constatação", cls: "blue" };
  return { label: "Em andamento", cls: "amber" };
}
export function isFinalizado(overrides, c, atendTemplateCfg, templates) {
  const s = situacaoEfetiva(overrides, c, atendTemplateCfg, templates).label;
  return s === "Indenizado" || s === "Encerrado sem Indenização" || s === "Constatação";
}
// Processo finalizado (Indenizado/Sem Indenização/Constatação) nunca conta
// como atrasado — a pedido do usuário, 2026-08-31: um processo já encerrado
// não deve mais cobrar próxima ação, mesmo que a data registrada tenha
// ficado no passado antes do encerramento.
export function isAtrasado(overrides, c, atendTemplateCfg, templates) {
  if (isFinalizado(overrides, c, atendTemplateCfg, templates)) return false;
  const na = getNextAction(overrides, c.id);
  if (!na || !na.date) return false;
  return na.date < new Date().toISOString().slice(0, 10);
}
export function isSemAtualizacao(overrides, c, atendTemplateCfg, templates) {
  if (isFinalizado(overrides, c, atendTemplateCfg, templates)) return false;
  const comms = loadComms(overrides, c.id);
  if (!comms.length) return true;
  const ultimo = comms[comms.length - 1];
  const d = ultimo.date || (ultimo.at ? String(ultimo.at).slice(0, 10) : "");
  if (!d) return true;
  const lim = new Date();
  lim.setDate(lim.getDate() - 3);
  return d < lim.toISOString().slice(0, 10);
}

// isConstatacaoSemIndeniz: processos "Encerrado sem Indenização" cuja oficina
// seja "01-CONSTATAÇÃO" não entram em nenhuma listagem/filtro (só acessíveis
// pelos vínculos com os terceiros) — mesma regra do original.
export function isConstatacaoSemIndeniz(c) {
  if (!c) return false;
  const of = String(c.oficina || "").trim().toUpperCase();
  if (of !== "01-CONSTATAÇÃO") return false;
  return String(c.situacao || "").toUpperCase().indexOf("SEM IND") >= 0;
}
export function getAgenteProdutor(overrides, claimId) {
  return getOvr(overrides, claimId).agenteProdutor || null;
}
// Alertas de e-mail (Gmail) vinculados a este processo, não dispensados —
// ver useOverrideActions.addEmailAlerta/dismissEmailAlerta.
// Mais recente primeiro (a pedido do usuário) — o e-mail em alertas[0] é o
// que a caixinha compacta do cabeçalho mostra como prévia, então quando o
// processo tem mais de um vinculado, o mais novo deve aparecer ali.
export function getEmailAlertas(overrides, claimId) {
  return (getOvr(overrides, claimId).emailAlertas || [])
    .filter((a) => !a.dismissed)
    .sort((a, b) => new Date(b.recebidoEm) - new Date(a.recebidoEm));
}
// Verifica se um vínculo específico (e-mail x processo) já foi removido
// manualmente (dismissEmailAlerta) — usado em Emails.jsx pra não voltar a
// mostrar como "Identificado" um vínculo que o usuário já tirou, mesmo que
// a identificação automática bata de novo numa próxima atualização da
// caixa de entrada.
export function emailAlertaDispensado(overrides, claimId, emailId) {
  const entry = (getOvr(overrides, claimId).emailAlertas || []).find((a) => a.emailId === emailId);
  return !!(entry && entry.dismissed);
}
// Vínculo de acesso por Agente/Produtor (a pedido do usuário): um usuário
// "consulta" com agentes/produtores configurados só enxerga processos
// ligados a eles. Sem nenhum vínculo configurado, não restringe nada —
// mesmo critério já usado em userModulos() pra módulos (ver data/auth.js) —
// pra não trancar usuários "consulta" já existentes assim que a função for
// ligada, antes de um admin configurar os vínculos deles.
export function usuarioTemVinculoRestrito(user) {
  if (!user || user.role !== "consulta" || isAdmin(user)) return false;
  const ag = user.agentesVinculados || [];
  const pr = user.produtoresVinculados || [];
  const gr = user.gruposProdutoresVinculados || [];
  return ag.length > 0 || pr.length > 0 || gr.length > 0;
}
export function claimVisivelParaUsuario(overrides, c, user) {
  if (!usuarioTemVinculoRestrito(user)) return true;
  const ap = getAgenteProdutor(overrides, c.id);
  if (!ap) return false;
  const ag = user.agentesVinculados || [];
  const pr = user.produtoresVinculados || [];
  const gr = user.gruposProdutoresVinculados || [];
  // Produtor/Grupo é mais específico que Agente — a pedido do usuário
  // (bug relatado 2026-08-26): antes, com Agente E Produtor marcados ao
  // mesmo tempo pro mesmo usuário, o vínculo por Agente sozinho já liberava
  // TODOS os produtores debaixo dele (era um "ou"), tornando o vínculo por
  // Produtor inútil sempre que o Agente também estivesse marcado. Agora,
  // sempre que Produtor e/ou Grupo estiverem marcados, a visibilidade fica
  // restrita a eles (Agente marcado junto não amplia mais o acesso). Agente
  // sozinho (sem nenhum Produtor/Grupo marcado) continua liberando tudo que
  // estiver debaixo dele, como sempre.
  if (pr.length > 0 || gr.length > 0) {
    const bateProdutor = pr.length > 0 && (ap.produtores || []).some((p) => pr.indexOf(p) >= 0);
    const bateGrupo = gr.length > 0 && (ap.produtores || []).some((p) => gr.indexOf(grupoProdutor(p)) >= 0);
    return bateProdutor || bateGrupo;
  }
  const bateAgente = ag.length > 0 && (ap.agentes || []).some((a) => ag.indexOf(a) >= 0);
  return bateAgente;
}

// `overrides`/`currentUser` são opcionais (retrocompatível com as várias
// chamadas existentes de 1 argumento só) — só filtra por vínculo de Agente/
// Produtor quando os dois são passados e o usuário for "consulta" com
// vínculo configurado.
export function visibleClaims(allClaims, overrides, currentUser) {
  let out = (allClaims || []).filter((c) => !isConstatacaoSemIndeniz(c));
  if (currentUser && usuarioTemVinculoRestrito(currentUser)) {
    out = out.filter((c) => claimVisivelParaUsuario(overrides, c, currentUser));
  }
  return out;
}

export function distinctAgentes(overrides, claims) {
  const seen = {}; const out = [];
  (claims || []).forEach((c) => {
    const ap = getAgenteProdutor(overrides, c.id);
    (ap && ap.agentes || []).forEach((a) => { if (a && !seen[a]) { seen[a] = true; out.push(a); } });
  });
  return out.sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}
export function distinctProdutores(overrides, claims) {
  const seen = {}; const out = [];
  (claims || []).forEach((c) => {
    const ap = getAgenteProdutor(overrides, c.id);
    (ap && ap.produtores || []).forEach((p) => { if (p && !seen[p]) { seen[p] = true; out.push(p); } });
  });
  return out.sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}
// "Grupo de Produtores" (a pedido do usuário): muitos nomes de produtor
// vêm com um sufixo de unidade/filial no final (ex.: "NOME - BATALHA",
// "NOME - GRAND ROSA") — o mesmo produtor cadastrado uma vez por unidade.
// O grupo é o nome sem esse sufixo final (tudo antes do ÚLTIMO " - "),
// agrupando essas variações num único produtor "de verdade". Nome sem
// " - " no meio vira o próprio grupo, sem mudança.
export function grupoProdutor(nomeProdutor) {
  const n = String(nomeProdutor || "");
  const idx = n.lastIndexOf(" - ");
  return (idx > 0 ? n.slice(0, idx) : n).trim();
}
export function distinctGruposProdutores(overrides, claims) {
  const seen = {}; const out = [];
  distinctProdutores(overrides, claims).forEach((p) => {
    const g = grupoProdutor(p);
    if (g && !seen[g]) { seen[g] = true; out.push(g); }
  });
  return out.sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}
// "Grupo do Produtor ou Agente" efetivo de um processo (a pedido do
// usuário: substitui o vínculo com Cliente na tarefa de Comunicação) —
// mesma precedência de claimVisivelParaUsuario (produtor é mais específico
// que agente): usa o grupo do primeiro produtor vinculado; sem produtor,
// cai pro primeiro agente.
export function produtorOuAgenteEfetivo(overrides, claimId) {
  const ap = getAgenteProdutor(overrides, claimId);
  if (!ap) return "";
  const produtores = ap.produtores || [];
  if (produtores.length) return grupoProdutor(produtores[0]);
  const agentes = ap.agentes || [];
  return agentes.length ? agentes[0] : "";
}
// Lista combinada de grupos de produtores + agentes distintos, pro
// seletor "V. Grupo do Produtor ou agente" da tarefa de Comunicação.
export function distinctGruposOuAgentes(overrides, claims) {
  const seen = {}; const out = [];
  distinctGruposProdutores(overrides, claims).forEach((g) => { if (!seen[g]) { seen[g] = true; out.push(g); } });
  distinctAgentes(overrides, claims).forEach((a) => { if (!seen[a]) { seen[a] = true; out.push(a); } });
  return out.sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}
// Catálogo efetivo de agentes: união do catálogo editável pelo admin
// (config.corp_agentes_catalogo, com "+ Novo agente" em Configurações) com
// os agentes já descobertos em processos sincronizados/importados.
export function getAgentesEfetivo(config, overrides, claims) {
  const manual = (config && config.corp_agentes_catalogo) || [];
  const auto = distinctAgentes(overrides, claims);
  const seen = {}; const out = [];
  manual.concat(auto).forEach((a) => { if (a && !seen[a]) { seen[a] = true; out.push(a); } });
  return out.sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

export function relatedClaims(overrides, allClaimsRaw, c) {
  const ids = getManualLinks(overrides, c.id);
  return (allClaimsRaw || []).filter((x) => {
    if (x.id === c.id) return false;
    const auto = c.linkKey && x.linkKey === c.linkKey;
    const manual = ids.indexOf(x.id) >= 0;
    return auto || manual;
  });
}

export function allJourneyStages(templates, atendTemplateCfg) {
  const seen = {};
  const out = [];
  function add(name) { if (name && !seen[name]) { seen[name] = true; out.push(name); } }
  Object.keys(templates || {}).forEach((ramo) => {
    const t = templates[ramo] || {};
    getComunsSteps(t).forEach((s) => add(s.title));
  });
  add("Definir caminho");
  Object.keys(templates || {}).forEach((ramo) => {
    const t = templates[ramo] || {};
    (t.parcial || []).forEach((s) => add(s.title));
    (t.integral || []).forEach((s) => add(s.title));
    getOutrosSteps(t).forEach((s) => add(s.title));
  });
  (getAtendTemplate(atendTemplateCfg).steps || []).forEach((s) => {
    add(s.title);
    if (s.branch) Object.values(s.branches || {}).forEach((trilha) => (trilha || []).forEach((t) => add(t.title)));
  });
  return out;
}

// Mapa {título da etapa: status atual} do processo (a pedido do usuário) —
// usado pra compor o título "Etapa: Status" oferecido no Histórico (ex.:
// "Vistoria: Aguard. agendamento"), refletindo automaticamente qualquer
// edição, inclusão ou renovação de etapa feita em Jornada do cliente. Lido
// direto de uj.steps (que já grava título junto com o status — ver
// JourneyPanel.setStepField), sem precisar duplicar a lógica de trilhas
// por caminho/ramo.
export function journeyStageStatusMap(overrides, claimId) {
  const steps = (getUserJourney(overrides, claimId) || {}).steps || {};
  const map = {};
  Object.values(steps).forEach((sd) => { if (sd && sd.title && sd.status) map[sd.title] = sd.status; });
  return map;
}
// "Vistoria" -> "Vistoria: Aguard. agendamento" quando a etapa já tem
// status definido; sem status ainda, mantém só o nome da etapa (mesmo
// comportamento de antes).
export function journeyStageLabel(title, statusMap) {
  if (!title) return title;
  const status = statusMap[title];
  return status ? `${title}: ${status}` : title;
}

export function currentStage(overrides, templates, atendTemplateCfg, c) {
  const sit = situacaoEfetiva(overrides, c, atendTemplateCfg, templates).label;
  if (sit === "Indenizado" || sit === "Encerrado sem Indenização" || sit === "Constatação") return "";
  const uj = getUserJourney(overrides, c.id) || {};
  const steps = uj.steps || {};

  if (isAtendimento(c)) {
    const listaAt = getAtendTemplate(atendTemplateCfg).steps || [];
    for (let j = 0; j < listaAt.length; j++) {
      const stepAt = listaAt[j];
      const sdAt = steps[stepAt.id] || {};
      if (stepAt.branch) {
        const tipo = sdAt.status || "";
        if (!tipo) return stepAt.title;
        const trilha = (stepAt.branches && stepAt.branches[tipo]) || [];
        for (let n = 0; n < trilha.length; n++) {
          const sdT = steps[trilha[n].id] || {};
          if (!stepStatusResolvida(trilha[n], sdT.status)) return trilha[n].title;
        }
        return trilha.length ? trilha[trilha.length - 1].title : stepAt.title;
      }
      const doneAt = stepStatusResolvida(stepAt, sdAt.status);
      if (!doneAt) return stepAt.title;
    }
    if (!uj.caminho) return "Definir caminho";
    const tplAt = getRamoTemplate(templates, c.ramo);
    const listaCam = uj.caminho === "parcial" ? (tplAt.parcial || []) : uj.caminho === "integral" ? (tplAt.integral || []) : uj.caminho === "outros" ? getOutrosSteps(tplAt) : [];
    for (let k = 0; k < listaCam.length; k++) {
      const sdC = steps[listaCam[k].id] || {};
      if (!stepStatusResolvida(listaCam[k], sdC.status)) return listaCam[k].title;
    }
    return listaCam.length ? listaCam[listaCam.length - 1].title : "Definir caminho";
  }

  const tpl = getRamoTemplate(templates, c.ramo);
  const comuns = getComunsSteps(tpl);
  for (let m = 0; m < comuns.length; m++) {
    const sdC = steps[comuns[m].id] || {};
    if (!stepStatusResolvida(comuns[m], sdC.status)) return comuns[m].title;
  }
  if (!uj.caminho) return "Definir caminho";
  const lista = uj.caminho === "parcial" ? (tpl.parcial || []) : uj.caminho === "integral" ? (tpl.integral || []) : uj.caminho === "outros" ? getOutrosSteps(tpl) : [];
  for (let i = 0; i < lista.length; i++) {
    const sd = steps[lista[i].id] || {};
    if (!stepStatusResolvida(lista[i], sd.status)) return lista[i].title;
  }
  return lista.length ? lista[lista.length - 1].title : "Definir caminho";
}

export function last12Months() {
  const out = [];
  const base = new Date();
  base.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const x = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push(x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"));
  }
  return out;
}
export function distinctComputed(rows, fn) {
  const seen = {};
  const out = [];
  rows.forEach((c) => { const v = fn(c); if (v && !seen[v]) { seen[v] = true; out.push(v); } });
  return out.sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

const CIA_GRUPO_PORT = ["AZUL", "ITAU", "MITSI"];
export function dashCiaLabel(overrides, cia) {
  if (cia && typeof cia === "object") cia = campoEfetivo(overrides, cia, "cia");
  const v = String(cia || "").trim().toUpperCase();
  return CIA_GRUPO_PORT.indexOf(v) >= 0 ? "PORT" : cia || "";
}
const OFICINA_IGNORADA = "01-CONSTATAÇÃO";
export function dashOficinaKey(overrides, oficina) {
  if (oficina && typeof oficina === "object") oficina = campoEfetivo(overrides, oficina, "oficina");
  const v = String(oficina || "").trim().toUpperCase();
  return v === OFICINA_IGNORADA.toUpperCase() ? "" : oficina || "";
}
export function tipoPartyLabel(v) { return v === "Aviso" ? "Atendimento" : v; }

export function buildAggregation(overrides, rows, keyFn, atendTemplateCfg, templates) {
  const map = {};
  rows.forEach((c) => {
    const k = keyFn(c);
    if (!k) return;
    if (!map[k]) map[k] = { key: k, count: 0, valavi: 0, valind: 0, valdes: 0, tmaArr: [], tmeArr: [], tmrArr: [], atrasados: 0, semAtu: 0, indenizados: 0 };
    const g = map[k];
    g.count++;
    g.valavi += c.valavi || 0; g.valind += c.valind || 0; g.valdes += c.valdes || 0;
    const tma = diasEntre(c.datoco, c.datavi); if (tma != null && tma >= 0) g.tmaArr.push(tma);
    const tme = diasEntre(c.datavi, c.datenc); if (tme != null && tme >= 0) g.tmeArr.push(tme);
    const uj = getUserJourney(overrides, c.id);
    if (uj && uj.caminho === "parcial" && uj.steps && uj.steps.conclusao && uj.steps.conclusao.date) {
      const tmr = diasEntre(c.datavi, uj.steps.conclusao.date); if (tmr != null && tmr >= 0) g.tmrArr.push(tmr);
    }
    if (isAtrasado(overrides, c, atendTemplateCfg, templates)) g.atrasados++;
    if (isSemAtualizacao(overrides, c, atendTemplateCfg, templates)) g.semAtu++;
    if (situacaoEfetiva(overrides, c, atendTemplateCfg, templates).label === "Indenizado") g.indenizados++;
  });
  return Object.keys(map).map((k) => {
    const g = map[k];
    return {
      key: k, count: g.count, valavi: g.valavi, valind: g.valind, valdes: g.valdes,
      ticketMedio: g.indenizados ? g.valind / g.indenizados : 0,
      tma: mediaArr(g.tmaArr), tme: mediaArr(g.tmeArr), tmr: mediaArr(g.tmrArr),
      atrasados: g.atrasados, semAtu: g.semAtu, indenizados: g.indenizados,
      taxaIndeniz: g.count ? (g.indenizados / g.count) * 100 : 0,
      pctAtraso: g.count ? (g.atrasados / g.count) * 100 : 0,
    };
  }).sort((a, b) => b.count - a.count);
}

export function statusColorMap(cssVarFn) {
  return {
    "Em andamento": cssVarFn("--warn", "#f59e0b"), "Indenizado": cssVarFn("--ok", "#16a34a"),
    "Encerrado sem Indenização": cssVarFn("--muted", "#64748b"), "Pendente": cssVarFn("--warn", "#eab308"),
    "Negado": cssVarFn("--danger", "#dc2626"), "Aberto": cssVarFn("--brand", "#2563eb"), "Encerrado": cssVarFn("--muted", "#64748b"),
    "Constatação": cssVarFn("--brand", "#2563eb"),
  };
}
export function tempColorMap(cssVarFn) {
  return {
    "Tranquilo": cssVarFn("--ok", "#16a34a"), "Moderado": cssVarFn("--warn", "#f59e0b"),
    "Grave": cssVarFn("--danger", "#dc2626"), "Em atenção": cssVarFn("--warn", "#f97316"),
    "Não definida": cssVarFn("--muted-soft", "#94a3b8"),
  };
}

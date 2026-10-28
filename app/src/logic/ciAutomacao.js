// Automações da Comunicação Interna (CI), a pedido do usuário:
//
// 1) Destinatários automáticos por tipo de CI — regras em
//    config.corp_ci_dest_auto = [{ id, tipo, tipoAtendimento, modo, userIds }].
//    `tipoAtendimento` vazio = qualquer subtipo (só faz sentido em Mesa de
//    Atendimento). `modo` "usuarios" marca os `userIds`; "todos_exceto_consulta"
//    marca todo mundo que não é Consulta. Aplicadas ao criar a CI (TaskModal).
//
// 2) Generalização por ausência — a partir do horário configurado (09:30 por
//    padrão), quem não é Consulta e ainda não acessou o sistema no dia é
//    tratado como possível ausente: as CIs abertas criadas naquele dia em
//    que ele é destinatário passam a ter todos os usuários (exceto Consulta)
//    como destinatários, com um comentário automático explicando o motivo.
//    O acesso do dia fica em corp_acessos (ver registrarAcesso no Shell).
import { dataLocalISO, hhmmToMin } from "./agenda";

export const DEST_AUTO_MODOS = [
  ["usuarios", "Usuários escolhidos"],
  ["todos_exceto_consulta", "Todos, exceto Consulta"],
];

export const AUSENCIA_CFG_DEFAULT = { ativo: true, horario: "09:30", soDiasUteis: true };

export const AUTOR_SISTEMA = "__sistema__";

export function regrasDestAuto(config) {
  return Array.isArray(config && config.corp_ci_dest_auto) ? config.corp_ci_dest_auto : [];
}

export function ausenciaCfg(config) {
  return { ...AUSENCIA_CFG_DEFAULT, ...((config && config.corp_ci_ausencia) || {}) };
}

function naoConsulta(users) {
  return (users || []).filter((u) => u && u.role !== "consulta").map((u) => u.id);
}

export function regraAplica(regra, tipo, tipoAtendimento) {
  if (!regra || regra.tipo !== tipo) return false;
  return !regra.tipoAtendimento || regra.tipoAtendimento === (tipoAtendimento || "");
}

// Ids que as regras mandam marcar para este tipo/subtipo de CI (sem repetir,
// só usuários que ainda existem).
export function destinatariosAutomaticos(regras, users, tipo, tipoAtendimento) {
  const existentes = new Set((users || []).map((u) => u.id));
  const out = new Set();
  (regras || []).forEach((r) => {
    if (!regraAplica(r, tipo, tipoAtendimento)) return;
    const ids = r.modo === "todos_exceto_consulta" ? naoConsulta(users) : (r.userIds || []);
    ids.forEach((id) => { if (existentes.has(id)) out.add(id); });
  });
  return [...out];
}

export function idAcesso(userId, data) {
  return `${userId}_${data}`;
}

export function acessouNoDia(acessos, userId, data) {
  return !!(acessos && acessos[idAcesso(userId, data)]);
}

function ehDiaUtil(d) {
  const w = d.getDay();
  return w !== 0 && w !== 6;
}

function criadaNoDia(t, data) {
  if (!t.createdAt) return false;
  const d = new Date(t.createdAt);
  return !isNaN(d) && dataLocalISO(d) === data;
}

// Operadores da generalização por ausência: nem Consulta nem Administrador
// (a pedido do usuário, o Administrador não conta como ausente nem é
// incluído quando a CI é generalizada). VIP segue contando — continua com
// a função de Atendente/Analista.
function ehOperador(u) {
  return !!u && u.role !== "consulta" && u.role !== "admin";
}

// Operadores sem acesso registrado hoje, se já passou do horário de corte.
// Fora do horário/dia, lista vazia.
export function usuariosAusentes(users, acessos, agora, cfg) {
  if (!cfg.ativo) return [];
  if (cfg.soDiasUteis && !ehDiaUtil(agora)) return [];
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  if (minAgora < hhmmToMin(cfg.horario || "09:30")) return [];
  const hoje = dataLocalISO(agora);
  return (users || []).filter((u) => ehOperador(u) && !acessouNoDia(acessos, u.id, hoje));
}

// Devolve a lista de tarefas com as generalizações aplicadas e o que mudou
// em cada uma ({ task, ausentes, adicionados }). Idempotente: cada tarefa
// guarda em `generalizadaAusencia[userId]` quem já motivou a generalização,
// então rodar de novo (outra aba, outro usuário) não duplica comentário.
export function generalizarPorAusencia(tasks, users, acessos, agora, cfg) {
  const ausentes = usuariosAusentes(users, acessos, agora, cfg);
  if (!ausentes.length) return { tasks, mudancas: [] };
  const hoje = dataLocalISO(agora);
  const todos = (users || []).filter(ehOperador).map((u) => u.id);
  const at = agora.toISOString();
  const mudancas = [];
  const next = (tasks || []).map((t) => {
    if (!t || t.status === "Concluído" || t.arquivadoManualmente || !criadaNoDia(t, hoje)) return t;
    const dests = t.destinatarios || [];
    const ja = t.generalizadaAusencia || {};
    const motivos = ausentes.filter((u) => dests.includes(u.id) && !ja[u.id]);
    if (!motivos.length) return t;
    const novosDest = [...dests];
    const adicionados = [];
    todos.forEach((id) => { if (!novosDest.includes(id)) { novosDest.push(id); adicionados.push(id); } });
    const nomes = motivos.map((u) => u.nome).join(", ");
    const texto = `⚠️ Comentário automático: esta CI foi generalizada para todos os usuários operadores devido à possível ausência de ${nomes} (sem acesso ao sistema até ${cfg.horario}).`;
    // Ausentes que só entraram agora (pela própria generalização) também
    // ficam marcados — senão a próxima rodada comentaria de novo por eles.
    const gen = { ...ja };
    ausentes.forEach((u) => { if (novosDest.includes(u.id) && !gen[u.id]) gen[u.id] = at; });
    const atualizada = {
      ...t,
      destinatarios: novosDest,
      generalizadaAusencia: gen,
      updatedAt: at,
      comments: [...(t.comments || []), { id: "cmt_" + Math.random().toString(36).slice(2, 9), userId: AUTOR_SISTEMA, sistema: true, text: texto, at }],
      log: [...(t.log || []), { at, who: null, acao: `Generalizada automaticamente por possível ausência de ${nomes}` }],
    };
    mudancas.push({ task: atualizada, ausentes: motivos, adicionados });
    return atualizada;
  });
  return { tasks: next, mudancas };
}

// 3) Alerta de CI sem interação dos destinatários — a pedido do usuário:
//    CI aberta em que nenhum destinatário interagiu (ciente, comentário ou
//    alteração) há mais de 10 min (5 min se Urgente) gera notificação para
//    Administradores/VIPs. Um alerta por "silêncio": se um destinatário
//    interage e depois volta a ficar parado, alerta de novo. Só olha
//    silêncios iniciados nas últimas 24h, pra não disparar de uma vez por
//    CIs antigas esquecidas.
// O prazo só corre no horário comercial (a pedido do usuário: fora dele "é
// óbvio que não vai ter interação") — CI aberta às 17:55 de sexta estoura
// os 10 min às 08:35 de segunda. Ver minutosUteisEntre.
export const SEM_INTERACAO_CFG_DEFAULT = {
  ativo: true, minutos: 10, minutosUrgente: 5, horarioInicio: "08:30", horarioFim: "18:00", soDiasUteis: true,
  // Alerta repetido ao criador da CI + escalonamento (ver verificarAlertasCriador).
  minutosCriador: 10, alertasParaEscalonar: 3, escalonarPara: "",
};
// Silêncios mais antigos que isso não alertam (evita disparar de uma vez por
// CIs antigas esquecidas). Em dias corridos, pra cobrir fim de semana.
const JANELA_SEM_INTERACAO_MS = 4 * 24 * 60 * 60 * 1000;

// Minutos de horário comercial entre dois instantes (hora local).
export function minutosUteisEntre(inicio, fim, cfg) {
  const a = new Date(inicio).getTime();
  const b = new Date(fim).getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return 0;
  const ini = hhmmToMin((cfg && cfg.horarioInicio) || "08:30");
  const fimDia = hhmmToMin((cfg && cfg.horarioFim) || "18:00");
  const soUteis = !cfg || cfg.soDiasUteis !== false;
  let total = 0;
  const dia = new Date(a);
  dia.setHours(0, 0, 0, 0);
  for (let n = 0; dia.getTime() <= b && n < 400; n++) {
    const w = dia.getDay();
    if (!soUteis || (w !== 0 && w !== 6)) {
      const jIni = new Date(dia); jIni.setHours(0, ini, 0, 0);
      const jFim = new Date(dia); jFim.setHours(0, fimDia, 0, 0);
      const de = Math.max(a, jIni.getTime());
      const ate = Math.min(b, jFim.getTime());
      if (ate > de) total += (ate - de) / 60000;
    }
    dia.setDate(dia.getDate() + 1);
  }
  return total;
}

export function semInteracaoCfg(config) {
  return { ...SEM_INTERACAO_CFG_DEFAULT, ...((config && config.corp_ci_sem_interacao) || {}) };
}

// Instante da última interação de algum destinatário (fora quem criou), ou
// a criação da CI se ninguém interagiu ainda.
export function referenciaInteracao(t) {
  const dests = (t.destinatarios || []).filter((id) => id && id !== t.origem);
  let ref = t.createdAt || "";
  const considerar = (iso) => { if (iso && String(iso) > ref) ref = String(iso); };
  dests.forEach((id) => considerar(t.ciente && t.ciente[id]));
  (t.comments || []).forEach((c) => { if (dests.includes(c.userId)) considerar(c.at); });
  (t.log || []).forEach((e) => { if (dests.includes(e.who)) considerar(e.at); });
  return ref;
}

// Destinatários (fora quem criou) e o instante da última interação de cada
// um (null = nunca interagiu) — quem aparece como "ausente" no alerta.
export function ultimaInteracaoPorDestinatario(t) {
  const dests = (t.destinatarios || []).filter((id) => id && id !== t.origem);
  return dests.map((id) => {
    let ult = (t.ciente && t.ciente[id]) || null;
    const considerar = (iso) => { if (iso && (!ult || String(iso) > ult)) ult = String(iso); };
    (t.comments || []).forEach((c) => { if (c.userId === id) considerar(c.at); });
    (t.log || []).forEach((e) => { if (e.who === id) considerar(e.at); });
    return { userId: id, ultima: ult };
  });
}

// "Interação considerada" (a pedido do usuário): Admin/VIP dizem que a
// última interação vale por um período escolhido à mão — enquanto
// `t.interacaoConsiderada.ate` não passa, a CI não alerta; depois dele, se
// ainda não houve interação, o alerta volta.
export function interacaoConsideradaAtiva(t, agora) {
  const ate = t && t.interacaoConsiderada && new Date(t.interacaoConsiderada.ate).getTime();
  return !!ate && !isNaN(ate) && (agora || new Date()).getTime() < ate;
}

// 4) Alerta repetido ao CRIADOR da CI (a pedido do usuário): a cada
//    `minutosCriador` minutos de horário comercial sem interação dos
//    destinatários — sem contar Administradores (role "admin") nem o
//    próprio criador — o criador recebe um alerta. A cada
//    `alertasParaEscalonar` alertas da mesma CI, o usuário de escalonamento
//    (Configurações → Comunicação Interna; padrão: o usuário "Bruno") entra
//    como destinatário, com comentário automático, e recebe alerta roxo +
//    notificação do Windows para avaliar um pedido de intervenção. O
//    "Considerar" dele (interacaoConsiderada) segura os alertas até o
//    horário escolhido; a contagem volta a correr a partir dali.
export function destinatariosOperadoresCI(t, users) {
  const admins = new Set((users || []).filter((u) => u && u.role === "admin").map((u) => u.id));
  return (t.destinatarios || []).filter((id) => id && id !== t.origem && !admins.has(id));
}

function referenciaInteracaoDe(t, dests) {
  let ref = t.createdAt || "";
  const considerar = (iso) => { if (iso && String(iso) > ref) ref = String(iso); };
  dests.forEach((id) => considerar(t.ciente && t.ciente[id]));
  (t.comments || []).forEach((c) => { if (dests.includes(c.userId)) considerar(c.at); });
  (t.log || []).forEach((e) => { if (dests.includes(e.who)) considerar(e.at); });
  return ref;
}

function semAcento(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Usuário que recebe o escalonamento: o configurado, ou (padrão) o
// primeiro usuário chamado "Bruno".
export function usuarioEscalonamentoId(cfg, users) {
  const lista = users || [];
  if (cfg && cfg.escalonarPara && lista.some((u) => u.id === cfg.escalonarPara)) return cfg.escalonarPara;
  const bruno = lista.find((u) => u && u.role !== "consulta" && semAcento(u.nome).split(/\s+/)[0] === "bruno");
  return bruno ? bruno.id : null;
}

export function verificarAlertasCriador(tasks, users, agora, cfg) {
  if (!cfg.ativo) return { tasks, alertas: [] };
  const intervalo = Number(cfg.minutosCriador) || 10;
  const limiteEsc = Number(cfg.alertasParaEscalonar) || 3;
  const escId = usuarioEscalonamentoId(cfg, users);
  const t0 = agora.getTime();
  const at = agora.toISOString();
  const alertas = [];
  const next = (tasks || []).map((t) => {
    if (!t || !t.origem || t.status === "Concluído" || t.arquivadoManualmente) return t;
    if (interacaoConsideradaAtiva(t, agora)) return t;
    const dests = destinatariosOperadoresCI(t, users);
    if (!dests.length) return t;
    const ref = referenciaInteracaoDe(t, dests);
    const consid = t.interacaoConsiderada && String(t.interacaoConsiderada.ate) > ref ? String(t.interacaoConsiderada.ate) : "";
    const baseMs = new Date(consid || ref).getTime();
    if (isNaN(baseMs) || t0 - baseMs > JANELA_SEM_INTERACAO_MS) return t;
    const devidos = Math.floor(minutosUteisEntre(baseMs, t0, cfg) / intervalo);
    const chave = consid ? ref + "|" + consid : ref;
    const enviados = t.alertaCriador && t.alertaCriador.chave === chave ? t.alertaCriador.enviados || 0 : 0;
    if (devidos <= enviados) return t;

    const contador = ((t.escalonamentoCI && t.escalonamentoCI.contador) || 0) + 1;
    const escalar = !!escId && contador >= limiteEsc;
    let atualizada = {
      ...t,
      alertaCriador: { chave, enviados: devidos, at },
      escalonamentoCI: { ...(t.escalonamentoCI || {}), contador: escalar ? 0 : contador, ...(escalar ? { ultimoEm: at, para: escId } : {}) },
    };
    let adicionado = false;
    if (escalar) {
      const nomeEsc = ((users || []).find((u) => u.id === escId) || { nome: "?" }).nome;
      adicionado = !(t.destinatarios || []).includes(escId);
      const texto = `⚠️ Comentário automático: ${limiteEsc} alertas seguidos sem interação dos destinatários — ${nomeEsc} ${adicionado ? "foi incluído(a) como destinatário(a)" : "foi acionado(a)"} para avaliar um pedido de intervenção.`;
      atualizada = {
        ...atualizada,
        destinatarios: adicionado ? [...(t.destinatarios || []), escId] : (t.destinatarios || []),
        updatedAt: at,
        comments: [...(t.comments || []), { id: "cmt_" + Math.random().toString(36).slice(2, 9), userId: AUTOR_SISTEMA, sistema: true, text: texto, at }],
        log: [...(t.log || []), { at, who: null, acao: `Escalonada para ${nomeEsc} após ${limiteEsc} alertas sem interação` }],
      };
    }
    alertas.push({ task: atualizada, minutos: devidos * intervalo, ausentes: dests, escalar, escalonadoPara: escalar ? escId : null, adicionado });
    return atualizada;
  });
  return { tasks: alertas.length ? next : tasks, alertas };
}

export function limiteSemInteracaoMin(t, cfg) {
  return t.urgencia === "Urgente" ? Number(cfg.minutosUrgente) || 5 : Number(cfg.minutos) || 10;
}

// Devolve as tarefas com a marca `alertaSemInteracao` gravada nas que
// acabaram de estourar o limite, e a lista delas ({ task, minutos }).
export function verificarSemInteracao(tasks, agora, cfg) {
  if (!cfg.ativo) return { tasks, alertas: [] };
  const t0 = agora.getTime();
  const alertas = [];
  const next = (tasks || []).map((t) => {
    if (!t || t.status === "Concluído" || t.arquivadoManualmente) return t;
    if (!(t.destinatarios || []).some((id) => id && id !== t.origem)) return t;
    if (interacaoConsideradaAtiva(t, agora)) return t;
    const ref = referenciaInteracao(t);
    const refMs = new Date(ref).getTime();
    // Um período de "interação considerada" já vencido sem nova interação
    // conta como um novo silêncio: alerta de novo (chave = ref + fim dele).
    const consid = t.interacaoConsiderada && String(t.interacaoConsiderada.ate) > ref ? String(t.interacaoConsiderada.ate) : "";
    const chave = consid ? ref + "|" + consid : ref;
    const desdeMs = consid ? new Date(consid).getTime() : refMs;
    if (isNaN(refMs) || t0 - desdeMs > JANELA_SEM_INTERACAO_MS) return t;
    const minutos = limiteSemInteracaoMin(t, cfg);
    if (minutosUteisEntre(refMs, t0, cfg) < minutos) return t;
    if (t.alertaSemInteracao && t.alertaSemInteracao.ref === chave) return t;
    const atualizada = { ...t, alertaSemInteracao: { ref: chave, at: agora.toISOString(), minutos } };
    alertas.push({ task: atualizada, minutos, ausentes: ultimaInteracaoPorDestinatario(t).map((d) => d.userId), aposConsiderada: !!consid });
    return atualizada;
  });
  return { tasks: alertas.length ? next : tasks, alertas };
}

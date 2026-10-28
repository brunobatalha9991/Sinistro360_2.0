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

// Usuários (não Consulta) sem acesso registrado hoje, se já passou do
// horário de corte. Fora do horário/dia, lista vazia.
export function usuariosAusentes(users, acessos, agora, cfg) {
  if (!cfg.ativo) return [];
  if (cfg.soDiasUteis && !ehDiaUtil(agora)) return [];
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  if (minAgora < hhmmToMin(cfg.horario || "09:30")) return [];
  const hoje = dataLocalISO(agora);
  return (users || []).filter((u) => u && u.role !== "consulta" && !acessouNoDia(acessos, u.id, hoje));
}

// Devolve a lista de tarefas com as generalizações aplicadas e o que mudou
// em cada uma ({ task, ausentes, adicionados }). Idempotente: cada tarefa
// guarda em `generalizadaAusencia[userId]` quem já motivou a generalização,
// então rodar de novo (outra aba, outro usuário) não duplica comentário.
export function generalizarPorAusencia(tasks, users, acessos, agora, cfg) {
  const ausentes = usuariosAusentes(users, acessos, agora, cfg);
  if (!ausentes.length) return { tasks, mudancas: [] };
  const hoje = dataLocalISO(agora);
  const todos = naoConsulta(users);
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
export const SEM_INTERACAO_CFG_DEFAULT = { ativo: true, minutos: 10, minutosUrgente: 5 };
const JANELA_SEM_INTERACAO_MS = 24 * 60 * 60 * 1000;

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
    const ref = referenciaInteracao(t);
    const refMs = new Date(ref).getTime();
    if (isNaN(refMs) || t0 - refMs > JANELA_SEM_INTERACAO_MS) return t;
    const minutos = limiteSemInteracaoMin(t, cfg);
    if (t0 - refMs < minutos * 60000) return t;
    if (t.alertaSemInteracao && t.alertaSemInteracao.ref === ref) return t;
    const atualizada = { ...t, alertaSemInteracao: { ref, at: agora.toISOString(), minutos } };
    alertas.push({ task: atualizada, minutos });
    return atualizada;
  });
  return { tasks: alertas.length ? next : tasks, alertas };
}

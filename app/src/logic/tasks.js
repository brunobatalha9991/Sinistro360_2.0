// Porte 1:1 das regras de Comunicação interna (tarefas/notificações) do
// HTML original. Funções puras recebem os dados como parâmetro.
export const URG_ORDER = { Urgente: 0, Moderado: 1, Leve: 2 };
// Ordem de exibição por status — a pedido do usuário: Pendente primeiro,
// Em andamento depois, Concluído sempre por último.
export const STATUS_ORDER = { Pendente: 0, "Em andamento": 1, Concluído: 2 };

// Arquivamento automático (a pedido do usuário): 4 dias corridos depois de
// concluída, a tarefa some da lista principal (mesmo com todos os filtros
// marcados) mas continua acessível pelo botão "Arquivadas". É um estado
// DERIVADO da data de conclusão — não apaga nem move nada; nada impede que
// o purgeOldTasks() existente (useTasksActions.js) ainda apague de vez
// depois de 15 dias, o arquivamento só acrescenta um estágio intermediário
// não destrutivo antes disso.
export const DIAS_PARA_ARQUIVAR = 4;
export function isTarefaArquivada(t) {
  if (!t) return false;
  // Arquivamento manual (a pedido do usuário): registrado com motivo
  // obrigatório e vale independente de status/tempo de conclusão.
  if (t.arquivadoManualmente) return true;
  if (t.status !== "Concluído" || !t.concludedAt) return false;
  const concluidoEm = new Date(t.concludedAt).getTime();
  if (isNaN(concluidoEm)) return false;
  return Date.now() - concluidoEm > DIAS_PARA_ARQUIVAR * 24 * 60 * 60 * 1000;
}

// Descreve, campo a campo, o que mudou entre a versão anterior e a nova de
// uma tarefa — usado pra alimentar a auditoria interna (log) com um
// registro granular de quem preencheu/alterou o quê, em vez de uma única
// linha genérica "tarefa atualizada". Função pura: não grava nada, só
// compara. `ctx.users`/`ctx.claims` são usados só pra resolver nomes.
export function descreverAlteracoesTarefa(antes, depois, ctx) {
  const users = (ctx && ctx.users) || [];
  const claims = (ctx && ctx.claims) || [];
  const nomeUser = (id) => (users.find((u) => u.id === id) || {}).nome || id;
  const labelClaim = (id) => {
    const c = claims.find((x) => x.id === id);
    return c ? (c.numsin || "#" + c.nosnum) : id;
  };
  const out = [];
  if (!antes) return out;
  if (antes.tipo !== depois.tipo) out.push(`Tipo alterado de "${antes.tipo}" para "${depois.tipo}"`);
  if (antes.urgencia !== depois.urgencia) out.push(`Urgência alterada de "${antes.urgencia}" para "${depois.urgencia}"`);
  if (antes.status !== depois.status) out.push(`Status alterado de "${antes.status}" para "${depois.status}"`);
  if ((antes.titulo || "") !== (depois.titulo || "")) out.push("Título alterado");
  if ((antes.descricao || "") !== (depois.descricao || "")) out.push("Descrição alterada");
  if ((antes.anexo || "") !== (depois.anexo || "")) out.push("Anexo alterado");
  if ((antes.obs || "") !== (depois.obs || "")) out.push("Observação alterada");
  if ((antes.tipoAtendimento || "") !== (depois.tipoAtendimento || "")) {
    out.push(`Atendimento alterado para "${depois.tipoAtendimento || "—"}"`);
  }
  if ((antes.proximaAcaoData || "") !== (depois.proximaAcaoData || "")) {
    out.push(`Data da próxima ação alterada para ${depois.proximaAcaoData ? depois.proximaAcaoData.split("-").reverse().join("/") : "—"}`);
  }
  if ((antes.processo || "") !== (depois.processo || "")) {
    out.push(depois.processo ? `Vinculada ao processo ${labelClaim(depois.processo)}` : "Vínculo com processo removido");
  }
  const antesFlags = antes.flags || [];
  const depoisFlags = depois.flags || [];
  if (antesFlags.slice().sort().join(",") !== depoisFlags.slice().sort().join(",")) {
    const add = depoisFlags.filter((f) => antesFlags.indexOf(f) < 0);
    const rem = antesFlags.filter((f) => depoisFlags.indexOf(f) < 0);
    if (add.length) out.push(`Sinalizador(es) marcado(s): ${add.join(", ")}`);
    if (rem.length) out.push(`Sinalizador(es) desmarcado(s): ${rem.join(", ")}`);
  }
  const antesDest = antes.destinatarios || [];
  const depoisDest = depois.destinatarios || [];
  if (antesDest.slice().sort().join(",") !== depoisDest.slice().sort().join(",")) {
    const add = depoisDest.filter((id) => antesDest.indexOf(id) < 0).map(nomeUser);
    const rem = antesDest.filter((id) => depoisDest.indexOf(id) < 0).map(nomeUser);
    if (add.length) out.push(`Destinatário(s) adicionado(s): ${add.join(", ")}`);
    if (rem.length) out.push(`Destinatário(s) removido(s): ${rem.join(", ")}`);
  }
  if (JSON.stringify(antes.checklistMesa || null) !== JSON.stringify(depois.checklistMesa || null)) {
    out.push("Checklist de abertura preenchido/atualizado");
  }
  if (JSON.stringify(antes.solicitacao || null) !== JSON.stringify(depois.solicitacao || null)) {
    out.push(antes.solicitacao ? "Formulário de solicitação atualizado" : "Formulário de solicitação preenchido");
  }
  if (JSON.stringify(antes.recorrencia || null) !== JSON.stringify(depois.recorrencia || null)) {
    out.push(depois.recorrencia && depois.recorrencia.ativa ? `Recorrência configurada: ${resumoRecorrencia(depois.recorrencia)}` : "Recorrência desativada");
  }
  return out;
}

export function taskParticipants(t) {
  const ids = [t.origem].concat(t.destinatarios || []);
  const seen = {};
  const out = [];
  ids.forEach((i) => { if (i && !seen[i]) { seen[i] = true; out.push(i); } });
  return out;
}
// `escopoUserId` null/undefined = todas as tarefas (usado por admin/VIP no
// filtro "Todos") — qualquer id = só as tarefas em que esse usuário é
// origem OU destinatário (mesmo critério de sempre).
export function tarefasNoEscopo(tasks, escopoUserId) {
  if (escopoUserId == null) return tasks || [];
  return (tasks || []).filter((t) => taskParticipants(t).indexOf(escopoUserId) >= 0);
}
export function myTasks(tasks, currentUser) {
  if (!currentUser) return [];
  return tarefasNoEscopo(tasks, currentUser.id);
}
// Filtro "Origem/Destinatário" (a pedido do usuário) — só faz sentido com
// um usuário de referência definido (não em "Todos"); "ambos" (padrão) não
// filtra nada.
export function tarefaTemPapel(t, userId, papel) {
  if (papel === "origem") return t.origem === userId;
  if (papel === "destinatario") return (t.destinatarios || []).indexOf(userId) >= 0;
  return true;
}
export function taskCienteByMe(t, currentUser) {
  if (!currentUser) return false;
  const c = t.ciente && t.ciente[currentUser.id];
  if (!c) return false;
  const last = t.updatedAt || t.createdAt;
  return String(c) >= String(last);
}
// Tarefa de emergência (Mesa de Atendimento / Assistência 24h) — a pedido
// do usuário: fica sempre no topo da lista e recebe alerta neon, exceto
// quando já concluída (mesmo critério de taskIsStale para não manter alerta
// de algo já resolvido).
export function isTarefaEmergencia(t) {
  return !!(t && t.tipo === "Mesa de Atendimento" && t.tipoAtendimento === "assistencia_24h" && t.status !== "Concluído");
}

// Ordenação automática (a pedido do usuário): concluída sempre por último
// (bug relatado 2026-08-28 — uma tarefa Urgente concluída ficava acima de
// outras ainda pendentes, porque STATUS_ORDER existia mas nunca entrava de
// fato no critério, só emergência/urgência/data), depois emergência sempre
// no topo, depois por grau de urgência, depois por data de criação (mais
// recente primeiro). Extraída como função pura pra ser testável e
// reaproveitável entre a ordenação automática e o botão "Reorganizar" (que
// volta a este critério).
export function compararTarefasAuto(a, b) {
  const sA = STATUS_ORDER[a.status] ?? 9;
  const sB = STATUS_ORDER[b.status] ?? 9;
  if (sA !== sB) return sA - sB;
  const eA = isTarefaEmergencia(a) ? 0 : 1;
  const eB = isTarefaEmergencia(b) ? 0 : 1;
  if (eA !== eB) return eA - eB;
  const u = (URG_ORDER[a.urgencia] ?? 9) - (URG_ORDER[b.urgencia] ?? 9);
  if (u !== 0) return u;
  return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}

// Sinalizadores configuráveis pelo admin (a pedido do usuário) — mesmo
// padrão de corp_task_types (ver TaskTypeManager em Tarefas.jsx). Várias
// podem ficar ativas ao mesmo tempo na mesma tarefa.
export const TASK_FLAGS_DEFAULT = ["Aguard. cliente", "Aguard. corretora"];

// Número de protocolo sequencial (CI-000001, CI-000002...) — a pedido do
// usuário, pra dar um identificador curto e falável pra cada tarefa. Olha o
// maior número "CI-NNNNNN" já usado e soma 1; sem nenhum ainda, começa em 1.
// Time pequeno, criação pouco concorrente — não é um contador atômico
// (não há backend pra isso), então uma colisão exigiria duas pessoas
// criando tarefa no exato mesmo instante, sem nenhum refresh entre uma e
// outra.
export function proximoCI(tasks) {
  let maior = 0;
  (tasks || []).forEach((t) => {
    const m = /^CI-(\d+)$/.exec(t.ci || "");
    if (m) { const n = parseInt(m[1], 10); if (n > maior) maior = n; }
  });
  return "CI-" + String(maior + 1).padStart(6, "0");
}

// Recorrência personalizada de tarefa (a pedido do usuário, módulo
// Comunicação) — repete a cada N dia(s)/semana(s)/mês(es), contados a
// partir da criação da tarefa original, com término opcional por data ou
// por número de ocorrências. Cada ocorrência vencida vira uma NOVA tarefa
// (mesmo vínculo/tipo/destinatários da original), gerada automaticamente
// ao abrir o módulo (ver gerarOcorrenciasRecorrentes em useTasksActions.js)
// — não existe backend/cron aqui, então a geração roda no cliente sempre
// que alguém abre a tela.
export const RECORRENCIA_UNIDADES = [["dias", "dia(s)"], ["semanas", "semana(s)"], ["meses", "mês(es)"]];

function somarUnidadeRecorrencia(dataBase, unidade, qtd) {
  const d = new Date(dataBase);
  if (unidade === "semanas") d.setDate(d.getDate() + qtd * 7);
  else if (unidade === "meses") d.setMonth(d.getMonth() + qtd);
  else d.setDate(d.getDate() + qtd);
  return d;
}
// Data (YYYY-MM-DD) da próxima ocorrência ainda não gerada — conta a partir
// de `ocorrenciasGeradas + 1` intervalos desde a criação da tarefa original.
export function proximaOcorrenciaRecorrencia(t) {
  const r = t && t.recorrencia;
  if (!r || !r.ativa) return null;
  const n = (r.ocorrenciasGeradas || 0) + 1;
  return somarUnidadeRecorrencia(t.createdAt, r.unidade, (r.intervalo || 1) * n).toISOString().slice(0, 10);
}
// Verdadeiro quando a série já bateu no limite configurado (data-fim ou
// nº de ocorrências) — a recorrência para de gerar novas tarefas.
export function recorrenciaEncerrada(t) {
  const r = t && t.recorrencia;
  if (!r || !r.ativa) return true;
  if (r.fim && r.fim.tipo === "vezes" && (r.ocorrenciasGeradas || 0) >= r.fim.vezes) return true;
  if (r.fim && r.fim.tipo === "data") {
    const prox = proximaOcorrenciaRecorrencia(t);
    if (prox && prox > r.fim.data) return true;
  }
  return false;
}
export function recorrenciaVencida(t, hojeStr) {
  if (!t || !t.recorrencia || !t.recorrencia.ativa || recorrenciaEncerrada(t)) return false;
  const prox = proximaOcorrenciaRecorrencia(t);
  return !!prox && prox <= hojeStr;
}
// Clona a tarefa original numa nova ocorrência: mesmo conteúdo/vínculos,
// progresso zerado (Pendente, sem comentários/log anterior/ciente) e sem
// recorrência própria (quem continua a série é sempre a tarefa original).
export function gerarOcorrenciaRecorrente(t, agoraISO) {
  return {
    ...t,
    id: "tsk_" + Math.random().toString(36).slice(2, 9),
    status: "Pendente",
    createdAt: agoraISO,
    updatedAt: agoraISO,
    concludedAt: null,
    comments: [],
    ciente: {},
    arquivadoManualmente: null,
    recorrencia: null,
    origemRecorrenciaId: t.origemRecorrenciaId || t.id,
    log: [{ at: agoraISO, who: null, acao: `Gerada automaticamente pela recorrência de "${t.titulo}"` }],
  };
}
export function resumoRecorrencia(r) {
  if (!r || !r.ativa) return "";
  const unidadeLabel = (RECORRENCIA_UNIDADES.find(([k]) => k === r.unidade) || ["", r.unidade])[1];
  let s = `Repete a cada ${r.intervalo || 1} ${unidadeLabel}`;
  if (r.fim && r.fim.tipo === "data") s += `, até ${String(r.fim.data || "").split("-").reverse().join("/")}`;
  else if (r.fim && r.fim.tipo === "vezes") s += `, por ${r.fim.vezes} vez(es)`;
  else s += ", sem data de término";
  return s;
}

export function taskIsStale(t, currentUser) {
  if (t.status === "Concluído") return false;
  if (taskCienteByMe(t, currentUser)) return false;
  const last = new Date(t.updatedAt || t.createdAt).getTime();
  return Date.now() - last > 2 * 60 * 60 * 1000;
}

export function myNotifs(notifs, currentUser) {
  if (!currentUser) return [];
  return (notifs || []).filter((n) => n.userId === currentUser.id).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
export function myUnreadCount(notifs, currentUser) {
  return myNotifs(notifs, currentUser).filter((n) => !n.read).length;
}

export function demandaUnreadCount(demandas) {
  return (demandas || []).filter((d) => !d.lida).length;
}

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
  if ((antes.processo || "") !== (depois.processo || "")) {
    out.push(depois.processo ? `Vinculada ao processo ${labelClaim(depois.processo)}` : "Vínculo com processo removido");
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
  return out;
}

export function taskParticipants(t) {
  const ids = [t.origem].concat(t.destinatarios || []);
  const seen = {};
  const out = [];
  ids.forEach((i) => { if (i && !seen[i]) { seen[i] = true; out.push(i); } });
  return out;
}
export function myTasks(tasks, currentUser) {
  if (!currentUser) return [];
  return (tasks || []).filter((t) => taskParticipants(t).indexOf(currentUser.id) >= 0);
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

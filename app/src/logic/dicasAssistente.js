// Dicas/lembretes programados do Assistente (a pedido do usuário) —
// administrados em Configurações (ver ConfiguracoesDicasAssistenteCard.jsx),
// entregues pro papel configurado (ex.: Atendente/Analista) no horário
// configurado (ex.: "09:00"), todo dia. Sem backend/cron neste app: a
// entrega acontece no cliente, a primeira vez que o usuário alvo tiver o
// app aberto (ou o abrir) a partir daquele horário naquele dia — não é um
// push exato à hora cravada, ver useDicasAssistente.js.
export const PAPEIS_DICA = [["atendente", "Atendente"], ["analista", "Analista"], ["admin", "Administrador"], ["consulta", "Consulta"]];

export function blankDica() {
  return { id: "", texto: "", hora: "09:00", papeis: ["atendente", "analista"], ativo: true };
}

// Sem papéis marcados, a dica não aplica a ninguém (evita mandar pra todo
// mundo por engano ao esquecer de marcar) — diferente do vínculo de
// Agente/Produtor (onde "nenhum" = sem restrição), aqui o padrão seguro é
// "nenhum destino configurado" quando a lista está vazia.
export function dicaAplicaAoUsuario(dica, user) {
  if (!dica || !dica.ativo || !user) return false;
  return (dica.papeis || []).indexOf(user.role) >= 0;
}

// Id determinístico (dica + usuário + dia) — dedupe: nunca manda a mesma
// dica duas vezes pro mesmo usuário no mesmo dia, mesmo que a checagem
// rode de novo (reabrir o app, trocar de aba, virar o minuto de novo...).
export function dicaNotifId(dicaId, userId, diaISO) {
  return `dica_${dicaId}_${userId}_${diaISO}`;
}

// Dicas que já deveriam ter sido entregues hoje pro usuário (hora
// configurada já passou) e ainda não foram (sem notif com o id
// determinístico de hoje em `notifs`).
export function dicasPendentesHoje(dicas, notifs, user, agora = new Date()) {
  if (!user) return [];
  const hojeISO = agora.toISOString().slice(0, 10);
  const hhmm = String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0");
  const idsExistentes = new Set((notifs || []).map((n) => n.id));
  return (dicas || []).filter((d) => {
    if (!dicaAplicaAoUsuario(d, user)) return false;
    if (!d.hora || d.hora > hhmm) return false;
    return !idsExistentes.has(dicaNotifId(d.id, user.id, hojeISO));
  });
}

export function defaultDicasAssistente() {
  return [
    { id: "dica_whatsapp", texto: "📱 Verifique o WhatsApp — confira se há mensagens de clientes ou oficinas aguardando resposta.", hora: "09:00", papeis: ["atendente", "analista"], ativo: true },
    { id: "dica_email", texto: "✉️ Verifique o e-mail — olhe a Caixa de entrada por novidades de seguradoras e oficinas.", hora: "09:05", papeis: ["atendente", "analista"], ativo: true },
    { id: "dica_comunicacao", texto: "💬 Verifique a Comunicação interna — veja se há tarefas pendentes ou próximas ações vencendo hoje.", hora: "09:10", papeis: ["atendente", "analista"], ativo: true },
  ];
}

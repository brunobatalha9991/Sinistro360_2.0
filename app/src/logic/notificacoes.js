// Categoria de cada notificação — usada pelo filtro do módulo Notificações.
export const CATEGORIAS_NOTIF = [
  ["ci", "Comunicação interna"],
  ["acompanhamento", "Acompanhamento"],
  ["sem_interacao", "Sem interação / intervenção"],
  ["agenda", "Agenda"],
  ["demanda", "Demandas"],
  ["desempenho", "Desempenho"],
  ["dica", "Dicas do Assistente"],
];
export function categoriaNotif(n) {
  if (n.tipo === "agenda_feedback" || n.tipo === "agenda_comentario") return "agenda";
  if (n.tipo === "dica") return "dica";
  if (n.tipo === "conduta" || n.tipo === "conduta_resposta" || n.tipo === "desempenho_mudanca" || n.tipo === "desempenho_fechamento") return "desempenho";
  if (n.taskId === "__demanda__") return "demanda";
  if (n.tipo === "escalonamento_ci" || n.tipo === "sem_interacao" || n.tipo === "sem_interacao_criador" || String(n.text || "").startsWith("⏱")) return "sem_interacao";
  if (n.acompanhamento) return "acompanhamento";
  return "ci";
}

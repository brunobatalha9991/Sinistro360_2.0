import { taskParticipants, isTarefaArquivada } from "../../logic/tasks";
import { campoEfetivo } from "../../logic/claims";

// Tool de LEITURA: hoje o Assistente só sabia CRIAR tarefa (create_task),
// nunca consultar as que já existem — a pedido do usuário, que queria poder
// perguntar "quem está com o quê" e "o que ainda está pendente". Arquivadas
// (ver isTarefaArquivada) ficam de fora por padrão, igual à lista principal
// de Tarefas.jsx.
export const listarTarefasTool = {
  name: "listar_tarefas",
  description:
    "Lista tarefas de Comunicação interna (não confundir com sinistros) — quem está com o quê, prazos, status. Use para perguntas como 'quais tarefas estão pendentes', 'o que fulano tem pra fazer', 'tarefas urgentes em aberto'. Não traz tarefas arquivadas (concluídas há mais de alguns dias) a menos que incluirArquivadas seja true.",
  parameters: {
    type: "OBJECT",
    properties: {
      usuarioNome: { type: "STRING", description: "Opcional: filtra tarefas em que este usuário é origem OU destinatário." },
      status: { type: "STRING", description: "Opcional: filtra por status.", enum: ["Pendente", "Em andamento", "Concluído"] },
      urgencia: { type: "STRING", description: "Opcional: filtra por urgência.", enum: ["Leve", "Moderado", "Urgente"] },
      incluirArquivadas: { type: "BOOLEAN", description: "Opcional (padrão false): inclui tarefas já arquivadas (concluídas há mais de alguns dias)." },
      limit: { type: "INTEGER", description: "Máximo de resultados (padrão 15, máximo 30)." },
    },
  },
  requiresConfirmation: false,
  run(args, ctx) {
    const { records } = ctx;
    const users = records.corp_users || [];
    const claims = records.corp_claims || [];
    const overrides = records.corp_overrides || {};
    const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 30);

    const nomeUser = (id) => (users.find((u) => u.id === id) || {}).nome || "—";
    const labelClaim = (id) => {
      const c = claims.find((x) => x.id === id);
      return c ? (c.numsin || "#" + c.nosnum) + " — " + (campoEfetivo(overrides, c, "segurado") || "") : null;
    };

    let usuarioFiltro = null;
    if (args.usuarioNome) {
      const q = String(args.usuarioNome).trim().toLowerCase();
      usuarioFiltro = users.find((u) => u.nome.toLowerCase().indexOf(q) >= 0);
      if (!usuarioFiltro) return { error: `Usuário "${args.usuarioNome}" não encontrado.` };
    }

    let tarefas = records.corp_tasks || [];
    if (!args.incluirArquivadas) tarefas = tarefas.filter((t) => !isTarefaArquivada(t));
    if (usuarioFiltro) tarefas = tarefas.filter((t) => taskParticipants(t).indexOf(usuarioFiltro.id) >= 0);
    if (args.status) tarefas = tarefas.filter((t) => t.status === args.status);
    if (args.urgencia) tarefas = tarefas.filter((t) => t.urgencia === args.urgencia);
    tarefas = tarefas.slice().sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));

    const total = tarefas.length;
    const pagina = tarefas.slice(0, limit);
    const resultados = pagina.map((t) => ({
      id: t.id, titulo: t.titulo, tipo: t.tipo, urgencia: t.urgencia, status: t.status,
      origem: nomeUser(t.origem), destinatarios: (t.destinatarios || []).map(nomeUser),
      processo: t.processo ? labelClaim(t.processo) : null,
      criadaEm: t.createdAt, atualizadaEm: t.updatedAt || t.createdAt, concluidaEm: t.concludedAt || null,
    }));

    return {
      total, mostrando: resultados.length, resultados,
      metodologia: `Lista de corp_tasks${usuarioFiltro ? ` filtrada por participante (${usuarioFiltro.nome}, origem ou destinatário)` : ""}${args.status ? `, status "${args.status}"` : ""}${args.urgencia ? `, urgência "${args.urgencia}"` : ""}, ${args.incluirArquivadas ? "incluindo" : "sem incluir"} arquivadas.`,
      fontes: pagina.map((t) => ({
        tipo: "tarefa", id: t.id, descricao: `${t.titulo} (${t.status})`,
        data_hora: t.updatedAt || t.createdAt, url_interna: "#/tarefas",
      })),
    };
  },
};

import { uid } from "../../logic/format";
import { visibleClaims, campoEfetivo } from "../../logic/claims";

// Tool de ESCRITA: run() só monta a proposta (summary + after + apply) —
// nunca grava nada sozinho. apply() é chamada pela UI só depois do usuário
// confirmar a proposta no chat (ver src/hooks/useAiChatActions.js).
export const createTaskTool = {
  name: "create_task",
  description:
    "Propõe a criação de uma nova tarefa no sistema, opcionalmente vinculada a um sinistro. NÃO grava nada sozinho — o sistema pede confirmação do usuário antes de salvar.",
  parameters: {
    type: "OBJECT",
    properties: {
      titulo: { type: "STRING", description: "Título curto da tarefa." },
      descricao: { type: "STRING", description: "Descrição/detalhes da tarefa (opcional)." },
      urgencia: { type: "STRING", description: "Grau de urgência.", enum: ["Leve", "Moderado", "Urgente"] },
      tipo: { type: "STRING", description: "Tipo da tarefa (ex.: Comunicação, Lembrete, Tarefa). Opcional — usa o primeiro tipo configurado se omitido." },
      processoQuery: { type: "STRING", description: "Opcional: nome do segurado, placa ou número do sinistro para vincular a tarefa a um processo existente." },
      destinatarioNome: { type: "STRING", description: "Opcional: nome do usuário destinatário. Se omitido ou não encontrado, a tarefa é atribuída ao próprio usuário logado." },
    },
    required: ["titulo"],
  },
  requiresConfirmation: true,
  run(args, ctx) {
    const { records, currentUser, config } = ctx;
    const users = records.corp_users || [];
    const overrides = records.corp_overrides || {};
    const taskTypes = config.corp_task_types && config.corp_task_types.length ? config.corp_task_types : ["Comunicação", "Lembrete", "Tarefa"];

    const titulo = String(args.titulo || "").trim();
    if (!titulo) return { error: "Informe um título para a tarefa." };

    const urgencia = ["Leve", "Moderado", "Urgente"].indexOf(args.urgencia) >= 0 ? args.urgencia : "Leve";
    const tipo = taskTypes.indexOf(args.tipo) >= 0 ? args.tipo : taskTypes[0];

    let processo = null;
    const pq = String(args.processoQuery || "").trim().toLowerCase();
    if (pq) {
      processo = visibleClaims(records.corp_claims).find(
        (c) => [c.segurado, c.placa, c.numsin].join(" ").toLowerCase().indexOf(pq) >= 0
      ) || null;
    }

    let destinatario = null;
    const dn = String(args.destinatarioNome || "").trim().toLowerCase();
    if (dn) destinatario = users.find((u) => String(u.nome || "").toLowerCase().indexOf(dn) >= 0) || null;
    if (!destinatario) destinatario = currentUser;

    const novaTarefa = {
      id: uid("tsk"), tipo, titulo, origem: currentUser.id, destinatarios: [destinatario.id],
      descricao: String(args.descricao || ""), anexo: "", obs: "", status: "Pendente", urgencia,
      processo: processo ? processo.id : "",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), log: [], comments: [],
    };

    const summary =
      `Criar tarefa "${titulo}" (${urgencia}) para ${destinatario.nome}` +
      (processo ? ` — vinculada ao sinistro ${processo.numsin || "#" + processo.nosnum} (${campoEfetivo(overrides, processo, "segurado")})` : "") +
      ".";

    return {
      summary,
      after: novaTarefa,
      apply() {
        ctx.saveRecord("corp_tasks", (current) => [...(current || []), novaTarefa]);
        if (destinatario.id !== currentUser.id) {
          ctx.saveRecord("corp_notifs", (current) => [
            ...(current || []),
            { id: uid("ntf"), taskId: novaTarefa.id, userId: destinatario.id, text: `Nova tarefa de ${currentUser.nome}: ${titulo}`, at: new Date().toISOString(), read: false },
          ]);
        }
      },
    };
  },
};

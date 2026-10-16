import { campoEfetivo } from "./claims";
import { oficinaNomeFromId } from "./oficinas";
import { seguradoraNomeFromId } from "./seguradoras";
import { clienteNomeFromId } from "./clientes";
import { checklistProgresso } from "./checklistMesaAtendimento";
import { isTarefaEmergencia, isTarefaArquivada, resumoRecorrencia } from "./tasks";
import { fmtDateHoraBR } from "./format";

// Relatório de Comunicação interna (a pedido do usuário): uma linha por
// tarefa de corp_tasks com TUDO — protocolo, origem, destinatários,
// confirmação de leitura por destinatário, indicadores (urgência,
// sinalizadores, emergência, atraso, sem interação), vínculos e datas.

export const TIPO_ATENDIMENTO_LABEL = {
  sinistro: "Sinistro",
  assistencia_24h: "Assistência 24h",
  assistencia_vidros: "Vidros/pequenos reparos",
};


// Leitura de UM destinatário. Duas evidências independentes:
// - "Ciente" (botão ✓ Ciente): t.ciente[uid] = instante do clique. Só vale
//   pra versão atual se for depois da última ação (mesmo critério de
//   taskCienteByMe); antes disso é "ciente de uma versão anterior".
// - Notificações (corp_notifs): abrir a tarefa marca as notificações dela
//   como lidas. Todas lidas = "Lida"; alguma não lida = "Não lida".
export function leituraDestinatario(t, uid, notifs) {
  const cienteEm = (t.ciente && t.ciente[uid]) || "";
  const ultima = t.updatedAt || t.createdAt || "";
  const cienteAtual = !!cienteEm && String(cienteEm) >= String(ultima);
  const minhas = (notifs || []).filter((n) => n.taskId === t.id && n.userId === uid);
  const naoLidas = minhas.filter((n) => !n.read).length;
  const abriu = minhas.length ? naoLidas === 0 : null; // null = sem notificação (ex.: é a própria origem)
  let situacao;
  if (cienteAtual) situacao = "Ciente";
  else if (cienteEm) situacao = "Ciente (versão anterior)";
  else if (abriu === true) situacao = "Lida, sem ciente";
  else if (abriu === false) situacao = "Não lida";
  else situacao = "Sem notificação";
  return { cienteEm, cienteAtual, abriu, naoLidas, situacao };
}

function horasEntre(a, b) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (isNaN(ta) || isNaN(tb)) return null;
  return (tb - ta) / 3600000;
}
function duracaoTxt(horas) {
  if (horas == null || horas < 0) return "";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${Math.round(horas * 10) / 10} h`;
  return `${Math.round((horas / 24) * 10) / 10} dias`;
}

// Cache de nomes por id: os *NomeFromId varrem todos os processos a cada
// chamada — num relatório com centenas de tarefas isso pesaria.
function cacheNomes(fn) {
  const m = new Map();
  return (id) => { if (!id) return ""; if (!m.has(id)) m.set(id, fn(id) || ""); return m.get(id); };
}

export function montarLinhasComunicacao({ tasks, notifs, users, claims, overrides, config, agora }) {
  const ag = agora || new Date();
  const agoraISO = ag.toISOString();
  const hojeISO = `${ag.getFullYear()}-${String(ag.getMonth() + 1).padStart(2, "0")}-${String(ag.getDate()).padStart(2, "0")}`;
  const nomeUser = (id) => (users.find((u) => u.id === id) || {}).nome || (id ? "?" : "");
  const oficina = cacheNomes((id) => oficinaNomeFromId(claims, overrides, id));
  const seguradora = cacheNomes((id) => seguradoraNomeFromId(claims, overrides, id));
  const cliente = cacheNomes((id) => clienteNomeFromId(claims, overrides, id));

  return (tasks || []).map((t) => {
    const dests = t.destinatarios || [];
    const leituras = dests.map((uid) => ({ uid, nome: nomeUser(uid), ...leituraDestinatario(t, uid, notifs) }));
    const cientes = leituras.filter((l) => l.cienteAtual).length;
    const lidas = leituras.filter((l) => l.cienteAtual || l.cienteEm || l.abriu === true).length;
    const proc = t.processo ? (claims || []).find((c) => c.id === t.processo) : null;
    const comments = t.comments || [];
    const ultComentario = comments.length ? comments[comments.length - 1] : null;
    const concluida = t.status === "Concluído";
    const semInteracaoH = !concluida ? horasEntre(t.updatedAt || t.createdAt, agoraISO) : null;
    const checklist = t.tipo === "Mesa de Atendimento" ? checklistProgresso(t.checklistMesa, config) : null;
    const arq = t.arquivadoManualmente;

    return {
      id: t.id,
      ci: t.ci || "",
      tipo: t.tipo || "",
      atendimento: TIPO_ATENDIMENTO_LABEL[t.tipoAtendimento] || "",
      urgencia: t.urgencia || "",
      status: t.status || "",
      titulo: t.titulo || "",
      descricao: t.descricao || "",
      origemId: t.origem || "",
      origem: nomeUser(t.origem),
      destinatarioIds: dests,
      destinatarios: leituras.map((l) => l.nome).join(", "),
      qtdDestinatarios: dests.length,
      leituraDetalhe: leituras.map((l) => `${l.nome}: ${l.situacao}${l.cienteEm ? " em " + fmtDateHoraBR(l.cienteEm) : ""}`).join("\n"),
      leituraResumo: !dests.length ? "" : cientes === dests.length ? "Todos cientes" : `${cientes} de ${dests.length} ciente(s)`,
      todosCientes: !!dests.length && cientes === dests.length,
      leuTodos: !!dests.length && lidas === dests.length,
      pendentesCiencia: leituras.filter((l) => !l.cienteAtual).map((l) => l.nome).join(", "),
      emergencia: isTarefaEmergencia(t) ? "Sim" : "Não",
      sinalizadores: (t.flags || []).join(", "),
      atrasada: !concluida && t.proximaAcaoData && t.proximaAcaoData < hojeISO ? "Sim" : "Não",
      semInteracao2h: semInteracaoH != null && semInteracaoH > 2 ? "Sim" : "Não",
      tempoSemInteracao: duracaoTxt(semInteracaoH),
      proximaAcaoData: t.proximaAcaoData || "",
      processo: proc ? (campoEfetivo(overrides, proc, "numsin") || "#" + proc.nosnum) : t.processo ? "(processo fora do seu acesso)" : "",
      processoCliente: proc ? campoEfetivo(overrides, proc, "segurado") || "" : "",
      oficina: oficina(t.oficinaId),
      seguradora: seguradora(t.seguradoraId),
      cliente: cliente(t.clienteId),
      grupoProdutor: t.produtorGrupo || "",
      checklist: checklist && checklist.total ? `${checklist.feitos}/${checklist.total}` : "",
      solicitacao: t.tipo === "Mesa de Atendimento" ? (t.solicitacao ? "Preenchida" : "Não preenchida") : "",
      recorrencia: t.recorrencia && t.recorrencia.ativa ? resumoRecorrencia(t.recorrencia) : t.origemRecorrenciaId ? "Gerada por recorrência" : "",
      qtdComentarios: comments.length,
      ultimoComentario: ultComentario ? `${nomeUser(ultComentario.userId)} (${fmtDateHoraBR(ultComentario.at)}): ${ultComentario.text || ""}` : "",
      qtdAcoes: (t.log || []).length,
      createdAt: t.createdAt || "",
      updatedAt: t.updatedAt || t.createdAt || "",
      concludedAt: concluida ? t.concludedAt || "" : "",
      tempoConclusao: concluida && t.concludedAt ? duracaoTxt(horasEntre(t.createdAt, t.concludedAt)) : "",
      arquivada: isTarefaArquivada(t) ? (arq ? "Manual" : "Automática") : "Não",
      motivoArquivamento: arq ? `${arq.motivo || ""}${arq.userId ? ` — ${nomeUser(arq.userId)}` : ""}${arq.at ? ` em ${fmtDateHoraBR(arq.at)}` : ""}` : "",
      observacao: t.obs || "",
      anexo: t.anexo || "",
      _arquivada: isTarefaArquivada(t),
    };
  });
}

// Todas as colunas possíveis — `padrao: false` começa desmarcada na tela
// (o usuário liga se quiser). Excel e PDF usam as mesmas colunas marcadas.
export const COLUNAS_COMUNICACAO = [
  { key: "ci", label: "Protocolo", width: 12 },
  { key: "tipo", label: "Tipo", width: 16 },
  { key: "atendimento", label: "Atendimento", width: 18 },
  { key: "urgencia", label: "Urgência", width: 11 },
  { key: "status", label: "Status", width: 13 },
  { key: "titulo", label: "Título", width: 34, type: "wrap" },
  { key: "descricao", label: "Descrição", width: 50, type: "wrap" },
  { key: "origem", label: "Origem", width: 20 },
  { key: "destinatarios", label: "Destinatários", width: 28, type: "wrap" },
  { key: "qtdDestinatarios", label: "Qtd. destinatários", width: 10, type: "number", padrao: false },
  { key: "leituraResumo", label: "Confirmação de leitura", width: 18 },
  { key: "leituraDetalhe", label: "Leitura por destinatário", width: 44, type: "wrap" },
  { key: "pendentesCiencia", label: "Pendentes de ciência", width: 26, type: "wrap", padrao: false },
  { key: "emergencia", label: "Emergência", width: 11 },
  { key: "sinalizadores", label: "Sinalizadores", width: 22, type: "wrap" },
  { key: "atrasada", label: "Próx. ação vencida", width: 11 },
  { key: "semInteracao2h", label: "+2h sem interação", width: 11 },
  { key: "tempoSemInteracao", label: "Tempo sem interação", width: 13, padrao: false },
  { key: "proximaAcaoData", label: "Data próx. ação", width: 13, type: "date" },
  { key: "processo", label: "Processo", width: 18 },
  { key: "processoCliente", label: "Cliente do processo", width: 26, padrao: false },
  { key: "oficina", label: "Oficina", width: 22, padrao: false },
  { key: "seguradora", label: "Seguradora", width: 18, padrao: false },
  { key: "cliente", label: "Cliente vinculado", width: 24, padrao: false },
  { key: "grupoProdutor", label: "Grupo de produtores", width: 20, padrao: false },
  { key: "checklist", label: "Checklist (Mesa)", width: 11, padrao: false },
  { key: "solicitacao", label: "Solicitação (Mesa)", width: 14, padrao: false },
  { key: "recorrencia", label: "Recorrência", width: 26, type: "wrap", padrao: false },
  { key: "qtdComentarios", label: "Comentários", width: 11, type: "number" },
  { key: "ultimoComentario", label: "Último comentário", width: 44, type: "wrap", padrao: false },
  { key: "qtdAcoes", label: "Ações registradas", width: 10, type: "number", padrao: false },
  { key: "createdAt", label: "Criada em", width: 16, type: "datetime" },
  { key: "updatedAt", label: "Última ação em", width: 16, type: "datetime" },
  { key: "concludedAt", label: "Concluída em", width: 16, type: "datetime" },
  { key: "tempoConclusao", label: "Tempo até conclusão", width: 13 },
  { key: "arquivada", label: "Arquivada", width: 11, padrao: false },
  { key: "motivoArquivamento", label: "Motivo do arquivamento", width: 32, type: "wrap", padrao: false },
  { key: "observacao", label: "Observação", width: 32, type: "wrap", padrao: false },
  { key: "anexo", label: "Anexo", width: 28, type: "wrap", padrao: false },
];

export const FILTRO_COMUNICACAO_PADRAO = {
  criadaDe: "", criadaAte: "", status: "todas", tipo: "todos", urgencia: "todas", atendimento: "todos",
  origem: "todos", destinatario: "todos", leitura: "todas", emergencia: "todas", sinalizador: "todos",
  arquivadas: "incluir", q: "",
};

// `criadaDe/criadaAte` comparam a data LOCAL de criação (yyyy-mm-dd).
function dataLocal(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function filtrarLinhasComunicacao(linhas, f) {
  const q = (f.q || "").trim().toLowerCase();
  return linhas.filter((l) => {
    if (f.criadaDe || f.criadaAte) {
      const d = dataLocal(l.createdAt);
      if (!d) return false;
      if (f.criadaDe && d < f.criadaDe) return false;
      if (f.criadaAte && d > f.criadaAte) return false;
    }
    if (f.status === "em_aberto") { if (l.status === "Concluído") return false; }
    else if (f.status !== "todas" && l.status !== f.status) return false;
    if (f.tipo !== "todos" && l.tipo !== f.tipo) return false;
    if (f.urgencia !== "todas" && l.urgencia !== f.urgencia) return false;
    if (f.atendimento !== "todos" && l.atendimento !== f.atendimento) return false;
    if (f.origem !== "todos" && l.origemId !== f.origem) return false;
    if (f.destinatario !== "todos" && l.destinatarioIds.indexOf(f.destinatario) < 0) return false;
    if (f.leitura === "todos_cientes" && !l.todosCientes) return false;
    if (f.leitura === "pendente_ciencia" && l.todosCientes) return false;
    if (f.leitura === "nao_lida" && l.leuTodos) return false;
    if (f.emergencia !== "todas" && l.emergencia !== (f.emergencia === "sim" ? "Sim" : "Não")) return false;
    if (f.sinalizador !== "todos" && l.sinalizadores.split(", ").indexOf(f.sinalizador) < 0) return false;
    if (f.arquivadas === "excluir" && l._arquivada) return false;
    if (f.arquivadas === "somente" && !l._arquivada) return false;
    if (q && `${l.ci} ${l.titulo} ${l.descricao}`.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}

// Mais recentes primeiro.
export function ordenarLinhasComunicacao(linhas) {
  return [...linhas].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

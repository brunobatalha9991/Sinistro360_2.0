import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "../hooks/useAuth";
import { useHashRoute } from "../hooks/useHashRoute";
import { useTasksActions } from "../hooks/useTasksActions";
import { ProcSearch } from "./ProcSearch.jsx";
import { useStore } from "../hooks/useStore";
import { taskModalStore, closeTaskModal, takeDemandaPrefill, setPendingTaskLink } from "../state/taskModal";
import { visibleClaims } from "../logic/claims";
import { listaOficinas } from "../logic/oficinas";
import { listaSeguradoras } from "../logic/seguradoras";
import { listaClientes } from "../logic/clientes";
import { txt } from "../logic/format";
import { isAdmin, canEdit } from "../data/auth";
import { descreverAlteracoesTarefa } from "../logic/tasks";
import { getChecklistEfetivo, checklistProgresso, checklistVazio, sincronizarComFormulario } from "../logic/checklistMesaAtendimento";
import { getFormularioEfetivo, formularioDisponivel, caminhoPastaSolicitacao } from "../logic/solicitacaoAtendimento";
import { isDriveUploadConfigured, uploadArquivoDrive, CONTEXTO_MESA_ATENDIMENTO } from "../logic/driveUpload";

const ATENDIMENTO_OPCOES = [
  ["sinistro", "Sinistro"],
  ["assistencia_24h", "Assistência 24h"],
  ["assistencia_vidros", "Assistência de vidros e pequenos reparos"],
];

// Cor do chip-live de Grau de urgência/Status (mesmo padrão de chip
// colorido já usado no cabeçalho do processo — DetailHeader.jsx — e nos
// badges dos cards de Comunicação — Tarefas.jsx).
function urgenciaCor(u) {
  if (u === "Leve") return "green";
  if (u === "Moderado") return "orange";
  if (u === "Urgente") return "red";
  return "gray";
}
function statusCor(s) {
  if (s === "Concluído") return "green";
  if (s === "Em andamento") return "amber";
  return "blue";
}

// Linha de item de checklist — grid com coluna fixa pro checkbox e coluna
// flexível (com limite mínimo em 0) pro texto, que é o jeito confiável de
// garantir "checkbox + texto numa linha só, alinhado à esquerda" sem o
// texto sumir: com flexbox simples, o texto podia encolher pra largura 0
// dependendo do container; grid com minmax(0,1fr) não tem essa ambiguidade.
function ChecklistItemRow({ item, checked, onToggle }) {
  return (
    <label
      title={item.label}
      style={{
        display: "grid", gridTemplateColumns: "18px minmax(0,1fr)", columnGap: 8, alignItems: "center",
        padding: "6px 2px", cursor: "pointer", fontSize: 13, color: "var(--ink)", textAlign: "left",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <input type="checkbox" checked={!!checked} onChange={onToggle} style={{ margin: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", ...(checked ? { textDecoration: "line-through", opacity: .6 } : {}) }}>
        {item.label}
      </span>
    </label>
  );
}

// Campo de upload de anexo do formulário de Solicitação — envia pro Google
// Drive via Apps Script (logic/driveUpload.js), sem exigir login Google do
// usuário. Guarda no valor do campo uma lista de {nome, url, id}.
function CampoArquivo({ campo, valores, onChange, endpoint, uploadOk, pasta }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const arquivos = valores[campo.id] || [];

  async function handleFiles(fileList) {
    const lista = Array.from(fileList || []);
    if (!lista.length) return;
    setEnviando(true); setErro(null);
    try {
      const enviados = [];
      for (const file of lista) {
        enviados.push(await uploadArquivoDrive({ endpoint, file, pasta, contexto: CONTEXTO_MESA_ATENDIMENTO }));
      }
      onChange({ ...valores, [campo.id]: [...arquivos, ...enviados] });
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }
  function remover(idx) {
    const next = arquivos.slice(); next.splice(idx, 1);
    onChange({ ...valores, [campo.id]: next });
  }

  return (
    <div>
      {!uploadOk ? (
        <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>Configure o upload de anexos em Configurações para habilitar este campo.</p>
      ) : (
        <input type="file" multiple={campo.maxArquivos > 1} disabled={enviando} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      )}
      {enviando && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Enviando...</div>}
      {erro && <div style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 4 }}>{erro}</div>}
      {arquivos.map((a, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 4 }}>
          <a href={a.url} target="_blank" rel="noreferrer">{a.nome}</a>
          <a style={{ color: "var(--danger)", cursor: "pointer" }} onClick={() => remover(idx)}>✕</a>
        </div>
      ))}
      <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>Até {campo.maxArquivos} arquivo(s), {campo.maxTamanhoMb}MB cada.</div>
    </div>
  );
}

// Formulário de solicitação de atendimento — a pedido do usuário, espelha
// os Google Forms já usados pela operação (ver logic/solicitacaoAtendimento.js).
// Usado tanto por analistas/atendentes quanto por usuários "consulta" para
// registrar o pedido de atendimento antes da abertura do sinistro.
function SolicitacaoFields({ tipoAtendimento, valores, onChange, config, pastaDrive }) {
  const def = getFormularioEfetivo(tipoAtendimento, config);
  const v = valores || {};
  const uploadOk = isDriveUploadConfigured(config);
  const endpoint = config.corp_drive_upload_endpoint || "";
  function setCampo(id, valor) { onChange({ ...v, [id]: valor }); }

  if (!def) {
    return (
      <div style={{ marginTop: 10, border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--surface-2)" }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          O formulário de solicitação para este tipo de atendimento ainda não foi configurado no sistema.
        </p>
      </div>
    );
  }

  const secoes = [];
  def.campos.forEach((c) => { if (c.secao && secoes.indexOf(c.secao) < 0) secoes.push(c.secao); });

  return (
    <div style={{ marginTop: 10, border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "var(--surface-2)" }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{def.titulo}</div>
      {secoes.map((secao) => {
        if (def.secaoVisivel && !def.secaoVisivel(secao, v)) return null;
        return (
          <div key={secao}>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginTop: 12, marginBottom: 4 }}>{secao}</div>
            {def.campos.filter((c) => c.secao === secao).map((campo) => (
              <div className="field" key={campo.id} style={{ marginTop: 8 }}>
                <label>{campo.label}{campo.obrigatorio ? " *" : ""}</label>
                {campo.ajuda && <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{campo.ajuda}</div>}
                {campo.tipo === "select" ? (
                  <select value={v[campo.id] || ""} onChange={(e) => setCampo(campo.id, e.target.value)}>
                    <option value="">Selecione...</option>
                    {campo.opcoes.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                ) : campo.tipo === "textarea" ? (
                  <textarea rows={3} value={v[campo.id] || ""} onChange={(e) => setCampo(campo.id, e.target.value)} />
                ) : campo.tipo === "datahora" ? (
                  <input type="datetime-local" value={v[campo.id] || ""} onChange={(e) => setCampo(campo.id, e.target.value)} />
                ) : campo.tipo === "arquivo" ? (
                  <CampoArquivo campo={campo} valores={v} onChange={onChange} endpoint={endpoint} uploadOk={uploadOk} pasta={pastaDrive} />
                ) : (
                  <input value={v[campo.id] || ""} onChange={(e) => setCampo(campo.id, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Chat({ task, currentUser, actions, users }) {
  const [text, setText] = useState("");
  const boxRef = useRef(null);
  const msgs = task.comments || [];

  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [msgs.length]);

  function send() {
    const t = text.trim();
    if (!t) return;
    const next = { ...task, comments: [...msgs, { id: "cmt_" + Math.random().toString(36).slice(2, 9), userId: currentUser.id, text: t, at: new Date().toISOString() }] };
    actions.saveTask(next);
    actions.taskInteract(next, `${currentUser.nome} comentou: ${t.slice(0, 40)}`, currentUser.id);
    setText("");
  }

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <label style={{ marginBottom: 8, display: "block" }}>Comentários / histórico da conversa</label>
      <div className="chat-box" ref={boxRef}>
        {!msgs.length ? <div className="chat-empty">Nenhum comentário ainda. Inicie a conversa abaixo.</div> : msgs.map((m) => {
          const mine = m.userId === currentUser.id;
          const dt = new Date(m.at);
          const w = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
          const who = users.find((u) => u.id === m.userId) || { nome: "?" };
          return (
            <div key={m.id} className={"chat-msg " + (mine ? "mine" : "theirs")}>
              {!mine && <div className="cm-who">{who.nome}</div>}
              <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              <div className="cm-time">{w}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end" }}>
        <textarea rows={2} placeholder="Escreva um comentário..." style={{ flex: 1 }} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="btn" style={{ whiteSpace: "nowrap" }} onClick={send}>Enviar</button>
      </div>
    </div>
  );
}

// Auditoria interna da tarefa — a pedido do usuário, registra data/hora,
// usuário e ação de TUDO que acontece na tarefa (criação, edições campo a
// campo, comentários, arquivamento manual...) e só é visível pro admin.
// Alimentada por task.log (ver descreverAlteracoesTarefa em logic/tasks.js
// e taskInteract/arquivarManualmente em useTasksActions.js).
function TaskAuditPanel({ task, users }) {
  const entradas = (task.log || []).slice().reverse();
  function nomeUser(id) {
    if (!id) return "Sistema";
    const u = users.find((x) => x.id === id);
    return u ? u.nome : "—";
  }
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <label style={{ margin: 0 }}>Auditoria interna</label>
        <span className="tag-manual">Visível somente para admin</span>
      </div>
      {!entradas.length ? (
        <p className="muted" style={{ fontSize: 12 }}>Nenhum evento registrado ainda.</p>
      ) : (
        <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          <table style={{ width: "100%" }}>
            <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th></tr></thead>
            <tbody>
              {entradas.map((e, idx) => {
                const dt = new Date(e.at);
                const when = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
                return (
                  <tr key={idx}>
                    <td className="mono" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{when}</td>
                    <td style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{nomeUser(e.who)}</td>
                    <td style={{ fontSize: 11.5 }}>{e.acao}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Porte 1:1 de taskModal() do HTML original.
export function TaskModal() {
  const { open, taskId } = useStore(taskModalStore);
  const { records, config } = useData();
  const { currentUser } = useAuth();
  const { navigate } = useHashRoute();
  const actions = useTasksActions();

  const tasks = records.corp_tasks || [];
  const users = records.corp_users || [];
  const claims = visibleClaims(records.corp_claims);
  const taskTypes = (config.corp_task_types && config.corp_task_types.length ? config.corp_task_types : ["Comunicação", "Lembrete", "Tarefa", "Mesa de Atendimento"]);
  const editing = open && taskId ? tasks.find((t) => t.id === taskId) : null;
  const souOrigem = editing ? editing.origem === currentUser.id : true;

  const [tipo, setTipo] = useState(taskTypes[0]);
  const [urgencia, setUrgencia] = useState("Leve");
  const [status, setStatus] = useState("Pendente");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [destSel, setDestSel] = useState({});
  const [anexo, setAnexo] = useState("");
  const [obs, setObs] = useState("");
  const [processoId, setProcessoId] = useState("");
  const [oficinaId, setOficinaId] = useState("");
  const [seguradoraId, setSeguradoraId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [tipoAtendimento, setTipoAtendimento] = useState("");
  const [checklistMesa, setChecklistMesa] = useState(checklistVazio());
  const [solicitacao, setSolicitacao] = useState(null);
  const [solicitacaoAberta, setSolicitacaoAberta] = useState(false);
  const [checklistAberto, setChecklistAberto] = useState(false);
  const [pastaDriveId, setPastaDriveId] = useState("");
  const [comentarioConclusao, setComentarioConclusao] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo(editing.tipo); setUrgencia(editing.urgencia); setStatus(editing.status);
      setTitulo(editing.titulo || ""); setDescricao(editing.descricao || "");
      const sel = {}; (editing.destinatarios || []).forEach((id) => { sel[id] = true; });
      setDestSel(sel);
      setAnexo(editing.anexo || ""); setObs(editing.obs || ""); setProcessoId(editing.processo || "");
      setOficinaId(editing.oficinaId || ""); setSeguradoraId(editing.seguradoraId || ""); setClienteId(editing.clienteId || "");
      setTipoAtendimento(editing.tipoAtendimento || ""); setChecklistMesa(editing.checklistMesa || checklistVazio());
      setSolicitacao(editing.solicitacao || null); setSolicitacaoAberta(false); setChecklistAberto(false);
      setPastaDriveId(editing.id); setComentarioConclusao("");
    } else {
      setTipo(taskTypes[0]); setUrgencia("Leve"); setStatus("Pendente");
      setDestSel({});
      setAnexo(""); setObs(""); setProcessoId(""); setOficinaId(""); setSeguradoraId(""); setClienteId("");
      setTipoAtendimento(""); setChecklistMesa(checklistVazio());
      setSolicitacao(null); setSolicitacaoAberta(false); setChecklistAberto(false);
      setPastaDriveId("sol_" + Math.random().toString(36).slice(2, 9)); setComentarioConclusao("");
      const prefill = takeDemandaPrefill();
      setTitulo(prefill?.titulo || ""); setDescricao(prefill?.descricao || "");
      if (prefill?.processoId) setProcessoId(prefill.processoId);
      if (prefill?.oficinaId) setOficinaId(prefill.oficinaId);
      if (prefill?.seguradoraId) setSeguradoraId(prefill.seguradoraId);
      if (prefill?.clienteId) setClienteId(prefill.clienteId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  // Usuário "consulta" não escolhe destinatário pra Mesa de Atendimento —
  // ao selecionar esse tipo, marca sozinho todo mundo que não é consulta
  // (inclusive administradores). Continua livre pra desmarcar quem quiser
  // antes de criar/salvar.
  useEffect(() => {
    if (!open || !(currentUser && currentUser.role === "consulta") || tipo !== "Mesa de Atendimento") return;
    setDestSel((s) => {
      const next = { ...s };
      (records.corp_users || []).forEach((u) => { if (u.role !== "consulta") next[u.id] = true; });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipo, currentUser]);

  // Vínculo checklist ↔ formulário de Solicitação (Sinistro): assim que um
  // campo vinculado é preenchido pela primeira vez, o item correspondente é
  // marcado sozinho. Depois disso o controle é do usuário — a sincronização
  // nunca desmarca nem remarca um item que o usuário já decidiu (ver
  // sincronizarComFormulario, que só age uma vez por item).
  useEffect(() => {
    if (!open || tipo !== "Mesa de Atendimento" || tipoAtendimento !== "sinistro") return;
    setChecklistMesa((atual) => sincronizarComFormulario(atual, solicitacao, config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitacao, tipo, tipoAtendimento, open]);

  if (!open) return null;

  const procClaim = processoId ? claims.find((c) => c.id === processoId) : null;
  const oficinas = listaOficinas(claims, records.corp_overrides);
  const seguradorasLista = listaSeguradoras(claims, records.corp_overrides);
  const clientesLista = listaClientes(claims, records.corp_overrides);
  const isMesaAtendimento = tipo === "Mesa de Atendimento";
  // Checklist de abertura é ferramenta de quem atende o processo — usuário
  // "consulta" não vê o botão nem o checklist em si.
  const mostrarChecklist = isMesaAtendimento && tipoAtendimento === "sinistro" && canEdit(currentUser);
  const isEmergencia = isMesaAtendimento && tipoAtendimento === "assistencia_24h";
  const progresso = checklistProgresso(checklistMesa, config);
  const { segurado: checklistSegurado, terceiro: checklistTerceiro } = getChecklistEfetivo(config);
  const antigoStatus = editing ? editing.status : null;
  // Toda conclusão exige um comentário (vira feedback pra todos os
  // envolvidos) — só na TRANSIÇÃO para Concluído, não em toda gravação de
  // uma tarefa já concluída antes.
  const concluindoAgora = status === "Concluído" && antigoStatus !== "Concluído";

  function toggleChecklistItem(id) {
    setChecklistMesa((c) => ({ ...c, itens: { ...c.itens, [id]: !c.itens[id] } }));
  }

  // Retorna o id da tarefa salva (ou undefined se a validação falhar) — o
  // atalho "abrir novo atendimento" usa esse retorno pra saber a qual
  // tarefa vincular o processo criado em seguida no módulo Abertura.
  function salvar() {
    const t = souOrigem ? titulo.trim() : editing ? editing.titulo : "";
    if (!t) { alert("Informe o título."); return; }
    const dests = Object.keys(destSel).filter((k) => destSel[k]);
    if (!dests.length) { alert("Selecione ao menos um destinatário."); return; }
    if (concluindoAgora && !comentarioConclusao.trim()) {
      alert("Escreva um comentário de conclusão — ele vira o feedback da tarefa para todos os envolvidos.");
      return;
    }
    const novoComentario = concluindoAgora
      ? { id: "cmt_" + Math.random().toString(36).slice(2, 9), userId: currentUser.id, text: comentarioConclusao.trim(), at: new Date().toISOString() }
      : null;

    let idSalvo;
    if (editing) {
      const atual = {
        ...editing, tipo, urgencia, status, anexo, obs, processo: processoId, oficinaId, seguradoraId, clienteId, destinatarios: dests, tipoAtendimento,
        ...(tipo === "Mesa de Atendimento" ? { checklistMesa, solicitacao } : {}),
        ...(souOrigem ? { titulo: t, descricao } : {}),
        ...(concluindoAgora ? { concludedAt: new Date().toISOString(), comments: [...(editing.comments || []), novoComentario] } : {}),
      };
      actions.saveTask(atual);
      // Auditoria granular: uma linha por campo alterado, não uma frase
      // genérica — é isso que fica visível pro admin em TaskAuditPanel.
      const mudancas = descreverAlteracoesTarefa(editing, atual, { users, claims });
      if (concluindoAgora) mudancas.push(`Comentário de conclusão: "${comentarioConclusao.trim().slice(0, 200)}"`);
      if (!mudancas.length) mudancas.push("Tarefa revisada (sem alterações de campo)");
      const notifTexto = concluindoAgora
        ? `Tarefa concluída por ${currentUser.nome}: "${comentarioConclusao.trim().slice(0, 80)}"`
        : `Tarefa atualizada por ${currentUser.nome}` + (mudancas.length > 1 ? ` (${mudancas.length} alterações)` : "");
      actions.taskInteract(atual, mudancas, currentUser.id, isEmergencia, notifTexto);
      idSalvo = atual.id;
    } else {
      const agora = new Date().toISOString();
      const novo = {
        id: "tsk_" + Math.random().toString(36).slice(2, 9), tipo, titulo: t, origem: currentUser.id, destinatarios: dests,
        descricao, anexo, obs, status, urgencia, processo: processoId, oficinaId, seguradoraId, clienteId, tipoAtendimento,
        ...(tipo === "Mesa de Atendimento" ? { checklistMesa, solicitacao } : {}),
        ...(concluindoAgora ? { concludedAt: new Date().toISOString() } : {}),
        createdAt: agora, updatedAt: agora,
        log: [{ at: agora, who: currentUser.id, acao: `Tarefa criada por ${currentUser.nome}` }],
        comments: novoComentario ? [novoComentario] : [],
      };
      actions.createTask(novo);
      const textoNotif = (isEmergencia ? "EMERGÊNCIA — " : "") + `Nova tarefa de ${currentUser.nome}: ${t}`;
      actions.pushNotif(novo.id, novo.destinatarios, textoNotif, currentUser.id, isEmergencia, true);
      idSalvo = novo.id;
    }
    closeTaskModal();
    return idSalvo;
  }

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}
    >
      <div style={{ width: 640, maxWidth: "100%", background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{editing ? "Tarefa" : "Nova tarefa"}</h3>
          <button className="btn sec xs" onClick={closeTaskModal}>✕ Fechar</button>
        </div>

        <div className="grid c2">
          <div className="field"><label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>{taskTypes.map((tp) => <option key={tp} value={tp}>{tp}</option>)}</select>
          </div>
          <div className="field"><label>Grau de urgência</label>
            <span className={"badge chip-live " + urgenciaCor(urgencia)}>
              <select className="inline" value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>{["Leve", "Moderado", "Urgente"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </span>
          </div>
        </div>

        {isMesaAtendimento && canEdit(currentUser) && (
          <div style={{ marginBottom: 14 }}>
            <button
              type="button" className="btn sm"
              onClick={() => {
                const id = salvar();
                if (!id) return;
                setPendingTaskLink(id);
                navigate("abertura");
              }}
            >
              Abertura
            </button>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Salva esta tarefa e, ao criar o processo em Abertura, vincula automaticamente os dois.</div>
          </div>
        )}

        {isMesaAtendimento && (
          <div className="field">
            <label>Atendimento</label>
            <div className="chips">
              {ATENDIMENTO_OPCOES.map(([k, label]) => (
                <div key={k} className={"chip-btn" + (tipoAtendimento === k ? " active" : "")} onClick={() => setTipoAtendimento(tipoAtendimento === k ? "" : k)}>{label}</div>
              ))}
            </div>
            {isEmergencia && (
              <div className="neon-alert" style={{ "--neon-rgb": "var(--danger-rgb)", marginTop: 8, background: "rgba(var(--danger-rgb),.1)", border: "1px solid rgba(var(--danger-rgb),.4)", borderRadius: 8, padding: "8px 12px", fontWeight: 700, fontSize: 13, color: "var(--danger)" }}>
                Emergência — Assistência 24h. Esta tarefa aparece no topo da lista de Comunicação e gera notificação de urgência.
              </div>
            )}
            {tipoAtendimento && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <button type="button" className="btn sec sm" onClick={() => setSolicitacaoAberta((v) => !v)}>
                  Solicitação {solicitacao ? "(preenchida)" : ""}
                </button>
                {!formularioDisponivel(tipoAtendimento, config) && <span className="muted" style={{ fontSize: 11.5 }}>Formulário deste atendimento ainda não configurado.</span>}
              </div>
            )}
          </div>
        )}

        {isMesaAtendimento && tipoAtendimento && solicitacaoAberta && (
          <SolicitacaoFields tipoAtendimento={tipoAtendimento} valores={solicitacao} onChange={setSolicitacao} config={config} pastaDrive={caminhoPastaSolicitacao(tipoAtendimento, solicitacao, pastaDriveId)} />
        )}

        <div className="field"><label>Título</label>
          {souOrigem
            ? <input placeholder="Título da tarefa" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            : <div style={{ padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", fontWeight: 600 }}>{editing?.titulo || "—"}</div>}
        </div>

        <div className="grid c2">
          <div className="field"><label>Usuário origem</label><input value={(editing ? users.find((u) => u.id === editing.origem)?.nome : currentUser.nome) || ""} disabled /></div>
          <div className="field"><label>Status</label>
            <span className={"badge chip-live " + statusCor(status)}>
              <select className="inline" value={status} onChange={(e) => setStatus(e.target.value)}>{["Pendente", "Em andamento", "Concluído"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </span>
          </div>
        </div>

        {concluindoAgora && (
          <div className="field" style={{ background: "rgba(var(--ok-rgb),.08)", border: "1px solid rgba(var(--ok-rgb),.32)", borderRadius: 8, padding: 12 }}>
            <label style={{ color: "var(--ok)" }}>Comentário de conclusão (obrigatório)</label>
            <textarea rows={3} placeholder="O que foi feito / resultado final — vira o feedback desta tarefa para todos os envolvidos." value={comentarioConclusao} onChange={(e) => setComentarioConclusao(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label>Destinatário(s) — pode selecionar vários</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {users.map((u) => (
              <label key={u.id} className={"chip-btn" + (destSel[u.id] ? " active" : "")} style={{ cursor: "pointer" }}
                onClick={() => setDestSel((s) => ({ ...s, [u.id]: !s[u.id] }))}
              >{u.nome}</label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Descrição</label>
          {souOrigem
            ? <textarea rows={3} placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            : <div style={{ padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", whiteSpace: "pre-wrap", minHeight: 44 }}>{editing?.descricao || "—"}</div>}
          {!souOrigem && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>🔒 Apenas o autor da tarefa pode alterar título e descrição.</div>}
        </div>

        <div className="grid c2">
          <div className="field"><label>Anexo</label><input placeholder="Link/nome do anexo (opcional)" value={anexo} onChange={(e) => setAnexo(e.target.value)} /></div>
          <div className="field"><label>Observação</label><input placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>

        <div className="field">
          <label>Vincular a processo existente</label>
          <ProcSearch value={{ label: procClaim ? (procClaim.numsin || "#" + procClaim.nosnum) + " — " + txt(procClaim.segurado) : "" }} onChange={setProcessoId} claims={claims} />
        </div>

        <div className="grid c3">
          <div className="field">
            <label>Vincular a oficina (opcional)</label>
            <select value={oficinaId} onChange={(e) => setOficinaId(e.target.value)}>
              <option value="">— Nenhuma —</option>
              {oficinas.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Vincular a seguradora (opcional)</label>
            <select value={seguradoraId} onChange={(e) => setSeguradoraId(e.target.value)}>
              <option value="">— Nenhuma —</option>
              {seguradorasLista.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Vincular a cliente (opcional)</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">— Nenhum —</option>
              {clientesLista.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        {mostrarChecklist && (
          <div className="field">
            <label>Checklist de abertura de sinistro</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" className="btn sec sm" onClick={() => setChecklistAberto((v) => !v)}>
                {checklistAberto ? "Ocultar checklist" : "Abrir checklist"}
              </button>
              <span className={"badge " + (progresso.total && progresso.feitos === progresso.total ? "green" : "amber")}>{progresso.feitos}/{progresso.total}</span>
            </div>
          </div>
        )}

        {mostrarChecklist && checklistAberto && (
          <div style={{ marginTop: 4, marginBottom: 14, border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "var(--surface-2)" }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 10 }}>Marque cada item conforme for coletado — não é um formulário, só o acompanhamento do que falta.</div>

            <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 2 }}>Segurado</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {checklistSegurado.map((item) => (
                <ChecklistItemRow key={item.id} item={item} checked={checklistMesa.itens[item.id]} onToggle={() => toggleChecklistItem(item.id)} />
              ))}
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", marginTop: 12, borderRadius: 8, background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer" }}>
              <input type="checkbox" checked={checklistMesa.temTerceiro} onChange={() => setChecklistMesa((c) => ({ ...c, temTerceiro: !c.temTerceiro }))} />
              <b style={{ fontSize: 13 }}>Houve terceiro envolvido?</b>
            </label>

            {checklistMesa.temTerceiro && (
              <>
                <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", margin: "12px 0 2px" }}>Terceiro</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {checklistTerceiro.map((item) => (
                    <ChecklistItemRow key={item.id} item={item} checked={checklistMesa.itens[item.id]} onToggle={() => toggleChecklistItem(item.id)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button className="btn" onClick={salvar}>{editing ? "Salvar alterações" : "Criar tarefa"}</button>
        </div>

        {editing && <Chat task={editing} currentUser={currentUser} actions={actions} users={users} />}
        {editing && isAdmin(currentUser) && <TaskAuditPanel task={editing} users={users} />}
      </div>
    </div>,
    document.body
  );
}

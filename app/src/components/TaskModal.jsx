import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "../hooks/useAuth";
import { useHashRoute } from "../hooks/useHashRoute";
import { useTasksActions } from "../hooks/useTasksActions";
import { useStore } from "../hooks/useStore";
import { taskModalStore, closeTaskModal, takeDemandaPrefill } from "../state/taskModal";
import { visibleClaims } from "../logic/claims";
import { txt } from "../logic/format";
import { CHECKLIST_SEGURADO, CHECKLIST_TERCEIRO, checklistProgresso, checklistVazio } from "../logic/checklistMesaAtendimento";
import { FORMULARIOS_SOLICITACAO, formularioDisponivel, caminhoPastaSolicitacao } from "../logic/solicitacaoAtendimento";
import { isDriveUploadConfigured, uploadArquivoDrive, CONTEXTO_MESA_ATENDIMENTO } from "../logic/driveUpload";

const ATENDIMENTO_OPCOES = [
  ["sinistro", "🚗 Sinistro"],
  ["assistencia_24h", "🛟 Assistência 24h"],
  ["assistencia_vidros", "🪟 Assistência de vidros e pequenos reparos"],
];

function ProcSearch({ value, onChange, claims }) {
  const [q, setQ] = useState(value.label || "");
  const [open, setOpen] = useState(false);
  const results = q.trim().length >= 2
    ? claims.filter((c) => [c.segurado, c.numsin, c.placa, c.nosnum].join(" ").toLowerCase().indexOf(q.toLowerCase().trim()) >= 0).slice(0, 25)
    : [];

  function pick(c) {
    onChange(c ? c.id : "");
    setQ(c ? (c.numsin || "#" + c.nosnum) + " — " + txt(c.segurado) + (c.placa ? ` (${c.placa})` : "") : "");
    setOpen(false);
  }

  return (
    <div>
      <input
        placeholder="Buscar por nome, nº sinistro ou placa..." value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginTop: 4, maxHeight: 200, overflow: "auto", background: "var(--card)" }}>
          <div style={{ padding: "8px 10px", cursor: "pointer", color: "var(--muted)", borderBottom: "1px solid var(--border-soft)" }} onMouseDown={(e) => { e.preventDefault(); pick(null); }}>
            — Nenhum (sem vínculo) —
          </div>
          {q.trim().length >= 2 && !results.length && <div style={{ padding: "8px 10px", color: "var(--muted)" }}>Nenhum processo encontrado.</div>}
          {results.map((c) => (
            <div key={c.id} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid var(--border-soft)" }} onMouseDown={(e) => { e.preventDefault(); pick(c); }}>
              <span className="mono" style={{ fontWeight: 600 }}>{c.numsin || "#" + c.nosnum}</span>
              <span> — {txt(c.segurado)}{c.placa ? ` • ${c.placa}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
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
          <a href={a.url} target="_blank" rel="noreferrer">📎 {a.nome} ↗</a>
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
  const def = FORMULARIOS_SOLICITACAO[tipoAtendimento];
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

// Porte 1:1 de taskModal() do HTML original.
export function TaskModal() {
  const { open, taskId } = useStore(taskModalStore);
  const { records, config } = useData();
  const { currentUser } = useAuth();
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
  const [tipoAtendimento, setTipoAtendimento] = useState("");
  const [checklistMesa, setChecklistMesa] = useState(checklistVazio());
  const [solicitacao, setSolicitacao] = useState(null);
  const [solicitacaoAberta, setSolicitacaoAberta] = useState(false);
  const [pastaDriveId, setPastaDriveId] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo(editing.tipo); setUrgencia(editing.urgencia); setStatus(editing.status);
      setTitulo(editing.titulo || ""); setDescricao(editing.descricao || "");
      const sel = {}; (editing.destinatarios || []).forEach((id) => { sel[id] = true; });
      setDestSel(sel);
      setAnexo(editing.anexo || ""); setObs(editing.obs || ""); setProcessoId(editing.processo || "");
      setTipoAtendimento(editing.tipoAtendimento || ""); setChecklistMesa(editing.checklistMesa || checklistVazio());
      setSolicitacao(editing.solicitacao || null); setSolicitacaoAberta(false);
      setPastaDriveId(editing.id);
    } else {
      setTipo(taskTypes[0]); setUrgencia("Leve"); setStatus("Pendente");
      setDestSel({}); setAnexo(""); setObs(""); setProcessoId("");
      setTipoAtendimento(""); setChecklistMesa(checklistVazio());
      setSolicitacao(null); setSolicitacaoAberta(false);
      setPastaDriveId("sol_" + Math.random().toString(36).slice(2, 9));
      const prefill = takeDemandaPrefill();
      setTitulo(prefill?.titulo || ""); setDescricao(prefill?.descricao || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  if (!open) return null;

  const procClaim = processoId ? claims.find((c) => c.id === processoId) : null;
  const isMesaAtendimento = tipo === "Mesa de Atendimento";
  const progresso = checklistProgresso(checklistMesa);

  function toggleChecklistItem(id) {
    setChecklistMesa((c) => ({ ...c, itens: { ...c.itens, [id]: !c.itens[id] } }));
  }

  function salvar() {
    const t = souOrigem ? titulo.trim() : editing ? editing.titulo : "";
    if (!t) { alert("Informe o título."); return; }
    const dests = Object.keys(destSel).filter((k) => destSel[k]);
    if (!dests.length) { alert("Selecione ao menos um destinatário."); return; }

    if (editing) {
      const antigoStatus = editing.status;
      const atual = {
        ...editing, tipo, urgencia, status, anexo, obs, processo: processoId, destinatarios: dests, tipoAtendimento,
        ...(tipo === "Mesa de Atendimento" ? { checklistMesa, solicitacao } : {}),
        ...(souOrigem ? { titulo: t, descricao } : {}),
        ...(status === "Concluído" && antigoStatus !== "Concluído" ? { concludedAt: new Date().toISOString() } : {}),
      };
      actions.saveTask(atual);
      actions.taskInteract(atual, `Tarefa atualizada por ${currentUser.nome}`, currentUser.id);
    } else {
      const novo = {
        id: "tsk_" + Math.random().toString(36).slice(2, 9), tipo, titulo: t, origem: currentUser.id, destinatarios: dests,
        descricao, anexo, obs, status, urgencia, processo: processoId, tipoAtendimento,
        ...(tipo === "Mesa de Atendimento" ? { checklistMesa, solicitacao } : {}),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), log: [], comments: [],
      };
      actions.createTask(novo);
      actions.pushNotif(novo.id, novo.destinatarios, `Nova tarefa de ${currentUser.nome}: ${t}`, currentUser.id);
    }
    closeTaskModal();
  }

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) closeTaskModal(); }}
    >
      <div style={{ width: 640, maxWidth: "100%", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{editing ? "Tarefa" : "Nova tarefa"}</h3>
          <button className="btn sec xs" onClick={closeTaskModal}>✕ Fechar</button>
        </div>

        <div className="grid c2">
          <div className="field"><label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>{taskTypes.map((tp) => <option key={tp} value={tp}>{tp}</option>)}</select>
          </div>
          <div className="field"><label>Grau de urgência</label>
            <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>{["Leve", "Moderado", "Urgente"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </div>
        </div>

        <div className="field">
          <label>Atendimento</label>
          <div className="chips">
            {ATENDIMENTO_OPCOES.map(([k, label]) => (
              <div key={k} className={"chip-btn" + (tipoAtendimento === k ? " active" : "")} onClick={() => setTipoAtendimento(tipoAtendimento === k ? "" : k)}>{label}</div>
            ))}
          </div>
          {isMesaAtendimento && tipoAtendimento && (
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" className="btn sec sm" onClick={() => setSolicitacaoAberta((v) => !v)}>
                📋 Solicitação {solicitacao ? "(preenchida)" : ""}
              </button>
              {!formularioDisponivel(tipoAtendimento) && <span className="muted" style={{ fontSize: 11.5 }}>Formulário deste atendimento ainda não configurado.</span>}
            </div>
          )}
        </div>

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
            <select value={status} onChange={(e) => setStatus(e.target.value)}>{["Pendente", "Em andamento", "Concluído"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </div>
        </div>

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

        {isMesaAtendimento && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ marginBottom: 0 }}>Checklist de abertura de sinistro</label>
              <span className={"badge " + (progresso.total && progresso.feitos === progresso.total ? "green" : "amber")}>{progresso.feitos}/{progresso.total}</span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Marque cada item conforme for coletado — não é um formulário, só o acompanhamento do que falta.</div>

            <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Segurado</div>
            {CHECKLIST_SEGURADO.map((item) => (
              <label key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0", cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={!!checklistMesa.itens[item.id]} onChange={() => toggleChecklistItem(item.id)} />
                <span style={checklistMesa.itens[item.id] ? { textDecoration: "line-through", opacity: .6 } : undefined}>{item.label}</span>
              </label>
            ))}

            <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", marginTop: 6, borderTop: "1px dashed var(--line)", cursor: "pointer" }}>
              <input type="checkbox" checked={checklistMesa.temTerceiro} onChange={() => setChecklistMesa((c) => ({ ...c, temTerceiro: !c.temTerceiro }))} />
              <b style={{ fontSize: 13 }}>Houve terceiro envolvido?</b>
            </label>

            {checklistMesa.temTerceiro && (
              <>
                <div className="muted" style={{ fontSize: 12, fontWeight: 700, margin: "6px 0 4px" }}>Terceiro</div>
                {CHECKLIST_TERCEIRO.map((item) => (
                  <label key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0", cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={!!checklistMesa.itens[item.id]} onChange={() => toggleChecklistItem(item.id)} />
                    <span style={checklistMesa.itens[item.id] ? { textDecoration: "line-through", opacity: .6 } : undefined}>{item.label}</span>
                  </label>
                ))}
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button className="btn" onClick={salvar}>{editing ? "Salvar alterações" : "Criar tarefa"}</button>
        </div>

        {editing && <Chat task={editing} currentUser={currentUser} actions={actions} users={users} />}
      </div>
    </div>,
    document.body
  );
}

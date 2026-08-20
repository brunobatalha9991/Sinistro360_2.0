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
  const taskTypes = (config.corp_task_types && config.corp_task_types.length ? config.corp_task_types : ["Comunicação", "Lembrete", "Tarefa"]);
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

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo(editing.tipo); setUrgencia(editing.urgencia); setStatus(editing.status);
      setTitulo(editing.titulo || ""); setDescricao(editing.descricao || "");
      const sel = {}; (editing.destinatarios || []).forEach((id) => { sel[id] = true; });
      setDestSel(sel);
      setAnexo(editing.anexo || ""); setObs(editing.obs || ""); setProcessoId(editing.processo || "");
    } else {
      setTipo(taskTypes[0]); setUrgencia("Leve"); setStatus("Pendente");
      setDestSel({}); setAnexo(""); setObs(""); setProcessoId("");
      const prefill = takeDemandaPrefill();
      setTitulo(prefill?.titulo || ""); setDescricao(prefill?.descricao || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  if (!open) return null;

  const procClaim = processoId ? claims.find((c) => c.id === processoId) : null;

  function salvar() {
    const t = souOrigem ? titulo.trim() : editing ? editing.titulo : "";
    if (!t) { alert("Informe o título."); return; }
    const dests = Object.keys(destSel).filter((k) => destSel[k]);
    if (!dests.length) { alert("Selecione ao menos um destinatário."); return; }

    if (editing) {
      const antigoStatus = editing.status;
      const atual = {
        ...editing, tipo, urgencia, status, anexo, obs, processo: processoId, destinatarios: dests,
        ...(souOrigem ? { titulo: t, descricao } : {}),
        ...(status === "Concluído" && antigoStatus !== "Concluído" ? { concludedAt: new Date().toISOString() } : {}),
      };
      actions.saveTask(atual);
      actions.taskInteract(atual, `Tarefa atualizada por ${currentUser.nome}`, currentUser.id);
    } else {
      const novo = {
        id: "tsk_" + Math.random().toString(36).slice(2, 9), tipo, titulo: t, origem: currentUser.id, destinatarios: dests,
        descricao, anexo, obs, status, urgencia, processo: processoId,
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

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button className="btn" onClick={salvar}>{editing ? "Salvar alterações" : "Criar tarefa"}</button>
        </div>

        {editing && <Chat task={editing} currentUser={currentUser} actions={actions} users={users} />}
      </div>
    </div>,
    document.body
  );
}

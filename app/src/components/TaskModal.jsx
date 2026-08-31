import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "../hooks/useAuth";
import { useHashRoute } from "../hooks/useHashRoute";
import { useTasksActions } from "../hooks/useTasksActions";
import { ProcSearch } from "./ProcSearch.jsx";
import { useStore } from "../hooks/useStore";
import { taskModalStore, closeTaskModal, takeDemandaPrefill, setPendingTaskLink } from "../state/taskModal";
import { visibleClaims, campoEfetivo, produtorOuAgenteEfetivo, distinctGruposOuAgentes } from "../logic/claims";
import { listaOficinas, oficinaIdFromNome } from "../logic/oficinas";
import { listaSeguradoras, seguradoraIdFromNome } from "../logic/seguradoras";
import { txt, todayISO } from "../logic/format";
import { isAdmin, canEdit } from "../data/auth";
import { descreverAlteracoesTarefa, TASK_FLAGS_DEFAULT, proximoCI, RECORRENCIA_UNIDADES, resumoRecorrencia } from "../logic/tasks";
import { getChecklistEfetivo, checklistProgresso, checklistVazio, sincronizarComFormulario } from "../logic/checklistMesaAtendimento";
import { getFormularioEfetivo, formularioDisponivel, caminhoPastaSolicitacao, secaoRepetivel } from "../logic/solicitacaoAtendimento";
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

// Um campo do formulário de Solicitação — extraído pra ser reaproveitado
// tanto nos campos "fixos" da seção quanto em cada terceiro extra (ver
// SolicitacaoFields abaixo). `onChange` recebe sempre o objeto `valores`
// inteiro já com este campo atualizado (mesmo contrato de CampoArquivo).
function CampoInput({ campo, valores, onChange, endpoint, uploadOk, pasta }) {
  const v = valores || {};
  function set(valor) { onChange({ ...v, [campo.id]: valor }); }
  return (
    <div className="field" style={{ marginTop: 8 }}>
      <label>{campo.label}{campo.obrigatorio ? " *" : ""}</label>
      {campo.ajuda && <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{campo.ajuda}</div>}
      {campo.tipo === "select" ? (
        <select value={v[campo.id] || ""} onChange={(e) => set(e.target.value)}>
          <option value="">Selecione...</option>
          {campo.opcoes.map((op) => <option key={op} value={op}>{op}</option>)}
        </select>
      ) : campo.tipo === "textarea" ? (
        <textarea rows={3} value={v[campo.id] || ""} onChange={(e) => set(e.target.value)} />
      ) : campo.tipo === "datahora" ? (
        <input type="datetime-local" value={v[campo.id] || ""} onChange={(e) => set(e.target.value)} />
      ) : campo.tipo === "arquivo" ? (
        <CampoArquivo campo={campo} valores={v} onChange={onChange} endpoint={endpoint} uploadOk={uploadOk} pasta={pasta} />
      ) : (
        <input value={v[campo.id] || ""} onChange={(e) => set(e.target.value)} />
      )}
    </div>
  );
}

// Formulário de solicitação de atendimento — a pedido do usuário, espelha
// os Google Forms já usados pela operação (ver logic/solicitacaoAtendimento.js).
// Usado tanto por analistas/atendentes quanto por usuários "consulta" para
// registrar o pedido de atendimento antes da abertura do sinistro.
// "Dados do Terceiro" (Sinistro) pode se repetir (a pedido do usuário — um
// sinistro pode ter mais de um terceiro): o primeiro continua nos campos
// de sempre (retrocompatível com solicitações já salvas); terceiros
// extras entram em valores.terceirosExtra[], cada um com o mesmo conjunto
// de campos da seção (ver secaoRepetivel em logic/solicitacaoAtendimento.js).
function SolicitacaoFields({ tipoAtendimento, valores, onChange, config, pastaDrive }) {
  const def = getFormularioEfetivo(tipoAtendimento, config);
  const v = valores || {};
  const uploadOk = isDriveUploadConfigured(config);
  const endpoint = config.corp_drive_upload_endpoint || "";

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

  function adicionarTerceiro() { onChange({ ...v, terceirosExtra: [...(v.terceirosExtra || []), {}] }); }
  function removerTerceiro(idx) { onChange({ ...v, terceirosExtra: (v.terceirosExtra || []).filter((_, i) => i !== idx) }); }
  function setTerceiroExtra(idx, novaEntrada) {
    const lista = (v.terceirosExtra || []).slice();
    lista[idx] = novaEntrada;
    onChange({ ...v, terceirosExtra: lista });
  }

  return (
    <div style={{ marginTop: 10, border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "var(--surface-2)" }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{def.titulo}</div>
      {secoes.map((secao) => {
        if (def.secaoVisivel && !def.secaoVisivel(secao, v)) return null;
        const camposSecao = def.campos.filter((c) => c.secao === secao);
        const repetivel = secaoRepetivel(tipoAtendimento, secao);
        return (
          <div key={secao}>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginTop: 12, marginBottom: 4 }}>{secao}</div>
            {camposSecao.map((campo) => (
              <CampoInput key={campo.id} campo={campo} valores={v} onChange={onChange} endpoint={endpoint} uploadOk={uploadOk} pasta={pastaDrive} />
            ))}
            {repetivel && (v.terceirosExtra || []).map((entrada, idx) => (
              <div key={idx} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{ fontSize: 12 }}>Terceiro #{idx + 2}</b>
                  <a style={{ cursor: "pointer", fontSize: 12, color: "var(--danger)" }} onClick={() => removerTerceiro(idx)}>remover este terceiro</a>
                </div>
                {camposSecao.map((campo) => (
                  <CampoInput
                    key={campo.id} campo={campo} valores={entrada}
                    onChange={(novaEntrada) => setTerceiroExtra(idx, novaEntrada)}
                    endpoint={endpoint} uploadOk={uploadOk} pasta={pastaDrive}
                  />
                ))}
              </div>
            ))}
            {repetivel && (
              <button type="button" className="btn sec xs" style={{ marginTop: 10 }} onClick={adicionarTerceiro}>+ Adicionar outro terceiro</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Painel de recorrência personalizada (a pedido do usuário) — "a cada N
// dia(s)/semana(s)/mês(es)", com término opcional por data ou por
// quantidade de ocorrências. `recorrencia` é null quando desativada;
// ativar cria o objeto com valores padrão (repete todo dia, sem fim).
function RecorrenciaFields({ recorrencia, onChange }) {
  const ativa = !!recorrencia;
  const r = recorrencia || { intervalo: 1, unidade: "dias", fim: { tipo: "nunca" } };
  function set(patch) { onChange({ ...r, ativa: true, ocorrenciasGeradas: r.ocorrenciasGeradas || 0, ...patch }); }

  return (
    <div style={{ marginTop: 10, border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "var(--surface-2)" }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
        <input
          type="checkbox" checked={ativa}
          onChange={(e) => onChange(e.target.checked ? { intervalo: 1, unidade: "dias", fim: { tipo: "nunca" }, ativa: true, ocorrenciasGeradas: 0 } : null)}
        />
        <b style={{ fontSize: 13 }}>Repetir esta tarefa</b>
      </label>

      {ativa && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13 }}>Repetir a cada</span>
            <input
              type="number" min={1} style={{ width: 64 }} value={r.intervalo}
              onChange={(e) => set({ intervalo: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            />
            <select value={r.unidade} onChange={(e) => set({ unidade: e.target.value })}>
              {RECORRENCIA_UNIDADES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Terminar</div>
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <input type="radio" checked={r.fim?.tipo === "nunca"} onChange={() => set({ fim: { tipo: "nunca" } })} /> Nunca
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <input
                type="radio" checked={r.fim?.tipo === "data"}
                onChange={() => set({ fim: { tipo: "data", data: r.fim?.data || new Date().toISOString().slice(0, 10) } })}
              /> Em
              {r.fim?.tipo === "data" && (
                <input
                  type="date" value={r.fim.data} style={{ marginLeft: 4 }}
                  onChange={(e) => set({ fim: { tipo: "data", data: e.target.value } })}
                />
              )}
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="radio" checked={r.fim?.tipo === "vezes"}
                onChange={() => set({ fim: { tipo: "vezes", vezes: r.fim?.vezes || 5 } })}
              /> Após
              {r.fim?.tipo === "vezes" && (
                <input
                  type="number" min={1} style={{ width: 56, marginLeft: 4 }} value={r.fim.vezes}
                  onChange={(e) => set({ fim: { tipo: "vezes", vezes: Math.max(1, parseInt(e.target.value, 10) || 1) } })}
                />
              )}
              {" "}ocorrência(s)
            </label>
          </div>

          <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
            Cada ocorrência vencida vira uma nova tarefa (mesmo tipo, destinatários e vínculos desta), gerada automaticamente ao abrir a Comunicação.
          </div>
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
  const claims = visibleClaims(records.corp_claims, records.corp_overrides, currentUser);
  const taskTypes = (config.corp_task_types && config.corp_task_types.length ? config.corp_task_types : ["Comunicação", "Lembrete", "Tarefa", "Mesa de Atendimento"]);
  const editing = open && taskId ? tasks.find((t) => t.id === taskId) : null;

  const [tipo, setTipo] = useState(taskTypes[0]);
  const [urgencia, setUrgencia] = useState("Leve");
  const [status, setStatus] = useState("Pendente");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [destSel, setDestSel] = useState({});
  const [flagSel, setFlagSel] = useState({});
  const [anexo, setAnexo] = useState("");
  const [obs, setObs] = useState("");
  const [processoId, setProcessoId] = useState("");
  const [oficinaId, setOficinaId] = useState("");
  const [seguradoraId, setSeguradoraId] = useState("");
  const [produtorGrupo, setProdutorGrupo] = useState("");
  // clienteId não tem mais seletor visível aqui (substituído por "V. Grupo
  // do Produtor ou agente" acima, a pedido do usuário) — segue existindo só
  // como vínculo interno pra quando a tarefa é criada a partir da própria
  // página do Cliente ("+ Criar tarefa vinculada a este cliente", ver
  // TarefasClientePanel.jsx), que ainda usa esse campo pra listar as
  // tarefas do cliente.
  const [clienteId, setClienteId] = useState("");
  const [recorrencia, setRecorrencia] = useState(null);
  const [recorrenciaAberta, setRecorrenciaAberta] = useState(false);
  const [proximaAcaoData, setProximaAcaoData] = useState(todayISO());
  const [tipoAtendimento, setTipoAtendimento] = useState("");
  const [checklistMesa, setChecklistMesa] = useState(checklistVazio());
  const [solicitacao, setSolicitacao] = useState(null);
  const [solicitacaoAberta, setSolicitacaoAberta] = useState(false);
  const [checklistAberto, setChecklistAberto] = useState(false);
  const [pastaDriveId, setPastaDriveId] = useState("");
  const [comentarioConclusao, setComentarioConclusao] = useState("");

  // Autopreenche Oficina/Seguradora/Grupo do Produtor a partir do processo
  // vinculado (a pedido do usuário) — sempre que a Comunicação aponta pra
  // um processo, os vínculos dele já vêm junto, sem precisar escolher os 3
  // à mão. Só preenche o que o processo realmente tem (não apaga um vínculo
  // já selecionado quando o processo não tem aquele dado).
  function vinculoProcesso(id) {
    setProcessoId(id);
    const cl = id ? claims.find((c) => c.id === id) : null;
    if (!cl) return;
    const ofic = String(campoEfetivo(records.corp_overrides, cl, "oficina") || "").trim();
    const seg = String(campoEfetivo(records.corp_overrides, cl, "cia") || "").trim();
    const prod = produtorOuAgenteEfetivo(records.corp_overrides, cl.id);
    if (ofic) setOficinaId(oficinaIdFromNome(ofic));
    if (seg) setSeguradoraId(seguradoraIdFromNome(seg));
    if (prod) setProdutorGrupo(prod);
  }

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo(editing.tipo); setUrgencia(editing.urgencia); setStatus(editing.status);
      setTitulo(editing.titulo || ""); setDescricao(editing.descricao || "");
      const sel = {}; (editing.destinatarios || []).forEach((id) => { sel[id] = true; });
      setDestSel(sel);
      const fsel = {}; (editing.flags || []).forEach((f) => { fsel[f] = true; });
      setFlagSel(fsel);
      setAnexo(editing.anexo || ""); setObs(editing.obs || ""); setProcessoId(editing.processo || "");
      setOficinaId(editing.oficinaId || ""); setSeguradoraId(editing.seguradoraId || ""); setProdutorGrupo(editing.produtorGrupo || "");
      setClienteId(editing.clienteId || "");
      setRecorrencia(editing.recorrencia || null); setRecorrenciaAberta(false);
      setProximaAcaoData(editing.proximaAcaoData || (editing.createdAt || "").slice(0, 10) || todayISO());
      setTipoAtendimento(editing.tipoAtendimento || ""); setChecklistMesa(editing.checklistMesa || checklistVazio());
      setSolicitacao(editing.solicitacao || null); setSolicitacaoAberta(false); setChecklistAberto(false);
      setPastaDriveId(editing.id); setComentarioConclusao("");
    } else {
      setTipo(taskTypes[0]); setUrgencia("Leve"); setStatus("Pendente");
      setDestSel({}); setFlagSel({});
      setAnexo(""); setObs(""); setProcessoId(""); setOficinaId(""); setSeguradoraId(""); setProdutorGrupo(""); setClienteId("");
      setRecorrencia(null); setRecorrenciaAberta(false);
      setProximaAcaoData(todayISO());
      setTipoAtendimento(""); setChecklistMesa(checklistVazio());
      setSolicitacao(null); setSolicitacaoAberta(false); setChecklistAberto(false);
      setPastaDriveId("sol_" + Math.random().toString(36).slice(2, 9)); setComentarioConclusao("");
      const prefill = takeDemandaPrefill();
      setTitulo(prefill?.titulo || ""); setDescricao(prefill?.descricao || "");
      if (prefill?.oficinaId) setOficinaId(prefill.oficinaId);
      if (prefill?.seguradoraId) setSeguradoraId(prefill.seguradoraId);
      if (prefill?.produtorGrupo) setProdutorGrupo(prefill.produtorGrupo);
      if (prefill?.clienteId) setClienteId(prefill.clienteId);
      // Vínculo de processo por último (e sempre por vinculoProcesso, não
      // por setProcessoId direto): reaproveita o mesmo autopreenchimento de
      // Oficina/Seguradora/Produtor usado quando o usuário escolhe o
      // processo à mão (ver vinculoProcesso), inclusive quando o prefill já
      // veio com um processo vinculado (ex.: "+ Criar tarefa" no cabeçalho
      // do processo).
      if (prefill?.processoId) vinculoProcesso(prefill.processoId);
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
  const gruposOuAgentesLista = distinctGruposOuAgentes(records.corp_overrides, claims);
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
    const t = titulo.trim();
    if (!t) { alert("Informe o título."); return; }
    const dests = Object.keys(destSel).filter((k) => destSel[k]);
    if (!dests.length) { alert("Selecione ao menos um destinatário."); return; }
    const flags = Object.keys(flagSel).filter((k) => flagSel[k]);
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
        ...editing, tipo, urgencia, status, anexo, obs, processo: processoId, oficinaId, seguradoraId, produtorGrupo, clienteId, recorrencia, proximaAcaoData, destinatarios: dests, flags, tipoAtendimento,
        titulo: t, descricao,
        ...(tipo === "Mesa de Atendimento" ? { checklistMesa, solicitacao } : {}),
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
        id: "tsk_" + Math.random().toString(36).slice(2, 9), ci: proximoCI(tasks), tipo, titulo: t, origem: currentUser.id, destinatarios: dests,
        descricao, anexo, obs, status, urgencia, processo: processoId, oficinaId, seguradoraId, produtorGrupo, clienteId, recorrencia, proximaAcaoData, flags, tipoAtendimento,
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0 }}>{editing ? "Tarefa" : "Nova tarefa"}</h3>
            {editing?.ci && <span className="badge gray mono" title="Número de protocolo">{editing.ci}</span>}
          </div>
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

        <div className="field" style={{ marginTop: isMesaAtendimento && tipoAtendimento && solicitacaoAberta ? 14 : 0 }}><label>Título</label>
          <input placeholder="Título da tarefa" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
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
          <label>Próxima ação</label>
          <span className="badge chip-live blue" style={{ gap: 6 }}>
            📅 <input type="date" className="inline" value={proximaAcaoData} onChange={(e) => setProximaAcaoData(e.target.value)} />
          </span>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Data prevista pra resolver esta tarefa — já vem preenchida com a data de criação, ajuste se for resolver em uma data futura.</div>
        </div>

        <div className="field">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className={"btn sm" + (recorrencia ? "" : " sec")} onClick={() => setRecorrenciaAberta((v) => !v)}>
              🔁 Recorrência{recorrencia ? " (ativa)" : ""}
            </button>
            {recorrencia && !recorrenciaAberta && <span className="muted" style={{ fontSize: 11.5 }}>{resumoRecorrencia(recorrencia)}</span>}
          </div>
          {recorrenciaAberta && <RecorrenciaFields recorrencia={recorrencia} onChange={setRecorrencia} />}
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
          <label>Sinalizadores</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(config.corp_task_flags && config.corp_task_flags.length ? config.corp_task_flags : TASK_FLAGS_DEFAULT).map((f) => (
              <label key={f} className={"chip-btn" + (flagSel[f] ? " active" : "")} style={{ cursor: "pointer" }}
                onClick={() => setFlagSel((s) => ({ ...s, [f]: !s[f] }))}
              >{f}</label>
            ))}
          </div>
          {isAdmin(currentUser) && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Administra a lista de sinalizadores em Comunicação interna → Sinalizadores.</div>}
        </div>

        <div className="field">
          <label>Descrição</label>
          <textarea rows={3} placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>

        <div className="grid c2">
          <div className="field"><label>Anexo</label><input placeholder="Link/nome do anexo (opcional)" value={anexo} onChange={(e) => setAnexo(e.target.value)} /></div>
          <div className="field"><label>Observação</label><input placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>

        <div className="field">
          <label>Vincular a processo existente</label>
          <ProcSearch value={{ label: procClaim ? (procClaim.numsin || "#" + procClaim.nosnum) + " — " + txt(procClaim.segurado) : "" }} onChange={vinculoProcesso} claims={claims} />
          {procClaim && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Oficina, seguradora e grupo do produtor/agente abaixo foram preenchidos automaticamente a partir deste processo — ajuste se precisar.</div>}
        </div>

        <div className="grid c3">
          <div className="field">
            <label>V. Oficina</label>
            <select value={oficinaId} onChange={(e) => setOficinaId(e.target.value)}>
              <option value="">— Nenhuma —</option>
              {oficinas.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label>V. Seguradora</label>
            <select value={seguradoraId} onChange={(e) => setSeguradoraId(e.target.value)}>
              <option value="">— Nenhuma —</option>
              {seguradorasLista.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label>V. Grupo do Produtor ou agente</label>
            <select value={produtorGrupo} onChange={(e) => setProdutorGrupo(e.target.value)}>
              <option value="">— Nenhum —</option>
              {gruposOuAgentesLista.map((g) => <option key={g} value={g}>{g}</option>)}
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

import { useRef, useState } from "react";
import { allJourneyStages } from "../../logic/claims";
import { MSG_VARIAVEIS, MSG_ETAPA_GENERICA, defaultMsgTemplates } from "../../logic/msgTemplates";
import { uid } from "../../logic/format";
import { EmptyState } from "../EmptyState.jsx";

function blankForm() { return { id: "", nome: "", etapaVinculada: MSG_ETAPA_GENERICA, texto: "" }; }

// Templates de mensagem (WhatsApp) por etapa da jornada — administrados
// aqui, usados no botão "Mensagem para o cliente" do Histórico do sinistro
// (CommsPanel.jsx → MensagemTemplateModal.jsx). etapaVinculada é o TÍTULO
// da etapa (mesma lista usada no seletor de Título do Histórico); vazio =
// template genérico, sem etapa específica.
export function MensagemTemplatesEditor({ config, saveConfig, canEdit }) {
  const templates = config.corp_msg_templates || [];
  const etapas = allJourneyStages(config.corp_journey_templates || {}, config.corp_atendimento_template);
  const [form, setForm] = useState(blankForm);
  const textareaRef = useRef(null);

  function inserirVariavel(chave) {
    const ta = textareaRef.current;
    if (!ta) { setForm((f) => ({ ...f, texto: f.texto + `[[${chave}]]` })); return; }
    const start = ta.selectionStart ?? form.texto.length;
    const end = ta.selectionEnd ?? form.texto.length;
    const novo = form.texto.slice(0, start) + `[[${chave}]]` + form.texto.slice(end);
    setForm((f) => ({ ...f, texto: novo }));
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + chave.length + 4; });
  }

  function salvar() {
    if (!canEdit) return;
    if (!form.nome.trim() || !form.texto.trim()) { alert("Preencha o nome e o texto do template."); return; }
    const item = { id: form.id || uid("msgtpl"), nome: form.nome.trim(), etapaVinculada: form.etapaVinculada, texto: form.texto };
    saveConfig("corp_msg_templates", (cur) => {
      const list = cur || [];
      const idx = list.findIndex((t) => t.id === item.id);
      if (idx === -1) return [...list, item];
      const next = list.slice(); next[idx] = item; return next;
    });
    setForm(blankForm());
  }
  function editar(t) { setForm({ id: t.id, nome: t.nome, etapaVinculada: t.etapaVinculada || MSG_ETAPA_GENERICA, texto: t.texto }); }
  function remover(id) {
    if (!canEdit) return;
    saveConfig("corp_msg_templates", (cur) => (cur || []).filter((t) => t.id !== id));
    if (form.id === id) setForm(blankForm());
  }
  function adicionarExemplos() {
    if (!canEdit) return;
    saveConfig("corp_msg_templates", (cur) => [...(cur || []), ...defaultMsgTemplates()]);
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Mensagens ao cliente (WhatsApp)</h3>
      <p className="muted">
        Templates de mensagem usados no botão "Mensagem para o cliente" do Histórico de cada sinistro. Ao abrir, o sistema já sugere o template vinculado à etapa atual da jornada — o atendente revisa e copia/envia manualmente, nada é enviado automático.
      </p>

      {canEdit && (
        <>
          <div className="grid c2">
            <div className="field"><label>Nome do template</label>
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Cobrança de vistoria" />
            </div>
            <div className="field"><label>Etapa vinculada</label>
              <select value={form.etapaVinculada} onChange={(e) => setForm((f) => ({ ...f, etapaVinculada: e.target.value }))}>
                <option value={MSG_ETAPA_GENERICA}>— Genérico (nenhuma etapa específica) —</option>
                {etapas.map((et) => <option key={et} value={et}>{et}</option>)}
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: 4 }}>
            <label>Texto da mensagem</label>
            <textarea ref={textareaRef} rows={5} value={form.texto} onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))} placeholder="Olá [[cliente]], ..." />
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, marginBottom: 10 }}>
            <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>Inserir variável:</span>
            {MSG_VARIAVEIS.map((v) => (
              <button key={v.chave} type="button" className="btn sec xs" title={v.label} onClick={() => inserirVariavel(v.chave)}>
                [[{v.chave}]]
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn sec sm" onClick={salvar}>{form.id ? "Salvar alterações" : "+ Adicionar template"}</button>
            {form.id && <button className="btn sec sm" onClick={() => setForm(blankForm())}>Cancelar edição</button>}
          </div>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        {!templates.length ? (
          <EmptyState>
            Nenhum template cadastrado ainda.
            {canEdit && <> <a style={{ cursor: "pointer", color: "var(--accent)" }} onClick={adicionarExemplos}>Adicionar 2 exemplos prontos (Vistoria e Atendimento inicial)</a>.</>}
          </EmptyState>
        ) : templates.map((t) => (
          <div key={t.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <div>
                <b style={{ fontSize: 13 }}>{t.nome}</b>{" "}
                <span className="badge blue" style={{ marginLeft: 4 }}>{t.etapaVinculada || "Genérico"}</span>
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <a style={{ cursor: "pointer", fontSize: 12 }} onClick={() => editar(t)}>editar</a>
                  <a style={{ cursor: "pointer", fontSize: 12, color: "var(--danger)" }} onClick={() => remover(t.id)}>remover</a>
                </div>
              )}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap" }}>{t.texto}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

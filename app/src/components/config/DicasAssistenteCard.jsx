import { useState } from "react";
import { PAPEIS_DICA, blankDica, defaultDicasAssistente } from "../../logic/dicasAssistente";
import { uid } from "../../logic/format";
import { EmptyState } from "../EmptyState.jsx";

// "Dicas do Assistente" (a pedido do usuário) — lembretes curtos entregues
// como notificação normal no sino, no horário e pros papéis configurados
// (ex.: todo dia às 09:00 para Atendente/Analista: "Verifique o WhatsApp").
// Sem backend/cron neste app: a entrega acontece no cliente (useDicasAssistente.js),
// na primeira vez que o app do usuário alvo reavaliar o relógio a partir do
// horário configurado naquele dia — não é um push exato à hora cravada.
export function DicasAssistenteCard({ config, saveConfig, canEdit }) {
  const dicas = config.corp_assistente_dicas || [];
  const [form, setForm] = useState(blankDica);

  function togglePapel(papel) {
    setForm((f) => {
      const atual = f.papeis || [];
      const next = atual.indexOf(papel) >= 0 ? atual.filter((p) => p !== papel) : [...atual, papel];
      return { ...f, papeis: next };
    });
  }

  function salvar() {
    if (!canEdit) return;
    if (!form.texto.trim()) { alert("Escreva o texto da dica."); return; }
    if (!form.hora) { alert("Defina o horário de envio."); return; }
    if (!(form.papeis || []).length) { alert("Selecione ao menos um papel de destino."); return; }
    const item = { id: form.id || uid("dica"), texto: form.texto.trim(), hora: form.hora, papeis: form.papeis, ativo: form.ativo !== false };
    saveConfig("corp_assistente_dicas", (cur) => {
      const list = cur || [];
      const idx = list.findIndex((d) => d.id === item.id);
      if (idx === -1) return [...list, item];
      const next = list.slice(); next[idx] = item; return next;
    });
    setForm(blankDica());
  }
  function editar(d) { setForm({ id: d.id, texto: d.texto, hora: d.hora || "09:00", papeis: d.papeis || [], ativo: d.ativo !== false }); }
  function remover(id) {
    if (!canEdit) return;
    if (!confirm("Remover esta dica?")) return;
    saveConfig("corp_assistente_dicas", (cur) => (cur || []).filter((d) => d.id !== id));
    if (form.id === id) setForm(blankDica());
  }
  function toggleAtivo(d) {
    if (!canEdit) return;
    saveConfig("corp_assistente_dicas", (cur) => (cur || []).map((x) => (x.id === d.id ? { ...x, ativo: !x.ativo } : x)));
  }
  function adicionarExemplos() {
    if (!canEdit) return;
    saveConfig("corp_assistente_dicas", (cur) => [...(cur || []), ...defaultDicasAssistente()]);
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Dicas do Assistente</h3>
      <p className="muted">
        Lembretes curtos entregues automaticamente pelo sino de notificações, no horário e pros papéis configurados aqui (ex.: todo dia às 09:00, para Atendente/Analista — "Verifique o WhatsApp"). A entrega acontece assim que o app da pessoa estiver aberto a partir do horário — não é um envio por e-mail/WhatsApp de verdade, nem garante o minuto exato se o app estiver fechado.
      </p>

      {canEdit && (
        <>
          <div className="grid c2">
            <div className="field"><label>Horário de envio</label>
              <input type="time" value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} />
            </div>
            <div className="field"><label>Ativa</label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={form.ativo !== false} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
                <span className="muted" style={{ fontSize: 12.5 }}>{form.ativo !== false ? "Enviando normalmente" : "Pausada (não envia)"}</span>
              </label>
            </div>
          </div>

          <div className="field">
            <label>Texto da dica</label>
            <textarea rows={2} value={form.texto} onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))} placeholder="Ex.: Verifique o WhatsApp — confira mensagens de clientes aguardando resposta." />
          </div>

          <div className="field">
            <label>Papéis de destino</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PAPEIS_DICA.map(([k, label]) => (
                <label key={k} className={"chip-btn" + ((form.papeis || []).indexOf(k) >= 0 ? " active" : "")} style={{ cursor: "pointer" }} onClick={() => togglePapel(k)}>
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn sec sm" onClick={salvar}>{form.id ? "Salvar alterações" : "+ Adicionar dica"}</button>
            {form.id && <button className="btn sec sm" onClick={() => setForm(blankDica())}>Cancelar edição</button>}
          </div>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        {!dicas.length ? (
          <EmptyState>
            Nenhuma dica cadastrada ainda.
            {canEdit && <> <a style={{ cursor: "pointer", color: "var(--accent)" }} onClick={adicionarExemplos}>Adicionar 3 exemplos prontos (WhatsApp, e-mail e Comunicação interna, às 9h)</a>.</>}
          </EmptyState>
        ) : dicas.map((d) => (
          <div key={d.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 8, opacity: d.ativo === false ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span className="badge blue mono">{d.hora}</span>
                {(d.papeis || []).map((p) => <span key={p} className="badge gray">{(PAPEIS_DICA.find(([k]) => k === p) || ["", p])[1]}</span>)}
                {d.ativo === false && <span className="badge gray">pausada</span>}
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <a style={{ cursor: "pointer", fontSize: 12 }} onClick={() => toggleAtivo(d)}>{d.ativo === false ? "ativar" : "pausar"}</a>
                  <a style={{ cursor: "pointer", fontSize: 12 }} onClick={() => editar(d)}>editar</a>
                  <a style={{ cursor: "pointer", fontSize: 12, color: "var(--danger)" }} onClick={() => remover(d.id)}>remover</a>
                </div>
              )}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap" }}>{d.texto}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

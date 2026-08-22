import { useEffect, useState } from "react";
import { getChecklistEfetivo } from "../../logic/checklistMesaAtendimento";
import { getFormularioEfetivo } from "../../logic/solicitacaoAtendimento";
import { uid } from "../../logic/format";

const GRUPOS = [["segurado", "Segurado"], ["terceiro", "Terceiro"]];

// Editor do checklist de abertura de sinistro (Mesa de Atendimento) — a
// pedido do usuário: o admin pode adicionar, remover, editar e reordenar
// itens, incluindo o vínculo com um campo do formulário de Solicitação de
// Sinistro (quando esse campo é preenchido pela 1ª vez, o item é marcado
// automaticamente — ver logic/checklistMesaAtendimento.js sincronizarComFormulario).
// Personalização fica em config.corp_checklist_mesa_atendimento =
// { segurado: [...], terceiro: [...] }.
export function ChecklistMesaAtendimentoCard({ config, saveConfig, canEdit }) {
  const [grupoSel, setGrupoSel] = useState("segurado");
  const [itens, setItens] = useState([]);
  const [status, setStatus] = useState(null);

  const camposFormulario = (getFormularioEfetivo("sinistro", config) || { campos: [] }).campos;

  useEffect(() => {
    const efetivo = getChecklistEfetivo(config);
    setItens((efetivo[grupoSel] || []).map((i) => ({ ...i })));
    setStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoSel]);

  function atualizarItem(idx, patch) {
    setItens((cur) => cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removerItem(idx) {
    setItens((cur) => cur.filter((_, i) => i !== idx));
  }
  function adicionarItem() {
    setItens((cur) => [...cur, { id: uid("chk"), label: "Novo item", campoVinculado: "" }]);
  }
  function mover(idx, direcao) {
    setItens((cur) => {
      const alvo = idx + direcao;
      if (alvo < 0 || alvo >= cur.length) return cur;
      const next = cur.slice();
      [next[idx], next[alvo]] = [next[alvo], next[idx]];
      return next;
    });
  }

  function salvar() {
    if (!canEdit) { alert("Apenas administradores podem editar o checklist."); return; }
    saveConfig("corp_checklist_mesa_atendimento", (cur) => ({ ...(cur || {}), [grupoSel]: itens }));
    setStatus("Salvo.");
  }
  function restaurarPadrao() {
    if (!canEdit) { alert("Apenas administradores podem editar o checklist."); return; }
    if (!confirm(`Restaurar o checklist "${grupoSel}" para o padrão de fábrica? A personalização atual será descartada.`)) return;
    saveConfig("corp_checklist_mesa_atendimento", (cur) => {
      const next = { ...(cur || {}) };
      delete next[grupoSel];
      return next;
    });
    setStatus("Restaurado ao padrão de fábrica.");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Checklist de Abertura de Sinistro</h3>
      <p className="muted">
        Itens do checklist mostrado na Mesa de Atendimento (atendimento "Sinistro") — marcação do que já foi coletado, não um formulário. Cada item pode ficar vinculado a um campo do formulário de Solicitação: assim que esse campo é preenchido pela primeira vez, o item é marcado sozinho (depois disso, marcar/desmarcar fica livre). Adicione, remova, edite ou reordene sem depender de alteração de código.
      </p>

      <div className="chips">
        {GRUPOS.map(([k, label]) => (
          <div key={k} className={"chip-btn" + (grupoSel === k ? " active" : "")} onClick={() => setGrupoSel(k)}>{label}</div>
        ))}
      </div>

      <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginTop: 10 }}>
        {!itens.length ? <p className="muted" style={{ fontSize: 13 }}>Nenhum item. Clique em "+ Adicionar item" abaixo.</p> : itens.map((item, idx) => (
          <div key={item.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 8, marginBottom: 6, background: "var(--surface-2)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ flex: 1 }} value={item.label} onChange={(e) => atualizarItem(idx, { label: e.target.value })} />
              <button className="btn sec xs" disabled={idx === 0} onClick={() => mover(idx, -1)}>Subir</button>
              <button className="btn sec xs" disabled={idx === itens.length - 1} onClick={() => mover(idx, 1)}>Descer</button>
              <button className="btn danger xs" onClick={() => removerItem(idx)}>Remover</button>
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
              <label className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>Marca sozinho quando preencher:</label>
              <select style={{ flex: 1 }} value={item.campoVinculado || ""} onChange={(e) => atualizarItem(idx, { campoVinculado: e.target.value })}>
                <option value="">Nenhum vínculo (só marcação manual)</option>
                {camposFormulario.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button className="btn sec sm" onClick={adicionarItem}>+ Adicionar item</button>
        <button className="btn sm" onClick={salvar}>Salvar checklist "{GRUPOS.find(([k]) => k === grupoSel)[1]}"</button>
        <button className="btn danger sm" onClick={restaurarPadrao}>Restaurar padrão de fábrica</button>
      </div>
      {status && <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{status}</p>}
    </div>
  );
}

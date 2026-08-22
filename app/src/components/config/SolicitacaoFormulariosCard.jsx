import { useEffect, useState } from "react";
import { TIPOS_ATENDIMENTO, TIPOS_CAMPO, getFormularioEfetivo } from "../../logic/solicitacaoAtendimento";
import { uid } from "../../logic/format";

// Editor dos formulários de "Solicitação de Atendimento" (Mesa de
// Atendimento) — a pedido do usuário: o admin pode adicionar, remover e
// editar campos sem depender de alteração de código. Personalização fica
// em config.corp_solicitacao_formularios[tipoAtendimento] = { titulo, campos }.
// "Restaurar padrão" apaga a personalização, voltando ao formulário de
// fábrica (logic/solicitacaoAtendimento.js).
export function SolicitacaoFormulariosCard({ config, saveConfig, canEdit }) {
  const [tipoSel, setTipoSel] = useState(TIPOS_ATENDIMENTO[0][0]);
  const [titulo, setTitulo] = useState("");
  const [campos, setCampos] = useState([]);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const def = getFormularioEfetivo(tipoSel, config) || { titulo: "", campos: [] };
    setTitulo(def.titulo || "");
    setCampos((def.campos || []).map((c) => ({ ...c })));
    setStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoSel]);

  function atualizarCampo(idx, patch) {
    setCampos((cur) => cur.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function removerCampo(idx) {
    setCampos((cur) => cur.filter((_, i) => i !== idx));
  }
  function adicionarCampo() {
    setCampos((cur) => [...cur, { id: uid("campo"), secao: cur.length ? cur[cur.length - 1].secao : "Geral", label: "Novo campo", tipo: "texto", obrigatorio: false }]);
  }
  function mover(idx, direcao) {
    setCampos((cur) => {
      const alvo = idx + direcao;
      if (alvo < 0 || alvo >= cur.length) return cur;
      const next = cur.slice();
      [next[idx], next[alvo]] = [next[alvo], next[idx]];
      return next;
    });
  }

  function salvar() {
    if (!canEdit) { alert("Apenas administradores podem editar os formulários."); return; }
    saveConfig("corp_solicitacao_formularios", (cur) => ({ ...(cur || {}), [tipoSel]: { titulo: titulo.trim(), campos } }));
    setStatus("Salvo.");
  }
  function restaurarPadrao() {
    if (!canEdit) { alert("Apenas administradores podem editar os formulários."); return; }
    if (!confirm("Restaurar o formulário de fábrica para este atendimento? A personalização atual será descartada.")) return;
    saveConfig("corp_solicitacao_formularios", (cur) => {
      const next = { ...(cur || {}) };
      delete next[tipoSel];
      return next;
    });
    setStatus("Restaurado ao padrão de fábrica.");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Formulários de Solicitação de Atendimento</h3>
      <p className="muted">
        Edite os campos dos formulários usados na Mesa de Atendimento (botão "Solicitação" em Comunicação). Adicione, remova ou reordene campos sem depender de alteração de código.
      </p>

      <div className="chips">
        {TIPOS_ATENDIMENTO.map(([k, label]) => (
          <div key={k} className={"chip-btn" + (tipoSel === k ? " active" : "")} onClick={() => setTipoSel(k)}>{label}</div>
        ))}
      </div>

      <div className="field" style={{ marginTop: 10 }}>
        <label>Título do formulário</label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>

      <div style={{ maxHeight: 480, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginTop: 10 }}>
        {!campos.length ? <p className="muted" style={{ fontSize: 13 }}>Nenhum campo. Clique em "+ Adicionar campo" abaixo.</p> : campos.map((campo, idx) => (
          <div key={campo.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8, background: "var(--surface-2)" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 2, minWidth: 200, marginTop: 0 }}>
                <label>Rótulo (pergunta)</label>
                <input value={campo.label} onChange={(e) => atualizarCampo(idx, { label: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140, marginTop: 0 }}>
                <label>Seção</label>
                <input value={campo.secao || ""} onChange={(e) => atualizarCampo(idx, { secao: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 160, marginTop: 0 }}>
                <label>Tipo de campo</label>
                <select value={campo.tipo} onChange={(e) => atualizarCampo(idx, { tipo: e.target.value })}>
                  {TIPOS_CAMPO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>

            {campo.tipo === "select" && (
              <div className="field" style={{ marginTop: 6 }}>
                <label>Opções (uma por linha)</label>
                <textarea rows={3} value={(campo.opcoes || []).join("\n")} onChange={(e) => atualizarCampo(idx, { opcoes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
              </div>
            )}

            {campo.tipo === "arquivo" && (
              <div className="grid c2" style={{ marginTop: 6 }}>
                <div className="field" style={{ marginTop: 0 }}>
                  <label>Máx. arquivos</label>
                  <input type="number" min={1} value={campo.maxArquivos || 1} onChange={(e) => atualizarCampo(idx, { maxArquivos: Number(e.target.value) || 1 })} />
                </div>
                <div className="field" style={{ marginTop: 0 }}>
                  <label>Tamanho máx. por arquivo (MB)</label>
                  <input type="number" min={1} value={campo.maxTamanhoMb || 10} onChange={(e) => atualizarCampo(idx, { maxTamanhoMb: Number(e.target.value) || 10 })} />
                </div>
              </div>
            )}

            <div className="field" style={{ marginTop: 6 }}>
              <label>Texto de ajuda (opcional)</label>
              <input value={campo.ajuda || ""} onChange={(e) => atualizarCampo(idx, { ajuda: e.target.value })} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={!!campo.obrigatorio} onChange={(e) => atualizarCampo(idx, { obrigatorio: e.target.checked })} />
                <span style={{ fontSize: 12 }}>Obrigatório</span>
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn sec xs" disabled={idx === 0} onClick={() => mover(idx, -1)}>Subir</button>
                <button className="btn sec xs" disabled={idx === campos.length - 1} onClick={() => mover(idx, 1)}>Descer</button>
                <button className="btn danger xs" onClick={() => removerCampo(idx)}>Remover</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button className="btn sec sm" onClick={adicionarCampo}>+ Adicionar campo</button>
        <button className="btn sm" onClick={salvar}>Salvar formulário</button>
        <button className="btn danger sm" onClick={restaurarPadrao}>Restaurar padrão de fábrica</button>
      </div>
      {status && <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{status}</p>}
    </div>
  );
}

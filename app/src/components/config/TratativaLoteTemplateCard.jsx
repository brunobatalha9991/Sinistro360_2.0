import { useState } from "react";
import { DEFAULT_TRATATIVA_LOTE_TEMPLATE } from "../../logic/tratativaLote";

// Template padrão do botão "📋 Tratativa em lote" (módulo Oficinas) — a
// pedido do usuário: uma única string, repetida uma vez por processo em
// aberto (variável [[placa]]), não uma lista de templates como em
// Mensagens ao Cliente.
export function TratativaLoteTemplateCard({ config, saveConfig, canEdit }) {
  const salvo = config.corp_tratativa_lote_template || "";
  const [texto, setTexto] = useState(salvo || DEFAULT_TRATATIVA_LOTE_TEMPLATE);
  const [salvou, setSalvou] = useState(false);

  function salvar() {
    if (!canEdit) return;
    saveConfig("corp_tratativa_lote_template", texto);
    setSalvou(true);
    setTimeout(() => setSalvou(false), 2000);
  }
  function restaurarPadrao() {
    if (!canEdit) return;
    setTexto(DEFAULT_TRATATIVA_LOTE_TEMPLATE);
    saveConfig("corp_tratativa_lote_template", "");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Tratativa em lote (Oficinas)</h3>
      <p className="muted">
        Template da 1ª mensagem gerada pelo botão "📋 Tratativa em lote", dentro de cada oficina — repetido uma vez pra cada processo em aberto, substituindo <code>[[placa]]</code> pela placa do veículo.
      </p>
      {canEdit ? (
        <>
          <div className="field">
            <label>Texto do template</label>
            <textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn sec sm" onClick={salvar}>{salvou ? "Salvo!" : "Salvar template"}</button>
            <button className="btn ghost sm" onClick={restaurarPadrao}>Restaurar padrão</button>
          </div>
        </>
      ) : (
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0 }}>{salvo || DEFAULT_TRATATIVA_LOTE_TEMPLATE}</pre>
      )}
    </div>
  );
}

import { useState } from "react";
import { StatusChipsEditor } from "./StatusChipsEditor.jsx";
import { getAtendTemplate, STATUS_DEFAULT } from "../../logic/claims";
import { uid } from "../../logic/format";

// Porte 1:1 do editor "Etapas de Atendimento" das Configurações do HTML original.
export function AtendimentoStepsEditor({ atendTemplateCfg, saveConfig }) {
  const [novaEtapa, setNovaEtapa] = useState("");
  const tpl = getAtendTemplate(atendTemplateCfg);
  const steps = tpl.steps || [];

  function setSteps(next) { saveConfig("corp_atendimento_template", { steps: next }); }
  function excluirEtapa(i) { setSteps(steps.filter((_, idx) => idx !== i)); }
  function setTitulo(i, title) { const next = [...steps]; next[i] = { ...next[i], title }; setSteps(next); }
  function setStatusOptions(i, opts) { const next = [...steps]; next[i] = { ...next[i], statusOptions: opts }; setSteps(next); }
  function adicionarEtapa() {
    const v = novaEtapa.trim();
    if (!v) return;
    setSteps([...steps, { id: uid("at"), title: v, statusOptions: [...STATUS_DEFAULT] }]);
    setNovaEtapa("");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Etapas de Atendimento</h3>
      <p className="muted">Usadas na Jornada do cliente sempre que o tipo do processo for "Atendimento" — não dependem do ramo. Adicione, edite ou remova como quiser.</p>
      {steps.map((step, i) => (
        <div key={step.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input className="inline" defaultValue={step.title} style={{ fontWeight: 600, minWidth: 220 }} onBlur={(e) => setTitulo(i, e.target.value)} />
            <button className="btn danger xs" onClick={() => excluirEtapa(i)}>Excluir etapa</button>
          </div>
          <StatusChipsEditor options={step.statusOptions || STATUS_DEFAULT} onChange={(opts) => setStatusOptions(i, opts)} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "4px 0 4px" }}>
        <input className="inline" placeholder="Nova etapa..." style={{ minWidth: 180 }} value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)} />
        <button className="btn sec xs" onClick={adicionarEtapa}>+ Etapa</button>
      </div>
    </div>
  );
}

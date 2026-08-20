import { useState } from "react";
import { StatusChipsEditor } from "./StatusChipsEditor.jsx";
import { getAtendTemplate, STATUS_DEFAULT } from "../../logic/claims";
import { uid } from "../../logic/format";

// Porte 1:1 do editor "Etapas de Atendimento" das Configurações do HTML
// original. Cada ação lê o template mais recente dentro do próprio updater
// do saveConfig (não um retrato de antes) e identifica a etapa por id, não
// por posição — evita perder uma edição concorrente de outro usuário.
export function AtendimentoStepsEditor({ atendTemplateCfg, saveConfig }) {
  const [novaEtapa, setNovaEtapa] = useState("");
  const steps = getAtendTemplate(atendTemplateCfg).steps || [];

  function patchStep(stepId, patchFn) {
    saveConfig("corp_atendimento_template", (current) => {
      const curSteps = getAtendTemplate(current).steps || [];
      return { steps: curSteps.map((s) => (s.id === stepId ? patchFn(s) : s)) };
    });
  }
  function excluirEtapa(stepId) {
    saveConfig("corp_atendimento_template", (current) => {
      const curSteps = getAtendTemplate(current).steps || [];
      return { steps: curSteps.filter((s) => s.id !== stepId) };
    });
  }
  function moverEtapa(stepId, dir) {
    saveConfig("corp_atendimento_template", (current) => {
      const curSteps = getAtendTemplate(current).steps || [];
      const idx = curSteps.findIndex((s) => s.id === stepId);
      const novoIdx = idx + dir;
      if (idx < 0 || novoIdx < 0 || novoIdx >= curSteps.length) return { steps: curSteps };
      const copia = curSteps.slice();
      const [item] = copia.splice(idx, 1);
      copia.splice(novoIdx, 0, item);
      return { steps: copia };
    });
  }
  function setTitulo(stepId, title) { patchStep(stepId, (s) => ({ ...s, title })); }
  function setStatusOptions(stepId, opts) { patchStep(stepId, (s) => ({ ...s, statusOptions: opts })); }
  function adicionarEtapa() {
    const v = novaEtapa.trim();
    if (!v) return;
    saveConfig("corp_atendimento_template", (current) => {
      const curSteps = getAtendTemplate(current).steps || [];
      return { steps: [...curSteps, { id: uid("at"), title: v, statusOptions: [...STATUS_DEFAULT] }] };
    });
    setNovaEtapa("");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Etapas de Atendimento</h3>
      <p className="muted">Usadas na Jornada do cliente sempre que o tipo do processo for "Atendimento" — não dependem do ramo. Adicione, edite ou remova como quiser.</p>
      {steps.map((step, idx) => (
        <div key={step.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button className="btn sec xs" title="Mover para cima" disabled={idx === 0} onClick={() => moverEtapa(step.id, -1)}>▲</button>
              <button className="btn sec xs" title="Mover para baixo" disabled={idx === steps.length - 1} onClick={() => moverEtapa(step.id, 1)}>▼</button>
            </div>
            <input className="inline" defaultValue={step.title} style={{ fontWeight: 600, minWidth: 220 }} onBlur={(e) => setTitulo(step.id, e.target.value)} />
            <button className="btn danger xs" onClick={() => excluirEtapa(step.id)}>Excluir etapa</button>
          </div>
          <StatusChipsEditor options={step.statusOptions || STATUS_DEFAULT} onChange={(opts) => setStatusOptions(step.id, opts)} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "4px 0 4px" }}>
        <input className="inline" placeholder="Nova etapa..." style={{ minWidth: 180 }} value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)} />
        <button className="btn sec xs" onClick={adicionarEtapa}>+ Etapa</button>
      </div>
    </div>
  );
}

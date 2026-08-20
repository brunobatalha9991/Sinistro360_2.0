import { useState } from "react";
import { StatusChipsEditor } from "./StatusChipsEditor.jsx";
import { StepsEditor } from "./StepsEditor.jsx";
import { getAtendTemplate, STATUS_DEFAULT } from "../../logic/claims";
import { uid } from "../../logic/format";

// Porte 1:1 do editor "Etapas de Atendimento" das Configurações do HTML
// original, com dois acréscimos: reordenar etapas (▲▼) e a possibilidade de
// marcar uma etapa como "caminho por tipo" — igual ao Definir caminho das
// jornadas por ramo, mas com quantas opções o admin quiser (ex.: Tipo de
// Assistência: Guincho, Chaveiro, Vidros...). Cada opção ganha sua própria
// trilha de etapas configurável logo abaixo. Quando o atendente escolhe o
// tipo na jornada do cliente, a trilha daquele tipo substitui o resto do
// fluxo (não vai mais para Definir caminho/Perda Parcial/Integral).
export function AtendimentoStepsEditor({ atendTemplateCfg, saveConfig }) {
  const [novaEtapa, setNovaEtapa] = useState("");
  const steps = getAtendTemplate(atendTemplateCfg).steps || [];

  function patchTemplate(updater) {
    saveConfig("corp_atendimento_template", (current) => {
      const curSteps = getAtendTemplate(current).steps || [];
      return { steps: updater(curSteps) };
    });
  }
  function patchStep(stepId, patchFn) {
    patchTemplate((curSteps) => curSteps.map((s) => (s.id === stepId ? patchFn(s) : s)));
  }
  function excluirEtapa(stepId) {
    patchTemplate((curSteps) => curSteps.filter((s) => s.id !== stepId));
  }
  function moverEtapa(stepId, dir) {
    patchTemplate((curSteps) => {
      const idx = curSteps.findIndex((s) => s.id === stepId);
      const novoIdx = idx + dir;
      if (idx < 0 || novoIdx < 0 || novoIdx >= curSteps.length) return curSteps;
      const copia = curSteps.slice();
      const [item] = copia.splice(idx, 1);
      copia.splice(novoIdx, 0, item);
      return copia;
    });
  }
  function setTitulo(stepId, title) { patchStep(stepId, (s) => ({ ...s, title })); }
  function setStatusOptions(stepId, opts) { patchStep(stepId, (s) => ({ ...s, statusOptions: opts })); }
  function toggleBranch(stepId) {
    patchStep(stepId, (s) => ({ ...s, branch: !s.branch, branches: s.branches || {} }));
  }
  function setTrilha(stepId, tipo, nextSteps) {
    patchStep(stepId, (s) => ({ ...s, branches: { ...(s.branches || {}), [tipo]: nextSteps } }));
  }
  function adicionarEtapa() {
    const v = novaEtapa.trim();
    if (!v) return;
    patchTemplate((curSteps) => [...curSteps, { id: uid("at"), title: v, statusOptions: [...STATUS_DEFAULT] }]);
    setNovaEtapa("");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Etapas de Atendimento</h3>
      <p className="muted">Usadas na Jornada do cliente sempre que o tipo do processo for "Atendimento" — não dependem do ramo. Adicione, edite ou remova como quiser.</p>
      {steps.map((step, idx) => (
        <div key={step.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button className="btn sec xs" title="Mover para cima" disabled={idx === 0} onClick={() => moverEtapa(step.id, -1)}>▲</button>
              <button className="btn sec xs" title="Mover para baixo" disabled={idx === steps.length - 1} onClick={() => moverEtapa(step.id, 1)}>▼</button>
            </div>
            <input className="inline" defaultValue={step.title} style={{ fontWeight: 600, minWidth: 220 }} onBlur={(e) => setTitulo(step.id, e.target.value)} />
            <button
              className={"btn xs" + (step.branch ? "" : " sec")}
              title="Ao ativar, esta etapa vira um seletor: a opção escolhida abre uma trilha própria de etapas, no lugar de Definir caminho"
              onClick={() => toggleBranch(step.id)}
            >
              🔀 {step.branch ? "Caminho por tipo (ativo)" : "Virar caminho por tipo"}
            </button>
            <button className="btn danger xs" onClick={() => excluirEtapa(step.id)}>Excluir etapa</button>
          </div>
          <StatusChipsEditor options={step.statusOptions || STATUS_DEFAULT} onChange={(opts) => setStatusOptions(step.id, opts)} />
          {step.branch && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                Cada opção acima abre a trilha de etapas correspondente. Configure aqui o que acontece em cada uma:
              </p>
              {(step.statusOptions || []).map((tipo) => (
                <StepsEditor
                  key={tipo}
                  steps={(step.branches || {})[tipo] || []}
                  onChange={(next) => setTrilha(step.id, tipo, next)}
                  label={`➤ ${tipo}`}
                />
              ))}
              {!(step.statusOptions || []).length && (
                <p className="muted" style={{ fontSize: 12 }}>Adicione pelo menos uma opção de status acima para configurar a trilha dela.</p>
              )}
            </div>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "4px 0 4px" }}>
        <input className="inline" placeholder="Nova etapa..." style={{ minWidth: 180 }} value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)} />
        <button className="btn sec xs" onClick={adicionarEtapa}>+ Etapa</button>
      </div>
    </div>
  );
}

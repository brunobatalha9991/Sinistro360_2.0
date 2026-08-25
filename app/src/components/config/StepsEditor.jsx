import { useState } from "react";
import { StatusChipsEditor } from "./StatusChipsEditor.jsx";
import { STATUS_DEFAULT } from "../../logic/claims";
import { uid } from "../../logic/format";

// Editor genérico de uma lista de etapas {id, title, statusOptions} — com
// reordenar (▲▼), editar título, editar status e adicionar/excluir etapa.
// Usado nas jornadas por ramo (comuns/parcial/integral) e nas trilhas por
// tipo de assistência. `onChange(nextSteps)` recebe a lista inteira nova;
// quem chama decide onde salvar (ramo, trilha, etc.).
export function StepsEditor({ steps, onChange, label, highlight, horaOption }) {
  const [novaEtapa, setNovaEtapa] = useState("");
  // Configuração de status por etapa (Marca como/Tem data/título) é o que
  // deixa esta tela longa — minimizada por padrão (a pedido do usuário),
  // com um botão por etapa e um "Minimizar/Maximizar todas" pra esta lista.
  const [openMap, setOpenMap] = useState({});
  function isOpen(stepId) { return !!openMap[stepId]; }
  function toggleOpen(stepId) { setOpenMap((m) => ({ ...m, [stepId]: !m[stepId] })); }
  function minimizarTodas() { setOpenMap({}); }
  function maximizarTodas() {
    const m = {};
    steps.forEach((s) => { m[s.id] = true; });
    setOpenMap(m);
  }

  function patchStep(stepId, patchFn) {
    onChange(steps.map((s) => (s.id === stepId ? patchFn(s) : s)));
  }
  function excluirEtapa(stepId) {
    onChange(steps.filter((s) => s.id !== stepId));
  }
  function moverEtapa(stepId, dir) {
    const idx = steps.findIndex((s) => s.id === stepId);
    const novoIdx = idx + dir;
    if (idx < 0 || novoIdx < 0 || novoIdx >= steps.length) return;
    const copia = steps.slice();
    const [item] = copia.splice(idx, 1);
    copia.splice(novoIdx, 0, item);
    onChange(copia);
  }
  function setTitulo(stepId, title) { patchStep(stepId, (s) => ({ ...s, title })); }
  function adicionarEtapa() {
    const v = novaEtapa.trim();
    if (!v) return;
    onChange([...steps, { id: uid("st"), title: v, statusOptions: [...STATUS_DEFAULT] }]);
    setNovaEtapa("");
  }

  return (
    <div style={highlight ? { background: "rgba(var(--brand-rgb),.08)", border: "1px solid rgba(var(--brand-rgb),.28)", borderRadius: 8, padding: 10, marginBottom: 12 } : undefined}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        {label && <div style={{ fontWeight: 600, margin: "8px 0", color: "var(--brand)" }}>{label}</div>}
        {!!steps.length && (
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn sec xs" onClick={minimizarTodas}>▾ Minimizar todas</button>
            <button type="button" className="btn sec xs" onClick={maximizarTodas}>▸ Maximizar todas</button>
          </div>
        )}
      </div>
      {steps.map((step, idx) => (
        <div key={step.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button className="btn sec xs" title="Mover para cima" disabled={idx === 0} onClick={() => moverEtapa(step.id, -1)}>▲</button>
              <button className="btn sec xs" title="Mover para baixo" disabled={idx === steps.length - 1} onClick={() => moverEtapa(step.id, 1)}>▼</button>
            </div>
            <input className="inline" defaultValue={step.title} style={{ fontWeight: 600, minWidth: 220 }} onBlur={(e) => setTitulo(step.id, e.target.value)} />
            <button type="button" className="btn sec xs" onClick={() => toggleOpen(step.id)}>{isOpen(step.id) ? "▾ Ocultar status" : "▸ Ver status"}</button>
            <button className="btn danger xs" onClick={() => excluirEtapa(step.id)}>Excluir etapa</button>
          </div>
          {isOpen(step.id) && (
            <StatusChipsEditor step={step} onChangeStep={(patch) => patchStep(step.id, (s) => ({ ...s, ...patch }))} horaOption={horaOption} />
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "4px 0 12px" }}>
        <input className="inline" placeholder="Nova etapa..." style={{ minWidth: 180 }} value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)} />
        <button className="btn sec xs" onClick={adicionarEtapa}>+ Etapa</button>
      </div>
    </div>
  );
}

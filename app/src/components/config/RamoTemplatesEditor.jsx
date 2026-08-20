import { useState } from "react";
import { StatusChipsEditor } from "./StatusChipsEditor.jsx";
import { defaultRamoTemplate, getComunsSteps, STATUS_DEFAULT } from "../../logic/claims";
import { EmptyState } from "../EmptyState.jsx";
import { uid } from "../../logic/format";

// Porte 1:1 do editor "Jornadas por ramo" das Configurações do HTML original,
// com um acréscimo: as etapas de cada seção (comuns/antes do caminho, Perda
// Parcial, Perda Integral) agora podem ser reordenadas — inclusive a etapa
// de Vistoria, que deixou de ser fixa e pode ser movida para depois de
// outras etapas criadas antes dela.
export function RamoTemplatesEditor({ templates, saveConfig }) {
  const [novoRamo, setNovoRamo] = useState("");
  const ramos = Object.keys(templates).sort();

  function patch(ramo, patchFn) {
    saveConfig("corp_journey_templates", (current) => {
      const t = { ...(current || {}) };
      const cur = t[ramo] || defaultRamoTemplate();
      t[ramo] = patchFn(cur);
      return t;
    });
  }
  function adicionarRamo() {
    const r = novoRamo.trim().toUpperCase();
    if (!r) return;
    patch(r, (tpl) => ({ ...tpl, comuns: getComunsSteps(tpl) }));
    setNovoRamo("");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Jornadas por ramo</h3>
      <p className="muted">Defina as etapas e os status de cada caminho (Perda Parcial / Perda Integral). Use as setas para reordenar — inclusive mover etapas para antes da Vistoria. Mudanças aparecem automaticamente em todos os sinistros do ramo.</p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input className="inline" placeholder="Ex.: RESI, VIDA..." style={{ minWidth: 160 }} value={novoRamo} onChange={(e) => setNovoRamo(e.target.value)} />
        <button className="btn sec sm" onClick={adicionarRamo}>+ Adicionar ramo</button>
      </div>

      {!ramos.length && <EmptyState>Nenhum ramo ainda. Sincronize os sinistros ou adicione um ramo manualmente.</EmptyState>}

      {ramos.map((ramo) => {
        const tpl = templates[ramo];
        return (
          <div key={ramo} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <h4 style={{ margin: "0 0 10px" }}>Ramo: {ramo}</h4>

            <StepsEditor
              ramo={ramo} sectionKey="comuns" steps={getComunsSteps(tpl)} patch={patch}
              label="➤ Etapas antes da definição do caminho (inclui a Vistoria — pode reordenar)"
              highlight
            />
            {["parcial", "integral"].map((caminho) => (
              <StepsEditor
                key={caminho} ramo={ramo} sectionKey={caminho} steps={tpl[caminho] || []} patch={patch}
                label={caminho === "parcial" ? "➤ Perda Parcial" : "➤ Perda Integral"}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Cada ação lê o template mais recente dentro do próprio updater do
// saveConfig (via patch(), que já recebe o `cur` fresco) e identifica a
// etapa por id, não por posição — evita perder uma edição concorrente de
// outro usuário no mesmo ramo.
function StepsEditor({ ramo, sectionKey, steps, patch, label, highlight }) {
  const [novaEtapa, setNovaEtapa] = useState("");

  function patchStep(stepId, patchFn) {
    patch(ramo, (t) => ({ ...t, [sectionKey]: (t[sectionKey] || getFallback(t)).map((s) => (s.id === stepId ? patchFn(s) : s)) }));
  }
  function getFallback(t) { return sectionKey === "comuns" ? getComunsSteps(t) : (t[sectionKey] || []); }
  function excluirEtapa(stepId) {
    patch(ramo, (t) => ({ ...t, [sectionKey]: getFallback(t).filter((s) => s.id !== stepId) }));
  }
  function moverEtapa(stepId, dir) {
    patch(ramo, (t) => {
      const arr = getFallback(t).slice();
      const idx = arr.findIndex((s) => s.id === stepId);
      const novoIdx = idx + dir;
      if (idx < 0 || novoIdx < 0 || novoIdx >= arr.length) return t;
      const copia = arr.slice();
      const [item] = copia.splice(idx, 1);
      copia.splice(novoIdx, 0, item);
      return { ...t, [sectionKey]: copia };
    });
  }
  function setTitulo(stepId, title) { patchStep(stepId, (s) => ({ ...s, title })); }
  function setStatusOptions(stepId, opts) { patchStep(stepId, (s) => ({ ...s, statusOptions: opts })); }
  function adicionarEtapa() {
    const v = novaEtapa.trim();
    if (!v) return;
    patch(ramo, (t) => ({ ...t, [sectionKey]: [...getFallback(t), { id: uid("st"), title: v, statusOptions: [...STATUS_DEFAULT] }] }));
    setNovaEtapa("");
  }

  return (
    <div style={highlight ? { background: "rgba(var(--brand-rgb),.08)", border: "1px solid rgba(var(--brand-rgb),.28)", borderRadius: 8, padding: 10, marginBottom: 12 } : undefined}>
      <div style={{ fontWeight: 600, margin: "8px 0", color: "var(--brand)" }}>{label}</div>
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
      <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "4px 0 12px" }}>
        <input className="inline" placeholder="Nova etapa..." style={{ minWidth: 180 }} value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)} />
        <button className="btn sec xs" onClick={adicionarEtapa}>+ Etapa</button>
      </div>
    </div>
  );
}

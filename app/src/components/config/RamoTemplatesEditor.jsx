import { useState } from "react";
import { StatusChipsEditor } from "./StatusChipsEditor.jsx";
import { defaultRamoTemplate, STATUS_DEFAULT } from "../../logic/claims";
import { EmptyState } from "../EmptyState.jsx";
import { uid } from "../../logic/format";

// Porte 1:1 do editor "Jornadas por ramo" das Configurações do HTML original.
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
    patch(r, (tpl) => ({ ...tpl, vistoriaStatus: tpl.vistoriaStatus || [...STATUS_DEFAULT] }));
    setNovoRamo("");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Jornadas por ramo</h3>
      <p className="muted">Defina as etapas e os status de cada caminho (Perda Parcial / Perda Integral). Mudanças aparecem automaticamente em todos os sinistros do ramo.</p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input className="inline" placeholder="Ex.: RESI, VIDA..." style={{ minWidth: 160 }} value={novoRamo} onChange={(e) => setNovoRamo(e.target.value)} />
        <button className="btn sec sm" onClick={adicionarRamo}>+ Adicionar ramo</button>
      </div>

      {!ramos.length && <EmptyState>Nenhum ramo ainda. Sincronize os sinistros ou adicione um ramo manualmente.</EmptyState>}

      {ramos.map((ramo) => {
        const tpl = templates[ramo];
        const vistoriaStatus = tpl.vistoriaStatus || STATUS_DEFAULT;
        return (
          <div key={ramo} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <h4 style={{ margin: "0 0 10px" }}>Ramo: {ramo}</h4>

            <div style={{ background: "rgba(var(--brand-rgb),.08)", border: "1px solid rgba(var(--brand-rgb),.28)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: "var(--brand)", marginBottom: 8 }}>➤ Vistoria (etapa fixa) — status</div>
              <StatusChipsEditor options={vistoriaStatus} onChange={(next) => patch(ramo, (t) => ({ ...t, vistoriaStatus: next }))} />
            </div>

            {["parcial", "integral"].map((caminho) => (
              <CaminhoEditor key={caminho} ramo={ramo} caminho={caminho} steps={tpl[caminho] || []} patch={patch} />
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
function CaminhoEditor({ ramo, caminho, steps, patch }) {
  const [novaEtapa, setNovaEtapa] = useState("");

  function patchStep(stepId, patchFn) {
    patch(ramo, (t) => ({ ...t, [caminho]: (t[caminho] || []).map((s) => (s.id === stepId ? patchFn(s) : s)) }));
  }
  function excluirEtapa(stepId) {
    patch(ramo, (t) => ({ ...t, [caminho]: (t[caminho] || []).filter((s) => s.id !== stepId) }));
  }
  function setTitulo(stepId, title) { patchStep(stepId, (s) => ({ ...s, title })); }
  function setStatusOptions(stepId, opts) { patchStep(stepId, (s) => ({ ...s, statusOptions: opts })); }
  function adicionarEtapa() {
    const v = novaEtapa.trim();
    if (!v) return;
    patch(ramo, (t) => ({ ...t, [caminho]: [...(t[caminho] || []), { id: uid("st"), title: v, statusOptions: [...STATUS_DEFAULT] }] }));
    setNovaEtapa("");
  }

  return (
    <div>
      <div style={{ fontWeight: 600, margin: "8px 0", color: "var(--brand)" }}>{caminho === "parcial" ? "➤ Perda Parcial" : "➤ Perda Integral"}</div>
      {steps.map((step) => (
        <div key={step.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
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

import { useState } from "react";
import { StepsEditor } from "./StepsEditor.jsx";
import { defaultRamoTemplate, getComunsSteps } from "../../logic/claims";
import { EmptyState } from "../EmptyState.jsx";

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
              steps={getComunsSteps(tpl)}
              onChange={(next) => patch(ramo, (t) => ({ ...t, comuns: next }))}
              label="➤ Etapas antes da definição do caminho (inclui a Vistoria — pode reordenar)"
              highlight
            />
            {["parcial", "integral"].map((caminho) => (
              <StepsEditor
                key={caminho}
                steps={tpl[caminho] || []}
                onChange={(next) => patch(ramo, (t) => ({ ...t, [caminho]: next }))}
                label={caminho === "parcial" ? "➤ Perda Parcial" : "➤ Perda Integral"}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

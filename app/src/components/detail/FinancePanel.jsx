import { useEffect, useState } from "react";
import { getFinance } from "../../logic/claims";

const CAMPOS = [
  ["valavi", "Valor avaliado", "number"],
  ["valind", "Valor indenizado", "number"],
  ["valdes", "Valor descontado", "number"],
  ["franquia", "Franquia", "number"],
  ["datlib", "Data de liberação", "date"],
];

// Porte 1:1 de financePanel() do HTML original. Usa um rascunho local (só
// re-sincroniza ao trocar de sinistro) pra não apagar o que você está
// digitando se uma sincronização remota chegar enquanto edita.
export function FinancePanel({ c, overrides, actions, canEdit }) {
  const [draft, setDraft] = useState(() => getFinance(overrides, c.id));
  useEffect(() => { setDraft(getFinance(overrides, c.id)); }, [c.id]);

  function eff(key) { return draft[key] != null && draft[key] !== "" ? draft[key] : c[key]; }
  function handleChange(key, value) { setDraft((d) => ({ ...d, [key]: value })); }
  function commit(key, value) {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    const next = { ...draft, [key]: value };
    setDraft(next);
    actions.saveFinance(c.id, next);
  }
  function restaurar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    setDraft({});
    actions.saveFinance(c.id, {});
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Financeiro</h3>
        <span className="tag-manual">Edições preservadas na sincronização</span>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>Você pode editar todos os valores. O que você digitar prevalece sobre o dado da API e não se perde ao sincronizar.</p>
      <div className="grid c2">
        {CAMPOS.map(([key, label, type]) => {
          const editado = draft[key] != null && draft[key] !== "";
          return (
            <div className="field" key={key}>
              <label>{label} {editado && <span className="tag-manual">editado</span>}</label>
              <input type={type} value={eff(key) || ""} onChange={(e) => handleChange(key, e.target.value)} onBlur={(e) => commit(key, e.target.value)} />
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 6 }}>
        <button className="btn sec sm" onClick={restaurar}>Restaurar valores da API</button>
      </div>
    </div>
  );
}

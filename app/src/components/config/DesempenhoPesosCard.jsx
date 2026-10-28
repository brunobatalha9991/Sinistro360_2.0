import { useState } from "react";
import { PILARES, PESOS_DEFAULT, pesosDesempenho } from "../../logic/desempenhoPainel";

// Pesos dos pilares do Índice de Desempenho (logic/desempenhoPainel.js) —
// config.corp_desempenho_pesos. Peso 0 tira o pilar do índice.
export function DesempenhoPesosCard({ config, saveConfig, canEdit }) {
  const [pesos, setPesos] = useState(() => pesosDesempenho(config));
  const [status, setStatus] = useState(null);
  const total = PILARES.reduce((s, p) => s + (Number(pesos[p.key]) || 0), 0);

  function salvar() {
    if (!canEdit) { alert("Apenas administradores podem alterar os pesos."); return; }
    if (total <= 0) { alert("Pelo menos um pilar precisa ter peso maior que zero."); return; }
    const limpo = {};
    PILARES.forEach((p) => { limpo[p.key] = Math.max(0, Number(pesos[p.key]) || 0); });
    saveConfig("corp_desempenho_pesos", limpo);
    setStatus("Salvo.");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Pesos do Índice de Desempenho</h3>
      <p className="muted">
        O índice (0–100) é a média ponderada dos pilares abaixo. Pilar sem dados no período (ex.: operador sem agenda) fica de fora e os demais são reponderados. Peso 0 desliga o pilar.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
        {PILARES.map((p) => (
          <label key={p.key} className="stat-box" style={{ display: "flex", flexDirection: "column", gap: 6, margin: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{p.icone} {p.label}</span>
            <span className="muted" style={{ fontSize: 11.5 }}>{p.desc}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min={0} max={100} style={{ width: 80 }} value={pesos[p.key]} onChange={(e) => { setPesos((x) => ({ ...x, [p.key]: e.target.value })); setStatus(null); }} />
              <span className="muted" style={{ fontSize: 12 }}>{total > 0 ? Math.round(((Number(pesos[p.key]) || 0) / total) * 100) : 0}% do índice</span>
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn sm" onClick={salvar}>Salvar pesos</button>
        <button className="btn sec sm" onClick={() => { setPesos({ ...PESOS_DEFAULT }); setStatus(null); }}>Voltar ao padrão</button>
      </div>
      {status && <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{status}</p>}
    </div>
  );
}

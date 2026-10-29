import { useState } from "react";
import { PILARES, PESOS_DEFAULT, pesosDesempenho } from "../../logic/desempenhoPainel";
import { desempenhoCfg, DESEMPENHO_CFG_DEFAULT } from "../../logic/desempenhoEntrega";

// Pesos dos pilares do Índice de Desempenho (logic/desempenhoPainel.js) —
// config.corp_desempenho_pesos. Peso 0 tira o pilar do índice. Também os
// parâmetros da v4 (config.corp_desempenho_cfg): tolerância de chegada e
// meta mínima diária de processos atuados.
export function DesempenhoPesosCard({ config, saveConfig, canEdit }) {
  const [pesos, setPesos] = useState(() => pesosDesempenho(config));
  const [cfg, setCfg] = useState(() => desempenhoCfg(config));
  const [status, setStatus] = useState(null);
  const total = PILARES.reduce((s, p) => s + (Number(pesos[p.key]) || 0), 0);
  const salvosAntigos = !!(config && config.corp_desempenho_pesos && config.corp_desempenho_pesos.entrega == null);

  function salvar() {
    if (!canEdit) { alert("Apenas administradores podem alterar os pesos."); return; }
    if (total <= 0) { alert("Pelo menos um pilar precisa ter peso maior que zero."); return; }
    const limpo = {};
    PILARES.forEach((p) => { limpo[p.key] = Math.max(0, Number(pesos[p.key]) || 0); });
    saveConfig("corp_desempenho_pesos", limpo);
    saveConfig("corp_desempenho_cfg", {
      toleranciaChegadaMin: Math.max(0, Math.round(Number(cfg.toleranciaChegadaMin) || 0)),
      metaMinimaDiaria: Math.max(0, Math.round(Number(cfg.metaMinimaDiaria) || 0)),
    });
    setStatus("Salvo.");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Pesos do Índice de Desempenho</h3>
      <p className="muted">
        O índice (0–100) é a média ponderada dos pilares abaixo, menos o desconto das pendências de agora (proporcional à carteira) e mais os ganhos do dia. Pilar sem dados no período (ex.: operador sem agenda) fica de fora e os demais são reponderados. Peso 0 desliga o pilar.
      </p>
      {salvosAntigos && (
        <p style={{ fontSize: 12.5, color: "var(--warn, #b45309)" }}>
          Os pesos salvos antes eram da fórmula anterior (sem Entrega e Produção) e estão sendo ignorados — o índice usa o padrão abaixo até você salvar.
        </p>
      )}
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
      <h4 style={{ margin: "16px 0 8px" }}>Parâmetros</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        <label className="stat-box" style={{ display: "flex", flexDirection: "column", gap: 6, margin: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>⏰ Tolerância de chegada (min)</span>
          <span className="muted" style={{ fontSize: 11.5 }}>Conta como "no horário" o 1º acesso do dia até o início do expediente + este tempo.</span>
          <input type="number" min={0} max={120} style={{ width: 80 }} value={cfg.toleranciaChegadaMin} onChange={(e) => { setCfg((x) => ({ ...x, toleranciaChegadaMin: e.target.value })); setStatus(null); }} />
        </label>
        <label className="stat-box" style={{ display: "flex", flexDirection: "column", gap: 6, margin: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>⚙️ Meta mínima diária de processos</span>
          <span className="muted" style={{ fontSize: 11.5 }}>A meta de Produção é a carteira ÷ 3 (cada processo atualizado a cada 3 dias), nunca abaixo deste número.</span>
          <input type="number" min={0} max={200} style={{ width: 80 }} value={cfg.metaMinimaDiaria} onChange={(e) => { setCfg((x) => ({ ...x, metaMinimaDiaria: e.target.value })); setStatus(null); }} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn sm" onClick={salvar}>Salvar pesos e parâmetros</button>
        <button className="btn sec sm" onClick={() => { setPesos({ ...PESOS_DEFAULT }); setCfg({ ...DESEMPENHO_CFG_DEFAULT }); setStatus(null); }}>Voltar ao padrão</button>
      </div>
      {status && <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{status}</p>}
    </div>
  );
}

import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { fmtPct } from "../../logic/agenda";

// "O que tinha para fazer × o que foi feito" (ver logic/desempenhoEntrega.js).
const STATUS = {
  pendente: { label: "Pendente", badge: "red", icone: "⏳" },
  parcial: { label: "Atualizado sem histórico (½)", badge: "amber", icone: "🟡" },
  feito: { label: "Tratado com histórico", badge: "green", icone: "✅" },
  outro: { label: "Tratado por outro usuário", badge: "gray", icone: "👥" },
};
function fmtHora(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtData(d) { return d.slice(8, 10) + "/" + d.slice(5, 7); }

export function DemandaDiaCard({ dia, periodo, navigate }) {
  const [filtro, setFiltro] = useState("todos");
  const [verTodos, setVerTodos] = useState(false);
  if (!dia) return null;
  const lista = dia.itens.filter((i) => filtro === "todos" || i.status === filtro);
  const visiveis = verTodos ? lista : lista.slice(0, 15);
  const taxa = dia.esperado > 0 ? Math.min(1, dia.pesoFeito / dia.esperado) : null;
  const tratadoPct = dia.devidos ? dia.pesoFeito / dia.devidos : null;
  const dias = periodo && periodo.dias.length > 1 ? periodo.dias.slice().reverse() : null;

  return (
    <div className="card">
      <div className="secao-topo">
        <h3>📋 Demanda de hoje — o que tinha para fazer × o que foi feito</h3>
        <span className="muted" style={{ fontSize: 12 }}>como estava às 00h: carteira de {dia.carteira} processo(s)</span>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        Entra na demanda o processo da carteira com <b>próxima ação vencida ou vencendo hoje</b> e/ou <b>sem atualização há mais de 3 dias</b>.
        Só conta como tratado o que o próprio usuário fez hoje; atualização sem histórico vale metade. Expediente já passado: {Math.round(dia.progresso * 100)}%.
      </p>
      <div className="chips" style={{ alignItems: "center" }}>
        <span className="badge blue">Tinha para fazer: {dia.itens.length}</span>
        <span className="badge green">✅ Com histórico: {dia.feitos}</span>
        <span className="badge amber">🟡 Sem histórico: {dia.parciais}</span>
        {dia.porOutro > 0 && <span className="badge gray">👥 Por outro: {dia.porOutro}</span>}
        <span className="badge red">⏳ Pendentes: {dia.pendentes}</span>
        <span className="badge purple" title="Processos diferentes em que atuou hoje, contra a meta do dia (carteira ÷ 3, com mínimo)">⚙️ Atuou em {dia.atuados} processo(s) • meta {Math.ceil(dia.meta)}</span>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "6px 0 10px", fontSize: 13 }}>
        <span>Tratado do total: <b>{fmtPct(tratadoPct)}</b></span>
        <span title="Comparado com o esperado para a hora do dia">Entrega no ritmo do expediente: <b>{fmtPct(taxa)}</b></span>
      </div>
      <div className="chips">
        {[["todos", "Todos"], ["pendente", "Pendentes"], ["parcial", "Sem histórico"], ["feito", "Com histórico"], ["outro", "Por outro"]].map(([k, l]) => (
          <div key={k} className={"chip-btn" + (filtro === k ? " active" : "")} onClick={() => setFiltro(k)}>{l}</div>
        ))}
      </div>
      {!lista.length ? <EmptyState>{dia.itens.length ? "Nada neste filtro." : "Nenhum processo da carteira estava vencido ou sem atualização no início do dia. 🎯"}</EmptyState> : (
        <div className="fila-lista">
          {visiveis.map((i) => {
            const s = STATUS[i.status];
            return (
              <button key={i.claimId} type="button" className="fila-item demanda" onClick={() => navigate(...i.rota)}>
                <span className="fila-icone">{s.icone}</span>
                <span className="fila-txt">
                  <b>{i.titulo}</b>
                  <span>{i.motivos.map((m) => m.texto).join(" • ")}{i.em ? ` • ${s.label.toLowerCase()} às ${fmtHora(i.em)}` : ""}</span>
                </span>
                <span className={"badge " + s.badge} style={{ flexShrink: 0 }}>{s.label}</span>
                <span className="fila-ir">→</span>
              </button>
            );
          })}
        </div>
      )}
      {lista.length > 15 && <button className="btn ghost xs" style={{ marginTop: 8 }} onClick={() => setVerTodos((v) => !v)}>{verTodos ? "Mostrar menos" : `Ver todos (${lista.length})`}</button>}

      {dias && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Dia a dia no período ({dias.length} dia(s) útil(eis){periodo.truncado ? " — últimos 31" : ""})</summary>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ marginTop: 8, fontSize: 12.5 }}>
              <thead><tr><th>Dia</th><th>Carteira</th><th>Tinha para fazer</th><th>Com histórico</th><th>Sem histórico</th><th>Por outro</th><th>Pendentes</th><th>Tratado</th><th>Atuou em</th><th>Meta</th></tr></thead>
              <tbody>
                {dias.map((d) => (
                  <tr key={d.data}>
                    <td>{fmtData(d.data)}</td><td>{d.carteira}</td><td>{d.itens.length}</td><td>{d.feitos}</td><td>{d.parciais}</td><td>{d.porOutro}</td><td>{d.pendentes}</td>
                    <td><b>{fmtPct(d.devidos ? d.pesoFeito / d.devidos : null)}</b></td><td>{d.atuados}</td><td>{Math.ceil(d.meta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

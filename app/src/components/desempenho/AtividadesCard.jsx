import { useMemo, useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { GRUPOS_ATIVIDADE } from "../../logic/desempenhoAtividades";

// Tudo o que o usuário fez no período, com vínculo para o processo/CI
// (ver logic/desempenhoAtividades.js).
const LIMITE = 200;
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function fmtHora(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDia(d) {
  const dt = new Date(d + "T12:00:00");
  return `${DIAS[dt.getDay()]}, ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

export function AtividadesCard({ atividades, periodoLabel, navigate, grupoFixo, titulo }) {
  const [grupo, setGrupo] = useState(grupoFixo || "todos");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(LIMITE);

  const contagem = useMemo(() => {
    const c = {};
    (atividades || []).forEach((a) => { c[a.grupo] = (c[a.grupo] || 0) + 1; });
    return c;
  }, [atividades]);
  const alvos = useMemo(() => new Set((atividades || []).filter((a) => a.grupo !== "agenda").map((a) => a.alvo)).size, [atividades]);

  const q = busca.trim().toLowerCase();
  const lista = (atividades || [])
    .filter((a) => grupo === "todos" || a.grupo === grupo)
    .filter((a) => !q || `${a.titulo} ${a.detalhe} ${a.alvo}`.toLowerCase().includes(q));
  const visiveis = lista.slice(0, limite);
  const porDia = [];
  visiveis.forEach((a) => {
    const ult = porDia[porDia.length - 1];
    if (ult && ult.data === a.data) ult.itens.push(a); else porDia.push({ data: a.data, itens: [a] });
  });

  return (
    <div className="card">
      <div className="secao-topo">
        <h3>{titulo || `🧾 O que foi feito (${periodoLabel})`}</h3>
        <span className="muted" style={{ fontSize: 12 }}>{(atividades || []).length} registro(s){!grupoFixo ? ` em ${alvos} processo(s)/CI(s)` : ""} • clique para abrir</span>
      </div>
      {!grupoFixo && (
        <div className="chips" style={{ alignItems: "center" }}>
          <div className={"chip-btn" + (grupo === "todos" ? " active" : "")} onClick={() => setGrupo("todos")}>Tudo ({(atividades || []).length})</div>
          {GRUPOS_ATIVIDADE.filter((g) => contagem[g.key]).map((g) => (
            <div key={g.key} className={"chip-btn" + (grupo === g.key ? " active" : "")} onClick={() => setGrupo(g.key)}>{g.icone} {g.label} ({contagem[g.key]})</div>
          ))}
          <input className="inline" placeholder="Buscar (segurado, sinistro, CI, texto)..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ minWidth: 220, flex: 1 }} />
        </div>
      )}
      {!lista.length ? <EmptyState>Nenhuma atividade registrada {grupo === "todos" && !q ? "no período" : "neste filtro"}.</EmptyState> : (
        <div className="atividades-lista">
          {porDia.map((d) => (
            <div key={d.data} style={{ marginBottom: 10 }}>
              <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", margin: "8px 0 4px" }}>{fmtDia(d.data)} • {d.itens.length}</div>
              <div className="fila-lista">
              {d.itens.map((a, i) => (
                <button key={a.at + i} type="button" className="fila-item atividade" onClick={() => navigate(...a.rota)} title="Abrir">
                  <span className="mono muted" style={{ fontSize: 11.5 }}>{fmtHora(a.at)}</span>
                  <span className="fila-icone">{a.icone}</span>
                  <span className="fila-txt">
                    <b>{a.titulo}</b>
                    <span>{a.alvo}{a.detalhe ? ` — ${a.detalhe}` : ""}</span>
                  </span>
                  <span className="fila-ir">→</span>
                </button>
              ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {lista.length > limite && <button className="btn ghost xs" onClick={() => setLimite((n) => n + LIMITE)}>Mostrar mais ({lista.length - limite} restantes)</button>}
    </div>
  );
}

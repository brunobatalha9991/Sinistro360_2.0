import { Avatar } from "../Avatar.jsx";
import { ScoreRing } from "./PainelVisual.jsx";
import { PILARES, nivelDoScore } from "../../logic/desempenhoPainel";
import { fmtPct } from "../../logic/agenda";
import { fmtCronometro } from "../../logic/roteiroDia";

// Visão do gestor (Admin/VIP) no Desempenho v3: placar da equipe, ranking
// pelo Índice, mapa de calor dos pilares e o que cada um está fazendo agora.

function nivelPct(v) {
  if (v == null) return "sem_dados";
  const p = v * 100;
  return p >= 85 ? "excelente" : p >= 70 ? "bom" : p >= 50 ? "atencao" : "critico";
}

export function EquipeView({ linhas, t, navigate, periodoLabel }) {
  const comScore = linhas.filter((l) => l.indice.score != null);
  const media = comScore.length ? Math.round(comScore.reduce((s, l) => s + l.indice.score, 0) / comScore.length) : null;
  const nivelMedia = nivelDoScore(media);
  const ranking = [...linhas].sort((a, b) => (b.indice.score ?? -1) - (a.indice.score ?? -1));
  const tot = (f) => linhas.reduce((s, l) => s + (f(l) || 0), 0);

  const alertas = [];
  linhas.forEach((l) => {
    if (l.ex.proximaVencida) alertas.push({ k: l.u.id + "pv", u: l.u, txt: `${l.ex.proximaVencida} próxima(s) ação(ões) vencida(s)`, nv: "critico" });
    if (l.ci && l.ci.paradas24h) alertas.push({ k: l.u.id + "ci", u: l.u, txt: `${l.ci.paradas24h} CI(s) parada(s) há +24h`, nv: "atencao" });
    if (l.ci && l.ci.intervPendentes) alertas.push({ k: l.u.id + "iv", u: l.u, txt: `${l.ci.intervPendentes} intervenção(ões) sem resposta`, nv: "critico" });
    if (l.roteiro && (l.roteiro.estado === "estourada" || l.roteiro.estado === "atrasada")) alertas.push({ k: l.u.id + "ag", u: l.u, txt: l.roteiro.estado === "atrasada" ? `não iniciou "${l.roteiro.atual.oc.titulo}"` : `"${l.roteiro.atual.oc.titulo}" passou do horário`, nv: "atencao" });
    if (l.conduta && l.conduta.pendentesCiente) alertas.push({ k: l.u.id + "cd", u: l.u, txt: `${l.conduta.pendentesCiente} registro(s) sem ciente`, nv: "atencao" });
  });

  return (
    <div className="equipe-view">
      <div className={"equipe-hero nivel-" + nivelMedia.key}>
        <div className="desemp-hero-brilho" />
        <div className="equipe-hero-score">
          <ScoreRing score={media} nivel={nivelMedia} size={140} espessura={12} claro />
          <div>
            <div className="desemp-hero-saud">Equipe operacional • {periodoLabel}</div>
            <h1 className="desemp-hero-nome">Índice médio da equipe</h1>
            <div className="desemp-hero-data">{linhas.length} operador(es) • {comScore.filter((l) => l.indice.score >= 85).length} excelente(s) • {comScore.filter((l) => l.indice.score < 50).length} crítico(s)</div>
          </div>
        </div>
        <div className="equipe-hero-kpis">
          <div><b>{tot((l) => l.ex.estoque)}</b><span>processos na carteira</span></div>
          <div className={tot((l) => l.ex.proximaVencida) ? "neg" : ""}><b>{tot((l) => l.ex.proximaVencida)}</b><span>próximas ações vencidas</span></div>
          <div><b>{tot((l) => l.ex.proximaHoje)}</b><span>próximas ações hoje</span></div>
          <div><b>{tot((l) => l.m.finalizadosNoPeriodo)}</b><span>finalizados no período</span></div>
          <div className={tot((l) => l.ci && l.ci.foraPrazo) ? "neg" : ""}><b>{tot((l) => l.ci && l.ci.foraPrazo)}</b><span>CIs respondidas fora do prazo</span></div>
          <div><b>{linhas.filter((l) => l.roteiro && l.roteiro.atual && l.roteiro.atual.status === "em_andamento").length}</b><span>em ação na agenda agora</span></div>
        </div>
      </div>

      <div className="grid c2 equipe-cols">
        <div className="card">
          <div className="secao-topo"><h3>🏁 Ranking pelo Índice</h3><span className="muted" style={{ fontSize: 12 }}>clique para abrir o painel</span></div>
          <div className="ranking-lista">
            {ranking.map((l, i) => {
              const a = l.roteiro && l.roteiro.atual;
              return (
                <button key={l.u.id} type="button" className={"ranking-item" + (i < 3 && l.indice.score != null ? " podio p" + (i + 1) : "")} onClick={() => navigate("desempenho", l.u.id)}>
                  <span className="ranking-pos">{i < 3 && l.indice.score != null ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
                  <Avatar url={l.m.usuarioFoto} nome={l.u.nome} size={38} />
                  <span className="ranking-txt">
                    <b>{l.u.nome}</b>
                    <span>{a ? (a.status === "em_andamento" ? `▶ ${a.oc.titulo} • falta ${fmtCronometro(a.fimMs - t)}` : `⚠ não iniciou ${a.oc.titulo}`) : l.roteiro && l.roteiro.proxima ? `☕ livre • próxima ${l.roteiro.proxima.oc.inicio}` : "—"}</span>
                  </span>
                  <ScoreRing score={l.indice.score} nivel={l.indice.nivel} size={54} espessura={6} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="secao-topo"><h3>🚦 Alertas da equipe</h3><span className="muted" style={{ fontSize: 12 }}>{alertas.length || "nenhum"}</span></div>
          {!alertas.length ? <div className="fila-vazia">✅ Nenhum alerta — equipe em dia.</div> : (
            <div className="fila-lista">
              {alertas.slice(0, 12).map((a) => (
                <button key={a.k} type="button" className={"fila-item tipo-" + (a.nv === "critico" ? "vencida" : "ci")} onClick={() => navigate("desempenho", a.u.id)}>
                  <span className="fila-pos" />
                  <span className="fila-icone">{a.nv === "critico" ? "🚨" : "⚠️"}</span>
                  <span className="fila-txt"><b>{a.u.nome}</b><span>{a.txt}</span></span>
                  <span className="fila-ir">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="secao-topo"><h3>🌡 Mapa de calor por pilar</h3><span className="muted" style={{ fontSize: 12 }}>0–100 • 🏆 ≥85 • 👍 ≥70 • ⚠️ ≥50 • 🚨 abaixo</span></div>
        <div style={{ overflow: "auto" }}>
          <table className="heatmap">
            <thead>
              <tr>
                <th>Operador</th>
                <th>Índice</th>
                {PILARES.map((p) => <th key={p.key} title={p.desc}>{p.icone} {p.label}</th>)}
                <th>Carteira</th>
                <th>Vencidas</th>
                <th>CI no prazo</th>
                <th>Agenda</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((l) => (
                <tr key={l.u.id} onClick={() => navigate("desempenho", l.u.id)} style={{ cursor: "pointer" }}>
                  <td><b>{l.u.nome}</b></td>
                  <td className={"hm nivel-" + l.indice.nivel.key} title={l.indice.baseParcial ? "Base parcial: poucos pilares com dados no período" : undefined}>{l.indice.score ?? "—"}{l.indice.baseParcial ? " ⓘ" : ""}</td>
                  {l.indice.pilares.map((p) => (
                    <td key={p.key} className={"hm nivel-" + nivelPct(p.valor)} title={p.componentes.map((c) => `${c.label}: ${c.valor == null ? "—" : fmtPct(c.valor)}`).join("\n")}>
                      {p.valor == null ? "—" : Math.round(p.valor * 100)}
                    </td>
                  ))}
                  <td className="mono">{l.ex.estoque}</td>
                  <td className="mono">{l.ex.proximaVencida ? <span className="badge red">{l.ex.proximaVencida}</span> : 0}</td>
                  <td className="mono">{l.ci ? fmtPct(l.ci.pctNoPrazo) : "—"}</td>
                  <td className="mono">{l.agenda ? fmtPct(l.agenda.taxaCumprimento) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

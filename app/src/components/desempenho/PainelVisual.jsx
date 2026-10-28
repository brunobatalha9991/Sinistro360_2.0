import { useState } from "react";
import { Avatar } from "../Avatar.jsx";
import { fmtPct } from "../../logic/agenda";
import { fmtCronometro } from "../../logic/roteiroDia";

// Peças visuais do Desempenho v3 (ver logic/desempenhoPainel.js): anel do
// índice, topo de impacto, cartões de "Hoje", fila do dia, pilares,
// evolução semanal. Cores de nível = status (sempre com ícone + rótulo).

export function ScoreRing({ score, nivel, size = 132, espessura = 12, claro }) {
  const r = (size - espessura) / 2;
  const c = 2 * Math.PI * r;
  const v = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className={"score-ring nivel-" + (nivel ? nivel.key : "sem_dados") + (claro ? " claro" : "")} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Índice ${score == null ? "sem dados" : score} — ${nivel ? nivel.label : ""}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="score-ring-trilho" strokeWidth={espessura} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} className="score-ring-valor" strokeWidth={espessura} fill="none" strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="score-ring-centro">
        <div className="score-ring-num" style={{ fontSize: size * 0.3 }}>{score == null ? "—" : score}</div>
        {size >= 100 && <div className="score-ring-rot">{nivel ? `${nivel.icone} ${nivel.label}` : ""}</div>}
      </div>
    </div>
  );
}

function saudacao(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function HeroOperador({ u, foto, indice, mediaEquipe, periodoLabel, proprio, onVoltar, acoes }) {
  const diff = indice.score != null && mediaEquipe != null ? indice.score - mediaEquipe : null;
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return (
    <div className={"desemp-hero nivel-" + indice.nivel.key}>
      <div className="desemp-hero-brilho" />
      <div className="desemp-hero-id">
        <Avatar url={foto} nome={u.nome} size={64} />
        <div style={{ minWidth: 0 }}>
          <div className="desemp-hero-saud">{proprio ? `${saudacao()}, ${u.nome.split(" ")[0]}!` : "Desempenho de"}</div>
          <h1 className="desemp-hero-nome">{proprio ? "Seu desempenho" : u.nome}</h1>
          <div className="desemp-hero-data">{hoje} • período: {periodoLabel}</div>
        </div>
      </div>
      <div className="desemp-hero-score">
        <ScoreRing score={indice.score} nivel={indice.nivel} size={150} espessura={13} claro />
        <div className="desemp-hero-score-txt">
          <div className="desemp-hero-score-titulo">Índice de Desempenho</div>
          {indice.baseParcial && (
            <div className="desemp-hero-base" title="Os pilares sem dados no período ficam fora do cálculo">
              ⓘ Base parcial: só {indice.pilares.filter((p) => p.valor != null).length} de {indice.pilares.length} pilares com dados no período
            </div>
          )}
          {diff != null && (
            <div className={"desemp-hero-diff " + (diff >= 0 ? "pos" : "neg")}>
              {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)} pts {diff >= 0 ? "acima" : "abaixo"} da média da equipe ({mediaEquipe})
            </div>
          )}
          <div className="desemp-hero-pilares">
            {indice.pilares.map((p) => (
              <div key={p.key} className="desemp-hero-pilar" title={p.desc}>
                <span>{p.icone} {p.label}</span>
                <div className="desemp-hero-pilar-barra"><div style={{ width: p.valor == null ? 0 : `${Math.round(p.valor * 100)}%` }} /></div>
                <b>{p.valor == null ? "—" : Math.round(p.valor * 100)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="desemp-hero-acoes">
        {acoes}
        {onVoltar && <button className="btn sec xs" onClick={onVoltar}>← Equipe</button>}
      </div>
    </div>
  );
}

// Cartão grande clicável do "Hoje".
export function HojeTile({ icone, titulo, valor, sub, tom, onClick, extra }) {
  return (
    <button type="button" className={"hoje-tile tom-" + (tom || "neutro")} onClick={onClick} disabled={!onClick}>
      <div className="hoje-tile-topo"><span className="hoje-tile-icone">{icone}</span><span className="hoje-tile-titulo">{titulo}</span></div>
      <div className="hoje-tile-valor">{valor}</div>
      <div className="hoje-tile-sub">{sub}</div>
      {extra}
    </button>
  );
}

export function HojeGrid({ roteiro, t, ex, ciInfo, alertas, navigate }) {
  const a = roteiro && roteiro.atual;
  const p = roteiro && roteiro.progresso;
  return (
    <div className="hoje-grid">
      <HojeTile
        icone="🗓" titulo="Agenda agora" tom={!roteiro ? "neutro" : roteiro.estado === "estourada" || roteiro.estado === "atrasada" ? "alerta" : a ? "ativo" : "neutro"}
        valor={a ? (a.status === "em_andamento" ? fmtCronometro(a.fimMs - t) : "Iniciar!") : roteiro && roteiro.proxima ? roteiro.proxima.oc.inicio : "—"}
        sub={a ? `${a.oc.icone} ${a.oc.titulo}` : roteiro && roteiro.proxima ? `Próxima: ${roteiro.proxima.oc.titulo}` : "Nada mais hoje"}
        extra={p && p.total ? <div className="hoje-tile-barra"><div style={{ width: `${Math.round((p.pctConcluidas || 0) * 100)}%` }} /><span>{p.concluidas}/{p.total} ações</span></div> : null}
        onClick={() => navigate("agenda")}
      />
      <HojeTile
        icone="📂" titulo="Próximas ações" tom={ex.proximaVencida ? "critico" : ex.proximaHoje ? "alerta" : "ok"}
        valor={ex.proximaHoje + ex.proximaVencida}
        sub={`${ex.proximaHoje} para hoje • ${ex.proximaVencida} vencida(s)`}
        onClick={() => navigate("sinistros")}
      />
      <HojeTile
        icone="📨" titulo="CIs para você" tom={ciInfo.intervencoes || ciInfo.urgentes ? "critico" : ciInfo.semInteracao ? "alerta" : "ok"}
        valor={ciInfo.abertas}
        sub={`${ciInfo.urgentes} urgente(s) • ${ciInfo.semInteracao} sem sua interação${ciInfo.intervencoes ? ` • ${ciInfo.intervencoes} intervenção(ões)` : ""}`}
        onClick={() => navigate("tarefas")}
      />
      <HojeTile
        icone="🧭" titulo="Carteira" tom={alertas ? "alerta" : "ok"}
        valor={ex.estoque}
        sub={`${ex.semProximaAcao} sem próxima ação • ${ex.etapasForaPrazo} etapa(s) fora do prazo${ex.emailsPendentes ? ` • ${ex.emailsPendentes} e-mail(s) a tratar` : ""}`}
        onClick={() => navigate("sinistros")}
      />
    </div>
  );
}

export function FilaDoDiaCard({ itens, navigate }) {
  const [todos, setTodos] = useState(false);
  const lista = todos ? itens : itens.slice(0, 8);
  return (
    <div className="card fila-card">
      <div className="secao-topo">
        <h3>🎯 Minha fila de hoje</h3>
        <span className="muted" style={{ fontSize: 12 }}>{itens.length ? `${itens.length} item(ns), por prioridade` : ""}</span>
      </div>
      {!itens.length ? (
        <div className="fila-vazia">✨ Nada pendente agora — fila limpa.</div>
      ) : (
        <div className="fila-lista">
          {lista.map((it, i) => (
            <button key={it.key} type="button" className={"fila-item tipo-" + it.tipo} onClick={() => navigate(...it.rota)}>
              <span className="fila-pos">{i + 1}</span>
              <span className="fila-icone">{it.icone}</span>
              <span className="fila-txt"><b>{it.titulo}</b><span>{it.sub}</span></span>
              <span className="fila-ir">→</span>
            </button>
          ))}
        </div>
      )}
      {itens.length > 8 && <button className="btn ghost xs" style={{ marginTop: 8 }} onClick={() => setTodos((v) => !v)}>{todos ? "Mostrar menos" : `Ver todos (${itens.length})`}</button>}
    </div>
  );
}

export function PilaresCard({ indice, pesos }) {
  const [aberto, setAberto] = useState(null);
  return (
    <div className="card">
      <div className="secao-topo">
        <h3>📊 Como o índice é formado</h3>
        <span className="muted" style={{ fontSize: 12 }}>clique num pilar para ver os componentes</span>
      </div>
      <div className="pilares-grid">
        {indice.pilares.map((p) => {
          const pct = p.valor == null ? null : Math.round(p.valor * 100);
          const nv = pct == null ? "sem_dados" : pct >= 85 ? "excelente" : pct >= 70 ? "bom" : pct >= 50 ? "atencao" : "critico";
          return (
            <button key={p.key} type="button" className={"pilar nivel-" + nv + (aberto === p.key ? " aberto" : "")} onClick={() => setAberto(aberto === p.key ? null : p.key)}>
              <div className="pilar-topo"><span>{p.icone} {p.label}</span><span className="pilar-peso">peso {pesos[p.key]}</span></div>
              <div className="pilar-valor">{pct == null ? "—" : pct}<small>{pct == null ? " sem dados" : "/100"}</small></div>
              <div className="pilar-barra"><div style={{ width: `${pct || 0}%` }} /></div>
              {aberto === p.key && (
                <div className="pilar-comps">
                  <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{p.desc}</div>
                  {p.componentes.map((c) => (
                    <div key={c.label} className="pilar-comp">
                      <span>{c.label}</span>
                      <b>{c.valor == null ? "—" : fmtPct(c.valor)}</b>
                      {c.detalhe && <small>{c.detalhe}</small>}
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Mini gráfico de barras de uma série (sem legenda — o título nomeia), com
// dica ao passar o mouse e o valor da última semana em destaque.
function MiniBarras({ titulo, serie, fmt = (v) => v, maxFixo }) {
  const [hover, setHover] = useState(null);
  const vals = serie.map((s) => s.valor);
  const max = maxFixo || Math.max(1, ...vals.filter((v) => v != null));
  const ultimo = serie[serie.length - 1];
  const penultimo = serie[serie.length - 2];
  const delta = ultimo && penultimo && ultimo.valor != null && penultimo.valor != null ? ultimo.valor - penultimo.valor : null;
  const ativo = hover != null ? serie[hover] : ultimo;
  return (
    <div className="mini-chart">
      <div className="mini-chart-topo">
        <span className="mini-chart-titulo">{titulo}</span>
        <span className="mini-chart-valor">{ativo && ativo.valor != null ? fmt(ativo.valor) : "—"}
          {hover == null && delta != null && delta !== 0 && <small className={delta > 0 ? "pos" : "neg"}> {delta > 0 ? "▲" : "▼"}</small>}
        </span>
      </div>
      <div className="mini-chart-area" onMouseLeave={() => setHover(null)}>
        {serie.map((s, i) => (
          <div key={s.rotulo} className="mini-chart-col" onMouseEnter={() => setHover(i)} title={`Semana de ${s.rotulo}: ${s.valor == null ? "sem dados" : fmt(s.valor)}`}>
            <div className={"mini-chart-barra" + (i === serie.length - 1 ? " atual" : "") + (hover === i ? " hover" : "")} style={{ height: s.valor == null ? 2 : `${Math.max(3, (s.valor / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mini-chart-eixo"><span>{serie[0] && serie[0].rotulo}</span><span>{ativo ? (hover != null ? `sem. ${ativo.rotulo}` : "esta semana") : ""}</span></div>
    </div>
  );
}

export function TendenciaCard({ series }) {
  return (
    <div className="card">
      <div className="secao-topo">
        <h3>📈 Evolução — últimas 8 semanas</h3>
        <span className="muted" style={{ fontSize: 12 }}>passe o mouse nas barras</span>
      </div>
      <div className="tendencia-grid">
        <MiniBarras titulo="Históricos registrados" serie={series.historicos} />
        <MiniBarras titulo="Processos finalizados" serie={series.finalizados} />
        <MiniBarras titulo="CIs: 1ª interação no prazo" serie={series.ciNoPrazo} fmt={fmtPct} maxFixo={1} />
        <MiniBarras titulo="Cumprimento da agenda" serie={series.agenda} fmt={fmtPct} maxFixo={1} />
      </div>
    </div>
  );
}

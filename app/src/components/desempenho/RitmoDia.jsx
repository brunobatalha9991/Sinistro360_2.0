import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { dataLocalISO, fmtDataBRCurta, fmtHoraDe } from "../../logic/agenda";
import { nivelDoScore } from "../../logic/desempenhoPainel";
import { FAIXAS_ATRASO, PONTOS_PENDENTE, PONTOS_INTERVENCAO, IMPACTO_MAX, BONUS_MAX, REGRAS_GANHO, resumoRitmo, idRitmo, idFechamento } from "../../logic/desempenhoRitmo";
import { imprimirHtml } from "../../logic/solicitacaoPdf";

// Relatório "Ritmo do dia" e impacto das pendências no Desempenho (ver
// logic/desempenhoRitmo.js).

const NIVEL_LABEL = { excelente: "Excelente", bom: "Bom", atencao: "Atenção", critico: "Crítico" };
function sinal(n) { return n == null ? "—" : n > 0 ? `+${n}` : String(n); }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// ---------- balanço do índice (perdas × ganhos) ----------
function ItemBalanco({ icone, titulo, sub, pts, sinalPts, status, onClick }) {
  return (
    <button type="button" className={"impacto-item " + (status || "")} onClick={onClick} disabled={!onClick}>
      <span className="impacto-ico">{icone}</span>
      <span className="impacto-txt"><b>{titulo}</b>{sub && <small>{sub}</small>}</span>
      {status === "atrasada" || status === "pendente"
        ? <span className={"badge " + (status === "atrasada" ? "red" : "amber")}>{status === "atrasada" ? "Atrasada" : "Pendente"}</span>
        : <span />}
      <span className={"impacto-pts" + (sinalPts === "+" ? " ganho" : "")}>{sinalPts}{pts}</span>
    </button>
  );
}

export function BalancoCard({ indice, navigate }) {
  const imp = indice.impacto;
  const gan = indice.ganhos;
  const [aba, setAba] = useState("ganhos");
  if (!imp && !gan) return null;
  const perdas = imp ? Math.round(imp.pontos * 10) / 10 : 0;
  const ganhos = gan ? Math.round(gan.pontos * 10) / 10 : 0;
  const ir = (rota) => (navigate && rota ? () => navigate(...rota) : null);
  return (
    <div className="card">
      <div className="secao-topo">
        <h3>⚖️ Balanço do índice — hoje</h3>
        <span className="muted" style={{ fontSize: 12 }}>zera à meia-noite</span>
      </div>
      <div className="balanco-conta">
        <div><small>Pilares (30 dias)</small><b>{indice.scoreBase ?? "—"}</b></div>
        <span className="balanco-op">−</span>
        <div className="neg"><small>Pendências agora</small><b>{perdas}</b></div>
        <span className="balanco-op">+</span>
        <div className="pos"><small>Ganhos de hoje</small><b>{ganhos}</b></div>
        <span className="balanco-op">=</span>
        <div className="final"><small>Índice final</small><b>{indice.score ?? "—"}</b></div>
      </div>
      <div className="tabs" style={{ marginBottom: 10 }}>
        <button type="button" className={"tab" + (aba === "ganhos" ? " active" : "")} onClick={() => setAba("ganhos")}>➕ Somando ({gan ? gan.itens.length : 0})</button>
        <button type="button" className={"tab" + (aba === "perdas" ? " active" : "")} onClick={() => setAba("perdas")}>➖ Tirando ({imp ? imp.itens.length : 0})</button>
        <button type="button" className={"tab" + (aba === "subir" ? " active" : "")} onClick={() => setAba("subir")}>🚀 Como subir ({gan ? gan.oportunidades.length : 0})</button>
      </div>

      {aba === "ganhos" && (!gan || !gan.itens.length ? <EmptyState>Nenhum ganho ainda hoje — veja "Como subir".</EmptyState> : (
        <div className="impacto-lista">
          {gan.itens.map((g) => (
            <ItemBalanco key={g.key} icone={g.icone} titulo={g.titulo} sub={`${g.detalhe}${g.pontos >= g.teto ? " • teto atingido" : ""}`} pts={g.pontos} sinalPts="+" />
          ))}
          {gan.pontosBrutos > gan.pontos && <p className="muted" style={{ fontSize: 12 }}>Somando tudo daria +{gan.pontosBrutos}; o ganho do dia vai até +{BONUS_MAX}.</p>}
        </div>
      ))}

      {aba === "perdas" && (!imp || !imp.itens.length ? <EmptyState>Nenhuma pendência tirando pontos agora. 🎯</EmptyState> : (
        <div className="impacto-lista">
          {imp.itens.map((i) => (
            <ItemBalanco key={i.key} icone={i.icone} titulo={i.titulo} sub={i.sub} pts={i.pontos} sinalPts="−" status={i.status} onClick={ir(i.rota)} />
          ))}
          {imp.pontosBrutos > imp.pontos && <p className="muted" style={{ fontSize: 12 }}>Somando tudo daria −{imp.pontosBrutos}; o desconto vai até −{IMPACTO_MAX}.</p>}
        </div>
      ))}

      {aba === "subir" && (!gan || !gan.oportunidades.length ? <EmptyState>Tudo no teto por hoje. 🏆</EmptyState> : (
        <div className="impacto-lista">
          {gan.oportunidades.map((o) => (
            <ItemBalanco key={o.key} icone={o.icone} titulo={o.texto} sub={o.rota ? "devolve o desconto + 50% de bônus (com histórico registrado hoje)" : "até o teto do dia"} pts={o.ganho} sinalPts="+" onClick={ir(o.rota)} />
          ))}
        </div>
      ))}

      <details className="balanco-regras">
        <summary>Regras de pontuação</summary>
        <div className="balanco-regras-grid">
          <div>
            <b>➖ Tiram pontos</b>
            <ul>
              {FAIXAS_ATRASO.map((f) => <li key={f.rotulo}>Atraso de {f.rotulo}: −{f.pontos}</li>)}
              <li>Pendente de hoje: −{PONTOS_PENDENTE} (vira atraso no fim do expediente)</li>
              <li>Intervenção sem resposta: −{PONTOS_INTERVENCAO}</li>
              <li>CI urgente atrasada: −1 extra</li>
              <li>Teto: −{IMPACTO_MAX}</li>
            </ul>
          </div>
          <div>
            <b>➕ Somam pontos</b>
            <ul>
              {REGRAS_GANHO.map((r) => <li key={r.key}>{r.icone} {r.label}: {r.pts != null ? `+${r.pts} cada` : "variável"} (até +{r.max})</li>)}
              <li>Teto do dia: +{BONUS_MAX}</li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}

// ---------- gráfico do dia ----------
function Sparkline({ pontos, altura = 56 }) {
  const vals = (pontos || []).filter((p) => p.score != null);
  if (vals.length < 2) return <div className="muted" style={{ fontSize: 12 }}>{vals.length ? `Uma foto até agora (índice ${vals[0].score}).` : "Sem fotos."}</div>;
  const w = 100;
  const min = Math.max(0, Math.min(...vals.map((p) => p.score)) - 5);
  const max = Math.min(100, Math.max(...vals.map((p) => p.score)) + 5);
  const y = (s) => altura - ((s - min) / Math.max(1, max - min)) * (altura - 6) - 3;
  const x = (i) => (i / (vals.length - 1)) * w;
  const d = vals.map((p, i) => `${x(i).toFixed(2)},${y(p.score).toFixed(2)}`).join(" ");
  return (
    <svg className="ritmo-spark" viewBox={`0 0 ${w} ${altura}`} preserveAspectRatio="none" role="img" aria-label="Evolução do índice no dia">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {vals.map((p, i) => <circle key={p.at} cx={x(i)} cy={y(p.score)} r="1.6"><title>{`${fmtHoraDe(p.at)} — índice ${p.score}${p.atrasos ? `, ${p.atrasos} atraso(s)` : ""}`}</title></circle>)}
    </svg>
  );
}

function ResumoStats({ s }) {
  return (
    <div className="ritmo-stats">
      <div><small>Abertura</small><b>{s.abertura ?? "—"}</b></div>
      <div><small>Agora / fechamento</small><b>{s.atual ?? "—"}</b></div>
      <div><small>Variação</small><b className={s.variacao > 0 ? "pos" : s.variacao < 0 ? "neg" : ""}>{sinal(s.variacao)}</b></div>
      <div><small>Mín – máx</small><b>{s.minimo ?? "—"} – {s.maximo ?? "—"}</b></div>
      <div><small>Atrasos criados</small><b className={s.atrasosNovos ? "neg" : ""}>{s.atrasosNovos}</b></div>
      <div><small>Atrasos resolvidos</small><b className={s.atrasosResolvidos ? "pos" : ""}>{s.atrasosResolvidos}</b></div>
      <div><small>Atrasos em aberto</small><b className={s.atrasosAgora ? "neg" : ""}>{s.atrasosAgora}</b></div>
      <div><small>Pendentes</small><b>{s.pendentesAgora}</b></div>
      <div><small>Ganhos agora</small><b className={s.bonusAgora ? "pos" : ""}>+{s.bonusAgora}</b></div>
      <div><small>Desconto agora</small><b className={s.impactoAgora ? "neg" : ""}>−{s.impactoAgora}</b></div>
    </div>
  );
}

const ICONE_EVENTO = { abertura: "🌅", indice_sobe: "📈", indice_cai: "📉", nivel: "🏷", atraso_novo: "⏰", atraso_resolvido: "✅", ganho: "➕" };

function htmlRelatorio(titulo, corpo) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}th{background:#eef2ff}.muted{color:#666}</style></head>
<body>${corpo}</body></html>`;
}

// ---------- operador ----------
export function RitmoOperadorCard({ ritmo, u }) {
  const [data, setData] = useState(dataLocalISO());
  const reg = (ritmo || {})[idRitmo(u.id, data)];
  const s = resumoRitmo(reg);
  const eventos = (reg && reg.eventos) || [];

  function imprimir() {
    if (!s) return;
    const corpo = `<h1>Ritmo do dia — ${esc(u.nome)}</h1><div class="muted">${fmtDataBRCurta(data)} • ${s.fotos} foto(s) do índice</div>
<h2>Resumo</h2><table><tr><th>Abertura</th><th>Fechamento</th><th>Variação</th><th>Mín–máx</th><th>Atrasos criados</th><th>Resolvidos</th><th>Em aberto</th><th>Pendentes</th></tr>
<tr><td>${s.abertura ?? "—"}</td><td>${s.atual ?? "—"}</td><td>${sinal(s.variacao)}</td><td>${s.minimo ?? "—"}–${s.maximo ?? "—"}</td><td>${s.atrasosNovos}</td><td>${s.atrasosResolvidos}</td><td>${s.atrasosAgora}</td><td>${s.pendentesAgora}</td></tr></table>
<h2>Linha do tempo</h2><table><tr><th>Hora</th><th>Evento</th></tr>${eventos.map((e) => `<tr><td>${fmtHoraDe(e.at)}</td><td>${esc(e.texto)}</td></tr>`).join("")}</table>
<h2>Atrasos em aberto no fim</h2>${(reg.ultimo.atrasos || []).length ? `<table><tr><th>Item</th><th>Dias</th><th>Pontos</th></tr>${reg.ultimo.atrasos.map((a) => `<tr><td>${esc(a.t)}</td><td>${a.d}</td><td>−${a.p}</td></tr>`).join("")}</table>` : "<p>Nenhum.</p>"}`;
    imprimirHtml(htmlRelatorio(`Ritmo do dia — ${u.nome} — ${fmtDataBRCurta(data)}`, corpo));
  }

  return (
    <div className="card">
      <div className="secao-topo">
        <h3>📈 Ritmo do dia</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" className="inline" value={data} max={dataLocalISO()} onChange={(e) => setData(e.target.value || dataLocalISO())} />
          <button type="button" className="btn sec xs" disabled={!s} onClick={imprimir}>🖨 Imprimir/PDF</button>
        </div>
      </div>
      {!s ? <EmptyState>Sem fotos do índice neste dia. As fotos são tiradas a cada 15 min no expediente, enquanto o operador ou um gestor está com o sistema aberto.</EmptyState> : (
        <>
          <ResumoStats s={s} />
          <div className="ritmo-grafico"><Sparkline pontos={reg.pontos} /></div>
          <div className="ritmo-eventos">
            {eventos.slice().reverse().map((e, i) => (
              <div key={i} className={"ritmo-evento " + e.tipo}>
                <span className="mono">{fmtHoraDe(e.at)}</span>
                <span>{ICONE_EVENTO[e.tipo] || "•"} {e.texto}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- equipe ----------
export function RitmoEquipe({ ritmo, operadores, navigate }) {
  const [data, setData] = useState(dataLocalISO());
  const linhas = operadores.map((u) => ({ u, s: resumoRitmo((ritmo || {})[idRitmo(u.id, data)]) }))
    .sort((a, b) => (b.s ? b.s.atual ?? -1 : -2) - (a.s ? a.s.atual ?? -1 : -2));
  const fech = (ritmo || {})[idFechamento(data)];
  const com = linhas.filter((l) => l.s);

  function imprimir() {
    const corpo = `<h1>Ritmo do dia — equipe operacional</h1><div class="muted">${fmtDataBRCurta(data)}</div>
${fech && fech.texto ? `<p>${esc(fech.texto)}</p>` : ""}
<table><tr><th>Operador</th><th>Abertura</th><th>Fechamento</th><th>Variação</th><th>Mín–máx</th><th>Nível</th><th>Atrasos criados</th><th>Resolvidos</th><th>Em aberto</th><th>Pendentes</th><th>Ganhos</th><th>Impacto</th></tr>
${com.map(({ u, s }) => `<tr><td>${esc(u.nome)}</td><td>${s.abertura ?? "—"}</td><td>${s.atual ?? "—"}</td><td>${sinal(s.variacao)}</td><td>${s.minimo ?? "—"}–${s.maximo ?? "—"}</td><td>${NIVEL_LABEL[s.nivel] || "—"}</td><td>${s.atrasosNovos}</td><td>${s.atrasosResolvidos}</td><td>${s.atrasosAgora}</td><td>${s.pendentesAgora}</td><td>+${s.bonusAgora}</td><td>−${s.impactoAgora}</td></tr>`).join("")}</table>`;
    imprimirHtml(htmlRelatorio(`Ritmo do dia — equipe — ${fmtDataBRCurta(data)}`, corpo));
  }

  return (
    <div className="card">
      <div className="secao-topo">
        <h3>📈 Ritmo do dia da equipe</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" className="inline" value={data} max={dataLocalISO()} onChange={(e) => setData(e.target.value || dataLocalISO())} />
          <button type="button" className="btn sec xs" disabled={!com.length} onClick={imprimir}>🖨 Imprimir/PDF</button>
        </div>
      </div>
      {fech && fech.texto && <div className="ritmo-fechamento">📋 {fech.texto}</div>}
      {!com.length ? <EmptyState>Sem fotos do índice neste dia.</EmptyState> : (
        <div style={{ overflowX: "auto" }}>
          <table className="ritmo-tabela">
            <thead>
              <tr><th>Operador</th><th>Abertura</th><th>Agora / fech.</th><th>Variação</th><th>Mín–máx</th><th>Atrasos criados</th><th>Resolvidos</th><th>Em aberto</th><th>Pendentes</th><th>Ganhos</th><th>Impacto</th></tr>
            </thead>
            <tbody>
              {linhas.map(({ u, s }) => (
                <tr key={u.id} onClick={() => navigate("desempenho", u.id)} style={{ cursor: "pointer" }} title="Abrir o desempenho deste operador">
                  <td><b>{u.nome}</b>{s && <span className={"badge nivel-badge " + s.nivel} style={{ marginLeft: 6 }}>{(nivelDoScore(s.atual) || {}).label}</span>}</td>
                  {!s ? <td colSpan={10} className="muted">sem fotos neste dia</td> : (
                    <>
                      <td>{s.abertura ?? "—"}</td>
                      <td><b>{s.atual ?? "—"}</b></td>
                      <td className={s.variacao > 0 ? "pos" : s.variacao < 0 ? "neg" : ""}>{sinal(s.variacao)}</td>
                      <td>{s.minimo ?? "—"} – {s.maximo ?? "—"}</td>
                      <td className={s.atrasosNovos ? "neg" : ""}>{s.atrasosNovos}</td>
                      <td className={s.atrasosResolvidos ? "pos" : ""}>{s.atrasosResolvidos}</td>
                      <td className={s.atrasosAgora ? "neg" : ""}>{s.atrasosAgora}</td>
                      <td>{s.pendentesAgora}</td>
                      <td className={s.bonusAgora ? "pos" : ""}>{s.bonusAgora ? `+${s.bonusAgora}` : "0"}</td>
                      <td className={s.impactoAgora ? "neg" : ""}>{s.impactoAgora ? `−${s.impactoAgora}` : "0"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { dataLocalISO, fmtDataBRCurta, fmtHoraDe } from "../../logic/agenda";
import { nivelDoScore } from "../../logic/desempenhoPainel";
import { FAIXAS_ATRASO, PONTOS_PENDENTE, PONTOS_INTERVENCAO, IMPACTO_MAX, resumoRitmo, idRitmo, idFechamento } from "../../logic/desempenhoRitmo";
import { imprimirHtml } from "../../logic/solicitacaoPdf";

// Relatório "Ritmo do dia" e impacto das pendências no Desempenho (ver
// logic/desempenhoRitmo.js).

const NIVEL_LABEL = { excelente: "Excelente", bom: "Bom", atencao: "Atenção", critico: "Crítico" };
function sinal(n) { return n == null ? "—" : n > 0 ? `+${n}` : String(n); }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// ---------- impacto ----------
export function ImpactoCard({ indice, navigate }) {
  const imp = indice.impacto;
  if (!imp) return null;
  return (
    <div className="card">
      <div className="secao-topo">
        <h3>⚖️ Impacto das pendências agora</h3>
        <span className={"badge " + (imp.pontos ? "red" : "green")} style={{ fontSize: 13 }}>
          {imp.pontos ? `−${Math.round(imp.pontos * 10) / 10} pts` : "sem desconto"}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
        Índice dos pilares <b>{indice.scoreBase ?? "—"}</b> → índice final <b>{indice.score ?? "—"}</b>.
        {" "}Atraso pesa mais quanto mais antigo ({FAIXAS_ATRASO.map((f) => `${f.rotulo}: −${f.pontos}`).join(" • ")}); pendente de hoje: −{PONTOS_PENDENTE}; intervenção sem resposta: −{PONTOS_INTERVENCAO}; CI urgente: −1 extra. Desconto máximo: {IMPACTO_MAX} pts.
        {imp.pontosBrutos > imp.pontos && <> Somando tudo daria −{imp.pontosBrutos}; aplicado o teto.</>}
      </p>
      {!imp.itens.length ? <EmptyState>Nenhuma pendência tirando pontos agora. 🎯</EmptyState> : (
        <div className="impacto-lista">
          {imp.itens.map((i) => (
            <button key={i.key} type="button" className={"impacto-item " + i.status} onClick={() => navigate && i.rota && navigate(...i.rota)}>
              <span className="impacto-ico">{i.icone}</span>
              <span className="impacto-txt">
                <b>{i.titulo}</b>
                <small>{i.sub}</small>
              </span>
              <span className={"badge " + (i.status === "atrasada" ? "red" : "amber")}>{i.status === "atrasada" ? "Atrasada" : "Pendente"}</span>
              <span className="impacto-pts">−{i.pontos}</span>
            </button>
          ))}
        </div>
      )}
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
    </div>
  );
}

const ICONE_EVENTO = { abertura: "🌅", indice_sobe: "📈", indice_cai: "📉", nivel: "🏷", atraso_novo: "⏰", atraso_resolvido: "✅" };

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
<table><tr><th>Operador</th><th>Abertura</th><th>Fechamento</th><th>Variação</th><th>Mín–máx</th><th>Nível</th><th>Atrasos criados</th><th>Resolvidos</th><th>Em aberto</th><th>Pendentes</th><th>Impacto</th></tr>
${com.map(({ u, s }) => `<tr><td>${esc(u.nome)}</td><td>${s.abertura ?? "—"}</td><td>${s.atual ?? "—"}</td><td>${sinal(s.variacao)}</td><td>${s.minimo ?? "—"}–${s.maximo ?? "—"}</td><td>${NIVEL_LABEL[s.nivel] || "—"}</td><td>${s.atrasosNovos}</td><td>${s.atrasosResolvidos}</td><td>${s.atrasosAgora}</td><td>${s.pendentesAgora}</td><td>−${s.impactoAgora}</td></tr>`).join("")}</table>`;
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
              <tr><th>Operador</th><th>Abertura</th><th>Agora / fech.</th><th>Variação</th><th>Mín–máx</th><th>Atrasos criados</th><th>Resolvidos</th><th>Em aberto</th><th>Pendentes</th><th>Impacto</th></tr>
            </thead>
            <tbody>
              {linhas.map(({ u, s }) => (
                <tr key={u.id} onClick={() => navigate("desempenho", u.id)} style={{ cursor: "pointer" }} title="Abrir o desempenho deste operador">
                  <td><b>{u.nome}</b>{s && <span className={"badge nivel-badge " + s.nivel} style={{ marginLeft: 6 }}>{(nivelDoScore(s.atual) || {}).label}</span>}</td>
                  {!s ? <td colSpan={9} className="muted">sem fotos neste dia</td> : (
                    <>
                      <td>{s.abertura ?? "—"}</td>
                      <td><b>{s.atual ?? "—"}</b></td>
                      <td className={s.variacao > 0 ? "pos" : s.variacao < 0 ? "neg" : ""}>{sinal(s.variacao)}</td>
                      <td>{s.minimo ?? "—"} – {s.maximo ?? "—"}</td>
                      <td className={s.atrasosNovos ? "neg" : ""}>{s.atrasosNovos}</td>
                      <td className={s.atrasosResolvidos ? "pos" : ""}>{s.atrasosResolvidos}</td>
                      <td className={s.atrasosAgora ? "neg" : ""}>{s.atrasosAgora}</td>
                      <td>{s.pendentesAgora}</td>
                      <td>{s.impactoAgora ? `−${s.impactoAgora}` : "0"}</td>
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

import { useMemo, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "../components/EmptyState.jsx";
import { DonutChart } from "../components/charts/DonutChart.jsx";
import { Legend } from "../components/charts/Legend.jsx";
import { RankList } from "../components/charts/RankList.jsx";
import { LineChartDual } from "../components/charts/LineChartDual.jsx";
import { PerfTable, PbarCell } from "../components/charts/PerfTable.jsx";
import { Kpi } from "../components/charts/Kpi.jsx";
import { exportCSV } from "../logic/exportCsv";
import { dashGoToSinistros } from "../state/listFilter";
import {
  visibleClaims, campoEfetivo, situacaoEfetiva, getUserJourney, getNextAction,
  getSitAtend, getTemp, isAtrasado, isSemAtualizacao, isManualClaim, relatedClaims,
  allJourneyStages, currentStage, buildAggregation, last12Months, distinctComputed,
  dashCiaLabel, dashOficinaKey, tipoPartyLabel, statusColorMap, tempColorMap,
} from "../logic/claims";
import { diasEntre, mediaArr, fmtDias, fmtPct, fmtNum, money, fmtDateBR, todayISO, txt, cssVar, PALETTE } from "../logic/format";

const DEFAULT_DASH_FILTER = {
  ocoDe: "", ocoAte: "", cia: "todas", ramo: "todos", oficina: "todas",
  tipo: "todos", status: "todos", caminho: "todos", manual: false, aberto: false,
};

function colorForStatus(map, s, i) { return map[s] || PALETTE[i % PALETTE.length]; }
function colorForTemp(map, t, i) { return map[t] || PALETTE[i % PALETTE.length]; }

export function Dashboard() {
  const { records, config } = useData();
  const { navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const [dashFilter, setDashFilter] = useState(DEFAULT_DASH_FILTER);

  const overrides = records.corp_overrides || {};
  const claims = useMemo(() => visibleClaims(records.corp_claims, overrides, currentUser), [records.corp_claims, overrides, currentUser]);
  const allClaimsRaw = records.corp_claims || [];
  const templates = config.corp_journey_templates || {};
  const atendTemplate = config.corp_atendimento_template;

  const totalGeral = claims.length;

  function patchFilter(patch) { setDashFilter((f) => ({ ...f, ...patch })); }
  function dashHasFilters() {
    const f = dashFilter;
    return !!(f.ocoDe || f.ocoAte || f.cia !== "todas" || f.ramo !== "todos" || f.oficina !== "todas" ||
      f.tipo !== "todos" || f.status !== "todos" || f.caminho !== "todos" || f.manual || f.aberto);
  }
  function dashClear() { setDashFilter(DEFAULT_DASH_FILTER); }
  function dashSetYear() {
    const y = new Date().getFullYear();
    patchFilter({ ocoDe: y + "-01-01", ocoAte: todayISO() });
  }
  // NOTA: no HTML original, os chips de "período rápido" (7/30/90/180/365 dias
  // e "Tudo") chamam dashSetRange(), que nunca chegou a ser definida — os
  // botões não faziam nada. Implementei o comportamento óbvio pela lógica de
  // dashIsQuickActive() (que já existia e comparava com este cálculo).
  function dashSetRange(days) {
    if (days == null) { patchFilter({ ocoDe: "", ocoAte: "" }); return; }
    const d = new Date();
    const ocoAte = todayISO();
    d.setDate(d.getDate() - days);
    patchFilter({ ocoDe: d.toISOString().slice(0, 10), ocoAte });
  }
  function dashIsQuickActive(days) {
    if (!dashFilter.ocoAte || dashFilter.ocoAte !== todayISO()) return false;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return dashFilter.ocoDe === d.toISOString().slice(0, 10);
  }

  function dashFilteredClaimsNoPeriod() {
    return claims.filter((c) => {
      if (dashFilter.cia !== "todas" && dashCiaLabel(overrides, c) !== dashFilter.cia) return false;
      if (dashFilter.ramo !== "todos" && campoEfetivo(overrides, c, "ramo") !== dashFilter.ramo) return false;
      if (dashFilter.oficina !== "todas" && dashOficinaKey(overrides, c) !== dashFilter.oficina) return false;
      if (dashFilter.tipo !== "todos" && c.partyType !== dashFilter.tipo) return false;
      if (dashFilter.status !== "todos" && situacaoEfetiva(overrides, c, atendTemplate, templates).label !== dashFilter.status) return false;
      if (dashFilter.caminho !== "todos" && (getUserJourney(overrides, c.id) || {}).caminho !== dashFilter.caminho) return false;
      if (dashFilter.manual && !isManualClaim(c)) return false;
      if (dashFilter.aberto) {
        const sl = situacaoEfetiva(overrides, c, atendTemplate, templates).label;
        if (sl !== "Pendente" && sl !== "Em andamento") return false;
      }
      return true;
    });
  }
  function dashFilteredClaims() {
    return dashFilteredClaimsNoPeriod().filter((c) => {
      if (dashFilter.ocoDe && (!c.datoco || c.datoco < dashFilter.ocoDe)) return false;
      if (dashFilter.ocoAte && (!c.datoco || c.datoco > dashFilter.ocoAte)) return false;
      return true;
    });
  }

  if (!totalGeral) {
    return (
      <div className="page-enter">
        <div className="page-head">
          <div><h1>Dashboard</h1><p>Indicadores, BI e cruzamento de dados dos sinistros</p></div>
        </div>
        <div className="card">
          <div className="dash-empty">
            <div>Nenhum sinistro sincronizado ainda.</div>
            <div style={{ marginTop: 14 }}>
              <button className="btn" onClick={() => navigate("integracao")}>↻ Ir para Integração CORP</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rows = dashFilteredClaims();
  const rowsTrend = dashFilteredClaimsNoPeriod();
  const total = rows.length;

  const byStatus = {};
  rows.forEach((c) => { const l = situacaoEfetiva(overrides, c, atendTemplate, templates).label; byStatus[l] = (byStatus[l] || 0) + 1; });
  const byTipo = {};
  rows.forEach((c) => { byTipo[c.partyType] = (byTipo[c.partyType] || 0) + 1; });
  let totalAvaliado = 0, totalIndenizado = 0, totalFranquia = 0;
  rows.forEach((c) => { totalAvaliado += c.valavi || 0; totalIndenizado += c.valind || 0; totalFranquia += c.franquia || 0; });
  const indenizados = byStatus["Indenizado"] || 0;
  const semIndeniz = byStatus["Encerrado sem Indenização"] || 0;
  // "Contatação" (a pedido do usuário, 2026-08-31): atendimento aberto só
  // pra cobertura ao terceiro, sem indenização ao segurado — não entra nos
  // valores financeiros (Total indenizado/ticket médio, que são só de
  // indenização de fato paga), mas conta como desfecho POSITIVO junto com
  // Indenizados numa taxa combinada (ver taxaPositiva).
  const contatacoes = byStatus["Contatação"] || 0;
  const emAndamento = byStatus["Em andamento"] || 0;
  const pendente = byStatus["Pendente"] || 0;
  const negado = byStatus["Negado"] || 0;
  const ticketMedio = indenizados ? totalIndenizado / indenizados : 0;
  const taxaIndeniz = total ? (indenizados / total) * 100 : 0;
  const taxaPositiva = total ? ((indenizados + contatacoes) / total) * 100 : 0;
  const atrasados = rows.filter((c) => isAtrasado(overrides, c)).length;
  const semAtu = rows.filter((c) => isSemAtualizacao(overrides, c, atendTemplate, templates)).length;
  const vinculados = rows.filter((c) => relatedClaims(overrides, allClaimsRaw, c).length > 0).length;

  const tmaArr = [], tmeArr = [], tmrArr = [];
  rows.forEach((c) => {
    const tma = diasEntre(c.datoco, c.datavi); if (tma != null && tma >= 0) tmaArr.push(tma);
    const tme = diasEntre(c.datavi, c.datenc); if (tme != null && tme >= 0) tmeArr.push(tme);
    const uj = getUserJourney(overrides, c.id);
    if (uj && uj.caminho === "parcial" && uj.steps && uj.steps.conclusao && uj.steps.conclusao.date) {
      const tmr = diasEntre(c.datavi, uj.steps.conclusao.date); if (tmr != null && tmr >= 0) tmrArr.push(tmr);
    }
  });
  const tmaMedio = mediaArr(tmaArr), tmeMedio = mediaArr(tmeArr), tmrMedio = mediaArr(tmrArr);

  const bySit = {}, byTemp = {};
  rows.forEach((c) => {
    const s = getSitAtend(overrides, c.id) || "Não definida"; bySit[s] = (bySit[s] || 0) + 1;
    const t = getTemp(overrides, c.id) || "Não definida"; byTemp[t] = (byTemp[t] || 0) + 1;
  });

  const stageNames = allJourneyStages(templates, atendTemplate);
  const byEtapa = {};
  rows.forEach((c) => { const s = currentStage(overrides, templates, atendTemplate, c); if (s) byEtapa[s] = (byEtapa[s] || 0) + 1; });

  const aggOficina = buildAggregation(overrides, rows, (c) => dashOficinaKey(overrides, c), atendTemplate, templates);
  const aggSeguradora = buildAggregation(overrides, rows, (c) => dashCiaLabel(overrides, c), atendTemplate, templates);
  const aggRamo = buildAggregation(overrides, rows, (c) => campoEfetivo(overrides, c, "ramo"), atendTemplate, templates);

  const months = last12Months();
  const abertosPorMes = {}, encerradosPorMes = {};
  months.forEach((m) => { abertosPorMes[m] = 0; encerradosPorMes[m] = 0; });
  rowsTrend.forEach((c) => {
    if (c.datoco) { const m1 = c.datoco.slice(0, 7); if (abertosPorMes[m1] !== undefined) abertosPorMes[m1]++; }
    if (c.datenc) { const m2 = c.datenc.slice(0, 7); if (encerradosPorMes[m2] !== undefined) encerradosPorMes[m2]++; }
  });

  const criticos = rows.filter((c) => isAtrasado(overrides, c))
    .map((c) => ({ c, na: getNextAction(overrides, c.id) }))
    .sort((a, b) => String((a.na && a.na.date) || "").localeCompare(String((b.na && b.na.date) || "")))
    .slice(0, 8);

  const ciaOptions = distinctComputed(claims, (c) => dashCiaLabel(overrides, c));
  const ramoOptions = distinctComputed(claims, (c) => campoEfetivo(overrides, c, "ramo"));
  const oficinaOptions = distinctComputed(claims, (c) => dashOficinaKey(overrides, c));
  // Lista de opções da situação a partir da situação EFETIVA (jornada do
  // usuário) — não do texto bruto da API CORP: o filtro em si (linha do
  // dashFilteredClaimsNoPeriod acima) já compara contra situacaoEfetiva, e
  // rótulos que só existem depois da jornada tocada (ex.: "Contatação") não
  // apareciam aqui antes, porque mapSituacao(c.situacao) nunca os produz.
  const situacaoOptions = [];
  { const seen = {}; claims.forEach((c) => { const l = situacaoEfetiva(overrides, c, atendTemplate, templates).label; if (!seen[l]) { seen[l] = true; situacaoOptions.push(l); } }); }

  const quickRanges = [[7, "7 dias"], [30, "30 dias"], [90, "90 dias"], [180, "6 meses"], [365, "12 meses"]];

  const periodoTxt = (dashFilter.ocoDe || dashFilter.ocoAte)
    ? `no período de ${dashFilter.ocoDe ? fmtDateBR(dashFilter.ocoDe) : "início"} até ${dashFilter.ocoAte ? fmtDateBR(dashFilter.ocoAte) : "hoje"}`
    : "em toda a base sincronizada";

  const statusMap = statusColorMap(cssVar);
  const tempMap = tempColorMap(cssVar);
  const statusData = Object.keys(byStatus).map((s, i) => ({ label: s, value: byStatus[s], color: colorForStatus(statusMap, s, i) })).sort((a, b) => b.value - a.value);
  const tipoColorMap = { Segurado: cssVar("--ok", "#16a34a"), Terceiro: cssVar("--danger", "#dc2626"), Aviso: cssVar("--warn", "#f59e0b") };
  const tipoData = Object.keys(byTipo).map((t) => ({ key: t, label: tipoPartyLabel(t), value: byTipo[t], color: tipoColorMap[t] || cssVar("--muted", "#64748b") })).sort((a, b) => b.value - a.value);
  const etapaData = stageNames.map((s) => ({ label: s, value: byEtapa[s] || 0 })).filter((d) => d.value > 0);

  const serieAbertos = { name: "Abertos (Dt. Ocorrência)", color: cssVar("--brand", "#2563eb"), values: months.map((m) => abertosPorMes[m]) };
  const serieEncerrados = { name: "Encerrados (Dt. Encerramento)", color: cssVar("--ok", "#16a34a"), values: months.map((m) => encerradosPorMes[m]) };

  const tempData = Object.keys(byTemp).map((t, i) => ({ label: t, value: byTemp[t], color: colorForTemp(tempMap, t, i) })).sort((a, b) => b.value - a.value);
  const sitData = Object.keys(bySit).map((s, i) => ({ label: s, value: bySit[s], color: PALETTE[i % PALETTE.length] })).sort((a, b) => b.value - a.value);

  const topOficinas = aggOficina.slice(0, 10).map((a) => ({ label: a.key, value: a.count }));
  const topSeguradoras = aggSeguradora.slice(0, 10).map((a) => ({ label: a.key, value: a.count }));

  function goSinistros(patch) { dashGoToSinistros(navigate, dashFilter, patch); }

  const oficinaRows = aggOficina.slice(0, 15).map((a) => ({
    onClick: () => goSinistros({ q: a.key }),
    cells: [
      <td key="k">{a.key}</td>,
      <td key="c" className="mono right">{fmtNum(a.count)}</td>,
      <td key="tmr" className="mono right">{fmtDias(a.tmr)}</td>,
      <td key="vi" className="mono right">{money(a.valind)}</td>,
      <td key="tm" className="mono right">{money(a.ticketMedio)}</td>,
      <td key="pa" className="right"><PbarCell pct={a.pctAtraso} color={cssVar("--danger", "#dc2626")} /></td>,
      <td key="acao"><button className="btn sec xs" onClick={(e) => { e.stopPropagation(); goSinistros({ q: a.key }); }}>Ver sinistros</button></td>,
    ],
  }));
  const seguradoraRows = aggSeguradora.slice(0, 15).map((a) => ({
    onClick: () => goSinistros({ q: a.key }),
    cells: [
      <td key="k">{a.key}</td>,
      <td key="c" className="mono right">{fmtNum(a.count)}</td>,
      <td key="tma" className="mono right">{fmtDias(a.tma)}</td>,
      <td key="tme" className="mono right">{fmtDias(a.tme)}</td>,
      <td key="vi" className="mono right">{money(a.valind)}</td>,
      <td key="ti" className="right"><PbarCell pct={a.taxaIndeniz} color={cssVar("--ok", "#16a34a")} /></td>,
      <td key="acao"><button className="btn sec xs" onClick={(e) => { e.stopPropagation(); goSinistros({ q: a.key }); }}>Ver sinistros</button></td>,
    ],
  }));
  const ramoRows = aggRamo.map((a) => ({
    onClick: () => goSinistros({ q: a.key }),
    cells: [
      <td key="k">{a.key}</td>,
      <td key="c" className="mono right">{fmtNum(a.count)}</td>,
      <td key="tma" className="mono right">{fmtDias(a.tma)}</td>,
      <td key="tme" className="mono right">{fmtDias(a.tme)}</td>,
      <td key="tmr" className="mono right">{fmtDias(a.tmr)}</td>,
      <td key="vi" className="mono right">{money(a.valind)}</td>,
      <td key="acao"><button className="btn sec xs" onClick={(e) => { e.stopPropagation(); goSinistros({ q: a.key }); }}>Ver sinistros</button></td>,
    ],
  }));

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Indicadores, BI e cruzamento de dados dos sinistros — Integração CORP</p></div>
        <button className="btn" onClick={() => navigate("integracao")}>↻ Sincronizar</button>
      </div>

      <div className="dash-toolbar">
        <div className="row">
          <label className="mini">Período rápido (Dt. Ocorrência):</label>
          {quickRanges.map(([d, label]) => (
            <div key={d} className={"chip-btn" + (dashIsQuickActive(d) ? " active" : "")} onClick={() => dashSetRange(d)}>{label}</div>
          ))}
          <div className="chip-btn" onClick={dashSetYear}>Este ano</div>
          <div className={"chip-btn" + (!dashFilter.ocoDe && !dashFilter.ocoAte ? " active" : "")} onClick={() => dashSetRange(null)}>Tudo</div>
        </div>
        <div className="row">
          <label className="mini">De:</label>
          <input type="date" value={dashFilter.ocoDe || ""} onChange={(e) => patchFilter({ ocoDe: e.target.value })} />
          <label className="mini">Até:</label>
          <input type="date" value={dashFilter.ocoAte || ""} onChange={(e) => patchFilter({ ocoAte: e.target.value })} />
          <label className="mini">Seguradora:</label>
          <select className="inline" value={dashFilter.cia} onChange={(e) => patchFilter({ cia: e.target.value })}>
            <option value="todas">Todas seguradoras</option>
            {ciaOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <label className="mini">Ramo:</label>
          <select className="inline" value={dashFilter.ramo} onChange={(e) => patchFilter({ ramo: e.target.value })}>
            <option value="todos">Todos os ramos</option>
            {ramoOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <label className="mini">Oficina:</label>
          <select className="inline" value={dashFilter.oficina} onChange={(e) => patchFilter({ oficina: e.target.value })}>
            <option value="todas">Todas oficinas</option>
            {oficinaOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="row">
          <label className="mini">Tipo:</label>
          <select className="inline" value={dashFilter.tipo} onChange={(e) => patchFilter({ tipo: e.target.value })}>
            <option value="todos">Todos os tipos</option>
            <option value="Segurado">Segurado</option>
            <option value="Terceiro">Terceiro</option>
            <option value="Aviso">Atendimento</option>
          </select>
          <label className="mini">Situação:</label>
          <select className="inline" value={dashFilter.status} onChange={(e) => patchFilter({ status: e.target.value })}>
            <option value="todos">Todas as situações</option>
            {situacaoOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <label className="mini">Caminho:</label>
          <select className="inline" value={dashFilter.caminho} onChange={(e) => patchFilter({ caminho: e.target.value })}>
            <option value="todos">Todos os caminhos</option>
            <option value="parcial">Perda Parcial</option>
            <option value="integral">Perda Integral</option>
            <option value="outros">Outros</option>
          </select>
          <div className={"chip-btn" + (dashFilter.manual ? " active" : "")} onClick={() => patchFilter({ manual: !dashFilter.manual })}>✎ Criados manualmente</div>
          <div className={"chip-btn" + (dashFilter.aberto ? " active" : "")} onClick={() => patchFilter({ aberto: !dashFilter.aberto })}>📂 Em aberto (Pendente/Em andamento)</div>
          <button className="btn sec sm" onClick={dashClear}>Limpar filtros</button>
          <button className="btn ghost sm" onClick={() => exportCSV(rows)}>⭳ Exportar filtrado (CSV)</button>
          {dashHasFilters()
            ? <span className="badge blue">{total} de {totalGeral} sinistro(s) no recorte</span>
            : <span className="muted" style={{ fontSize: 12 }}>Mostrando todos os {totalGeral} sinistros sincronizados</span>}
        </div>
      </div>

      <div className="exec-summary">
        <h3>📊 Resumo executivo</h3>
        <p>
          Considerando {fmtNum(total)} sinistro(s) {periodoTxt}: <b>{fmtNum(emAndamento)}</b> em andamento,{" "}
          <b>{fmtNum(indenizados)}</b> indenizado(s) (taxa de {fmtPct(taxaIndeniz)}), <b>{fmtNum(contatacoes)}</b> em contatação, e{" "}
          <b>{fmtNum(semIndeniz)}</b> encerrado(s) sem indenização — taxa de desfecho positivo (indenizados + contatação): <b>{fmtPct(taxaPositiva)}</b>.{" "}
          Tempo médio de abertura (ocorrência → aviso): <b>{fmtDias(tmaMedio)}</b>.{" "}
          Tempo médio de encerramento (aviso → encerramento): <b>{fmtDias(tmeMedio)}</b>.{" "}
          Tempo médio de conclusão de reparo (Perda Parcial): <b>{fmtDias(tmrMedio)}</b>.{" "}
          {(atrasados || semAtu)
            ? <span style={{ color: "var(--danger)", fontWeight: 700 }}>Atenção: {atrasados} processo(s) atrasado(s) e {semAtu} sem atualização há mais de 3 dias.</span>
            : <span style={{ color: "var(--ok)", fontWeight: 700 }}>Nenhum processo atrasado ou sem atualização neste recorte.</span>}
        </p>
      </div>

      <div className="section-title">Volume e Situação</div>
      <div className="kpi-grid">
        <Kpi n={fmtNum(total)} l="Sinistros no recorte" cls="c-blue" sub={totalGeral !== total ? `de ${fmtNum(totalGeral)} no total` : null} />
        <Kpi n={fmtNum(emAndamento)} l="Em andamento" cls="c-amber" />
        <Kpi n={fmtNum(indenizados)} l="Indenizados" cls="c-green" sub={`${fmtPct(taxaIndeniz)} de taxa`} />
        <Kpi n={fmtNum(semIndeniz)} l="Sem indenização" cls="c-gray" />
      </div>
      <div className="kpi-grid" style={{ marginTop: 14 }}>
        <Kpi n={fmtNum(pendente)} l="Pendentes" cls="c-amber" />
        <Kpi n={fmtNum(negado)} l="Negados" cls="c-red" alert={negado > 0} />
        <Kpi n={fmtNum(atrasados)} l="Atrasados" cls="c-red" sub="Próxima ação vencida" alert={atrasados > 0} />
        <Kpi n={fmtNum(semAtu)} l="Sem atualização" cls="c-amber" sub="+3 dias sem histórico" alert={semAtu > 0} />
      </div>
      <div className="kpi-grid" style={{ marginTop: 14 }}>
        <Kpi n={fmtNum(contatacoes)} l="Contatações" cls="c-blue" sub="Cobertura ao terceiro, sem indenização ao segurado" />
        <Kpi n={fmtPct(taxaPositiva)} l="Taxa de desfecho positivo" cls="c-green" sub="Indenizados + Contatações" />
      </div>

      <div className="section-title">Indicadores Financeiros</div>
      <div className="kpi-grid">
        <Kpi n={money(totalAvaliado)} l="Total avaliado" cls="c-blue" />
        <Kpi n={money(totalIndenizado)} l="Total indenizado" cls="c-green" />
        <Kpi n={money(ticketMedio)} l="Ticket médio (indenizados)" cls="c-purple" />
        <Kpi n={money(totalFranquia)} l="Total em franquias" cls="c-gray" />
      </div>

      <div className="section-title">Indicadores de Tempo (SLA de Atendimento)</div>
      <div className="kpi-grid">
        <Kpi n={fmtDias(tmaMedio)} l="Tempo médio de abertura" cls="c-blue" sub={`Ocorrência → Aviso (n=${tmaArr.length})`} />
        <Kpi n={fmtDias(tmeMedio)} l="Tempo médio de encerramento" cls="c-green" sub={`Aviso → Encerramento (n=${tmeArr.length})`} />
        <Kpi n={fmtDias(tmrMedio)} l="Tempo médio de conclusão de reparo" cls="c-amber" sub={`Aviso → Conclusão, Perda Parcial (n=${tmrArr.length})`} />
        <Kpi n={fmtNum(vinculados)} l="Sinistros com vínculos" cls="c-purple" sub="Segurado + Terceiros relacionados" />
      </div>

      <div className="section-title">Análise de Distribuição</div>
      <div className="charts-grid c3">
        <div className="chart-card">
          <h4>Distribuição por Situação</h4>
          <p className="sub">Clique numa fatia para ver os sinistros</p>
          <div className="flexrow">
            <DonutChart data={statusData} onClick={(d) => goSinistros({ status: d.label })} />
            <Legend data={statusData} onClick={(d) => goSinistros({ status: d.label })} />
          </div>
        </div>
        <div className="chart-card">
          <h4>Distribuição por Tipo de Parte</h4>
          <p className="sub">Segurado, Terceiro ou Atendimento</p>
          <div className="flexrow">
            <DonutChart data={tipoData} onClick={(d) => goSinistros({ tipo: d.key })} />
            <Legend data={tipoData} onClick={(d) => goSinistros({ tipo: d.key })} />
          </div>
        </div>
        <div className="chart-card">
          <h4>Funil por Etapa da Jornada</h4>
          <p className="sub">Onde os sinistros em aberto estão parados</p>
          <RankList data={etapaData} onClick={(d) => goSinistros({ etapa: d.label })} />
        </div>
      </div>

      <div className="section-title">Evolução Temporal e Atendimento</div>
      <div className="charts-grid">
        <div className="chart-card">
          <h4>Evolução Mensal — Abertura x Encerramento</h4>
          <p className="sub">Últimos 12 meses • clique num ponto para abrir o mês</p>
          <LineChartDual
            labels={months} seriesA={serieAbertos} seriesB={serieEncerrados}
            onClick={(m) => {
              const d = new Date(m + "-01T00:00:00");
              const ini = m + "-01";
              const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
              goSinistros({ ocoDe: ini, ocoAte: fim });
            }}
          />
          <div style={{ display: "flex", gap: 16, fontSize: 11.5, marginTop: 8 }}>
            <span><span className="legend-dot" style={{ background: serieAbertos.color, display: "inline-block", marginRight: 5 }} />Abertos</span>
            <span><span className="legend-dot" style={{ background: serieEncerrados.color, display: "inline-block", marginRight: 5 }} />Encerrados</span>
          </div>
        </div>
        <div className="chart-card">
          <h4>Análise de Atendimento</h4>
          <p className="sub">Temperatura e situação de atendimento registradas nos processos</p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>TEMPERATURA</div>
              <Legend data={tempData} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>SITUAÇÃO DE ATENDIMENTO</div>
              <Legend data={sitData} />
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">Rankings por Volume</div>
      <div className="charts-grid">
        <div className="chart-card">
          <h4>Top 10 Oficinas/Prestadores por Volume</h4>
          <p className="sub">Clique numa barra para ver os sinistros da oficina</p>
          <RankList data={topOficinas} onClick={(d) => goSinistros({ q: d.label })} />
        </div>
        <div className="chart-card">
          <h4>Top 10 Seguradoras por Volume</h4>
          <p className="sub">Clique numa barra para ver os sinistros da seguradora</p>
          <RankList data={topSeguradoras} onClick={(d) => goSinistros({ q: d.label })} />
        </div>
      </div>

      <div className="section-title">Cruzamento de Dados — Desempenho Operacional</div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Desempenho por Oficina/Prestador</h3>
          <span className="muted" style={{ fontSize: 12 }}>{aggOficina.length} oficina(s) no recorte</span>
        </div>
        <p className="muted" style={{ margin: "6px 0 12px" }}>TMR = tempo médio entre o aviso e a conclusão do reparo (etapa "Conclusão", caminho Perda Parcial). Ordenado por volume.</p>
        {aggOficina.length ? <PerfTable headers={["Oficina", "Qtd.", "TMR médio", "Total indenizado", "Ticket médio", "% Atrasados", "Ações"]} rows={oficinaRows} /> : <EmptyState>Sem dados de oficina para este recorte.</EmptyState>}
      </div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Desempenho por Seguradora</h3>
          <span className="muted" style={{ fontSize: 12 }}>{aggSeguradora.length} seguradora(s) no recorte</span>
        </div>
        <p className="muted" style={{ margin: "6px 0 12px" }}>TMA = ocorrência → aviso. TME = aviso → encerramento. Taxa de indenização = indenizados / total de cada seguradora.</p>
        {aggSeguradora.length ? <PerfTable headers={["Seguradora", "Qtd.", "TMA médio", "TME médio", "Total indenizado", "Taxa indeniz.", "Ações"]} rows={seguradoraRows} /> : <EmptyState>Sem dados de seguradora para este recorte.</EmptyState>}
      </div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Desempenho por Ramo</h3>
          <span className="muted" style={{ fontSize: 12 }}>{aggRamo.length} ramo(s) no recorte</span>
        </div>
        {aggRamo.length ? <PerfTable headers={["Ramo", "Qtd.", "TMA médio", "TME médio", "TMR médio", "Total indenizado", "Ações"]} rows={ramoRows} /> : <EmptyState>Sem dados de ramo para este recorte.</EmptyState>}
      </div>

      <div className="section-title">Ação Imediata</div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>⏰ Sinistros mais críticos (atrasados)</h3>
          {atrasados > 8 && <button className="btn sec sm" onClick={() => goSinistros({ atrasado: true })}>Ver todos os {atrasados}</button>}
        </div>
        <p className="muted" style={{ margin: "6px 0 12px" }}>Próxima ação vencida, ordenados do mais atrasado para o menos atrasado.</p>
        {criticos.length ? (
          <div className="critical-list">
            {criticos.map((o) => {
              const dias = diasEntre(o.na.date, todayISO());
              return (
                <div key={o.c.id} className="critical-item" onClick={() => navigate("sinistro", o.c.id)}>
                  <div className="ci-l">
                    <b>{(o.c.numsin || "#" + o.c.nosnum) + " — " + txt(o.c.segurado)}</b>
                    <span className="muted">{txt(o.c.cia)} • {txt(o.c.oficina || o.c.ramo)}</span>
                  </div>
                  <div className="ci-r">{o.na.title}{dias != null ? ` — ${dias}d atraso` : ""}</div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState>Nenhum sinistro atrasado neste recorte.</EmptyState>}
      </div>
    </div>
  );
}

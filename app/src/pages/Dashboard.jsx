import { useEffect, useMemo, useState } from "react";
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
import { DashboardPrintModal } from "../components/DashboardPrintModal.jsx";
import { exportCSV } from "../logic/exportCsv";
import { dashGoToSinistros } from "../state/listFilter";
import {
  visibleClaims, campoEfetivo, situacaoEfetiva, getUserJourney, getNextAction,
  getSitAtend, getTemp, isAtrasado, isSemAtualizacao, isManualClaim, relatedClaims,
  allJourneyStages, currentStage, buildAggregation, last12Months, distinctComputed,
  dashCiaLabel, dashOficinaKey, tipoPartyLabel, statusColorMap, tempColorMap,
  gruposProdutoresDoClaim, agentesDoClaim, distinctGruposProdutores, getAgentesEfetivo,
  grupoVisivelNoDashboard,
} from "../logic/claims";
import { diasEntre, mediaArr, fmtDias, fmtPct, fmtNum, money, fmtDateBR, fmtDateHoraBR, todayISO, txt, cssVar, PALETTE } from "../logic/format";

const DEFAULT_DASH_FILTER = {
  ocoDe: "", ocoAte: "", cia: "todas", ramo: "todos", oficina: "todas",
  tipo: "todos", status: "todos", caminho: "todos", manual: false,
  // "Em aberto" (Pendente/Em andamento) já vem ligado ao abrir o Dashboard
  // (a pedido do usuário): o dia a dia é sobre processo que ainda anda, e
  // não sobre a base histórica inteira. É só o padrão — o chip continua
  // desligável a qualquer momento, e "Limpar filtros" volta pra cá.
  aberto: true,
  // Grupo de Produtores e Agente (a pedido do usuário) — recortam todo o
  // Dashboard, igual a Seguradora/Ramo/Oficina. Um processo entra no recorte
  // se QUALQUER um dos seus vínculos bater (normalmente tem mais de um par
  // agente/produtor); ver gruposProdutoresDoClaim/agentesDoClaim.
  grupoProdutor: "todos", agente: "todos",
};

// O que pode ser marcado/desmarcado antes de gerar o PDF: cada seção da tela
// e, dentro dela, CADA campo (a pedido do usuário) — um KPI, um gráfico ou
// uma tabela por vez. Mesma ordem da tela. Tudo começa marcado. Seção sem
// `itens` é um bloco único (a própria chave é o campo). Ver
// DashboardPrintModal.jsx e mostra()/mostraSecao() abaixo.
const PRINT_BLOCKS = [
  { key: "capa", label: "Cabeçalho do relatório", hint: "Título, data/hora, usuário e a lista de filtros aplicados" },
  { key: "resumo", label: "Resumo executivo", hint: "Parágrafo com a leitura geral do recorte" },
  {
    key: "volume", label: "Volume e Situação", itens: [
      ["vol_total", "Sinistros no recorte"],
      ["vol_andamento", "Em andamento"],
      ["vol_indenizados", "Indenizados"],
      ["vol_semIndeniz", "Sem indenização"],
      ["vol_pendentes", "Pendentes"],
      ["vol_negados", "Negados"],
      ["vol_atrasados", "Atrasados"],
      ["vol_semAtu", "Sem atualização"],
      ["vol_constatacoes", "Constatações"],
      ["vol_taxaPositiva", "Taxa de desfecho positivo"],
    ],
  },
  {
    key: "financeiro", label: "Indicadores Financeiros", itens: [
      ["fin_avaliado", "Total avaliado"],
      ["fin_indenizado", "Total indenizado"],
      ["fin_ticket", "Ticket médio (indenizados)"],
      ["fin_franquia", "Total em franquias"],
    ],
  },
  {
    key: "tempo", label: "Indicadores de Tempo (SLA de Atendimento)", itens: [
      ["tmp_tma", "Tempo médio de abertura (TMA)"],
      ["tmp_tme", "Tempo médio de encerramento (TME)"],
      ["tmp_tmr", "Tempo médio de conclusão de reparo (TMR)"],
      ["tmp_vinculos", "Sinistros com vínculos"],
    ],
  },
  {
    key: "distribuicao", label: "Análise de Distribuição", itens: [
      ["dist_situacao", "Distribuição por Situação (rosca + legenda)"],
      ["dist_tipo", "Distribuição por Tipo de Parte (rosca + legenda)"],
      ["dist_funil", "Funil por Etapa da Jornada"],
    ],
  },
  {
    key: "evolucao", label: "Evolução Temporal e Atendimento", itens: [
      ["evo_mensal", "Evolução Mensal — Abertura x Encerramento"],
      ["evo_atendimento", "Análise de Atendimento (temperatura e situação)"],
    ],
  },
  {
    key: "rankings", label: "Rankings por Volume", itens: [
      ["rk_oficinas", "Top 10 Oficinas/Prestadores"],
      ["rk_seguradoras", "Top 10 Seguradoras"],
    ],
  },
  {
    key: "grupoAgente", label: "Volume por Grupo de Produtores e Agente", itens: [
      ["ga_grupos", "Grupos de Produtores por volume (todos)"],
      ["ga_agentes", "Agentes por volume (todos)"],
    ],
  },
  {
    key: "desempenho", label: "Cruzamento de Dados — Desempenho Operacional", itens: [
      ["des_oficina", "Desempenho por Oficina/Prestador"],
      ["des_seguradora", "Desempenho por Seguradora"],
      ["des_ramo", "Desempenho por Ramo"],
      ["des_grupo", "Quantidade de Processos por Grupo de Produtores"],
      ["des_agente", "Quantidade de Processos por Agente"],
    ],
  },
  { key: "criticos", label: "Ação Imediata", hint: "Lista dos sinistros mais críticos (atrasados)" },
];
// Chaves "folha" — os campos de fato marcáveis. A seção sem itens é a
// própria folha.
function printChavesFolha() {
  const out = [];
  PRINT_BLOCKS.forEach((b) => {
    if (b.itens) b.itens.forEach(([k]) => out.push(k));
    else out.push(b.key);
  });
  return out;
}
function printOptsTodos(valor) {
  const o = {};
  printChavesFolha().forEach((k) => { o[k] = valor; });
  return o;
}

function colorForStatus(map, s, i) { return map[s] || PALETTE[i % PALETTE.length]; }
function colorForTemp(map, t, i) { return map[t] || PALETTE[i % PALETTE.length]; }

export function Dashboard() {
  const { records, config } = useData();
  const { navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const [dashFilter, setDashFilter] = useState(DEFAULT_DASH_FILTER);
  // Impressão em PDF (a pedido do usuário): `printOpen` é a caixa de diálogo
  // de seleção; `printing` é o modo impressão em si — durante ele o Dashboard
  // renderiza SÓ as seções marcadas, o CSS @media print esconde menu, barra
  // de filtros e botões, e o navegador gera o PDF vetorial.
  const [printOpen, setPrintOpen] = useState(false);
  const [printOpts, setPrintOpts] = useState(() => printOptsTodos(true));
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    let encerrado = false;
    function encerrar() {
      if (encerrado) return;
      encerrado = true;
      setPrinting(false);
    }
    window.addEventListener("afterprint", encerrar);
    // Um respiro antes de abrir a caixa de impressão: as barras dos rankings
    // e as linhas dos gráficos entram animadas (width/stroke-dashoffset via
    // requestAnimationFrame) e, sem essa espera, o PDF poderia sair com elas
    // no meio da animação.
    const t = setTimeout(() => {
      try { window.print(); } catch { /* navegador sem suporte: volta ao normal */ }
      // Rede de segurança: nem todo navegador dispara "afterprint".
      setTimeout(encerrar, 1200);
    }, 450);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", encerrar); };
  }, [printing]);

  // Todas as opções marcadas a cada abertura, como pedido.
  function abrirImpressao() {
    setPrintOpts(printOptsTodos(true));
    setPrintOpen(true);
  }
  function togglePrintOpt(k) { setPrintOpts((o) => ({ ...o, [k]: !o[k] })); }
  // Marcar/desmarcar uma seção inteira de uma vez (checkbox do título).
  function togglePrintBloco(bloco, valor) {
    const chaves = bloco.itens ? bloco.itens.map(([k]) => k) : [bloco.key];
    setPrintOpts((o) => {
      const next = { ...o };
      chaves.forEach((k) => { next[k] = valor; });
      return next;
    });
  }
  function gerarPdf() {
    setPrintOpen(false);
    setPrinting(true);
  }
  // Durante a impressão, só os campos marcados vão para o papel.
  function mostra(k) { return !printing || !!printOpts[k]; }
  // Um contêiner (linha de KPIs, grade de gráficos) só aparece se sobrou
  // pelo menos um campo dentro dele — senão o PDF ficaria com um vão em
  // branco no lugar.
  function algum(...chaves) { return chaves.some((k) => mostra(k)); }
  // Título + conteúdo de uma seção: some inteira quando todos os campos dela
  // foram desmarcados.
  function mostraSecao(secKey) {
    if (!printing) return true;
    const sec = PRINT_BLOCKS.find((b) => b.key === secKey);
    if (!sec) return true;
    return sec.itens ? sec.itens.some(([k]) => !!printOpts[k]) : !!printOpts[secKey];
  }

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
      f.tipo !== "todos" || f.status !== "todos" || f.caminho !== "todos" || f.manual || f.aberto ||
      f.grupoProdutor !== "todos" || f.agente !== "todos");
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
      if (dashFilter.grupoProdutor !== "todos" && gruposProdutoresDoClaim(overrides, c.id).indexOf(dashFilter.grupoProdutor) < 0) return false;
      if (dashFilter.agente !== "todos" && agentesDoClaim(overrides, c.id).indexOf(dashFilter.agente) < 0) return false;
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
  // "Constatação" (a pedido do usuário, 2026-08-31): atendimento aberto só
  // pra cobertura ao terceiro, sem indenização ao segurado — não entra nos
  // valores financeiros (Total indenizado/ticket médio, que são só de
  // indenização de fato paga), mas conta como desfecho POSITIVO junto com
  // Indenizados numa taxa combinada (ver taxaPositiva).
  const constatacoes = byStatus["Constatação"] || 0;
  const emAndamento = byStatus["Em andamento"] || 0;
  const pendente = byStatus["Pendente"] || 0;
  const negado = byStatus["Negado"] || 0;
  const ticketMedio = indenizados ? totalIndenizado / indenizados : 0;
  const taxaIndeniz = total ? (indenizados / total) * 100 : 0;
  const taxaPositiva = total ? ((indenizados + constatacoes) / total) * 100 : 0;
  const atrasados = rows.filter((c) => isAtrasado(overrides, c, atendTemplate, templates)).length;
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
  // Quantidade de processos por Grupo de Produtores e por Agente (a pedido
  // do usuário). Dimensões de valor MÚLTIPLO: um processo com dois vínculos
  // conta nos dois grupos/agentes, então a soma das linhas pode passar do
  // total do recorte — e processos ainda sem vínculo buscado no CORP não
  // entram em nenhuma linha (contados à parte em semGrupo/semAgente).
  // Grupos desabilitados em Configurações (corp_dashboard_grupos_ocultos)
  // saem das listagens por grupo, mas os processos deles continuam contando
  // em todo o resto do Dashboard — ver GruposDashboardCard.jsx.
  const aggGrupoTodos = buildAggregation(overrides, rows, (c) => gruposProdutoresDoClaim(overrides, c.id), atendTemplate, templates);
  const aggGrupoProdutor = aggGrupoTodos.filter((a) => grupoVisivelNoDashboard(config, a.key));
  const gruposOcultosNoRecorte = aggGrupoTodos.length - aggGrupoProdutor.length;
  const aggAgente = buildAggregation(overrides, rows, (c) => agentesDoClaim(overrides, c.id), atendTemplate, templates);
  const semGrupo = rows.filter((c) => !gruposProdutoresDoClaim(overrides, c.id).length).length;
  const semAgente = rows.filter((c) => !agentesDoClaim(overrides, c.id).length).length;

  const months = last12Months();
  const abertosPorMes = {}, encerradosPorMes = {};
  months.forEach((m) => { abertosPorMes[m] = 0; encerradosPorMes[m] = 0; });
  rowsTrend.forEach((c) => {
    if (c.datoco) { const m1 = c.datoco.slice(0, 7); if (abertosPorMes[m1] !== undefined) abertosPorMes[m1]++; }
    if (c.datenc) { const m2 = c.datenc.slice(0, 7); if (encerradosPorMes[m2] !== undefined) encerradosPorMes[m2]++; }
  });

  const criticos = rows.filter((c) => isAtrasado(overrides, c, atendTemplate, templates))
    .map((c) => ({ c, na: getNextAction(overrides, c.id) }))
    .sort((a, b) => String((a.na && a.na.date) || "").localeCompare(String((b.na && b.na.date) || "")))
    .slice(0, 8);

  const ciaOptions = distinctComputed(claims, (c) => dashCiaLabel(overrides, c));
  const ramoOptions = distinctComputed(claims, (c) => campoEfetivo(overrides, c, "ramo"));
  const oficinaOptions = distinctComputed(claims, (c) => dashOficinaKey(overrides, c));
  // O grupo escolhido no filtro continua listado mesmo se for desabilitado
  // depois, senão o select ficaria mostrando um valor que não existe na
  // lista (e o recorte seguiria aplicado sem ninguém entender por quê).
  const grupoProdutorOptions = distinctGruposProdutores(overrides, claims)
    .filter((g) => grupoVisivelNoDashboard(config, g) || g === dashFilter.grupoProdutor);
  const agenteOptions = getAgentesEfetivo(config, overrides, claims);
  // Lista de opções da situação a partir da situação EFETIVA (jornada do
  // usuário) — não do texto bruto da API CORP: o filtro em si (linha do
  // dashFilteredClaimsNoPeriod acima) já compara contra situacaoEfetiva, e
  // rótulos que só existem depois da jornada tocada (ex.: "Constatação") não
  // apareciam aqui antes, porque mapSituacao(c.situacao) nunca os produz.
  const situacaoOptions = [];
  { const seen = {}; claims.forEach((c) => { const l = situacaoEfetiva(overrides, c, atendTemplate, templates).label; if (!seen[l]) { seen[l] = true; situacaoOptions.push(l); } }); }

  const quickRanges = [[7, "7 dias"], [30, "30 dias"], [90, "90 dias"], [180, "6 meses"], [365, "12 meses"]];

  const periodoTxt = (dashFilter.ocoDe || dashFilter.ocoAte)
    ? `no período de ${dashFilter.ocoDe ? fmtDateBR(dashFilter.ocoDe) : "início"} até ${dashFilter.ocoAte ? fmtDateBR(dashFilter.ocoAte) : "hoje"}`
    : "em toda a base sincronizada";

  // Lista legível do recorte atual — o PDF esconde a barra de filtros, então
  // o cabeçalho do relatório precisa dizer por escrito o que está filtrado.
  const filtrosAtivosTxt = [];
  if (dashFilter.ocoDe || dashFilter.ocoAte) filtrosAtivosTxt.push(`Dt. Ocorrência: ${dashFilter.ocoDe ? fmtDateBR(dashFilter.ocoDe) : "início"} a ${dashFilter.ocoAte ? fmtDateBR(dashFilter.ocoAte) : "hoje"}`);
  if (dashFilter.cia !== "todas") filtrosAtivosTxt.push(`Seguradora: ${dashFilter.cia}`);
  if (dashFilter.ramo !== "todos") filtrosAtivosTxt.push(`Ramo: ${dashFilter.ramo}`);
  if (dashFilter.oficina !== "todas") filtrosAtivosTxt.push(`Oficina: ${dashFilter.oficina}`);
  if (dashFilter.grupoProdutor !== "todos") filtrosAtivosTxt.push(`Grupo de Produtores: ${dashFilter.grupoProdutor}`);
  if (dashFilter.agente !== "todos") filtrosAtivosTxt.push(`Agente: ${dashFilter.agente}`);
  if (dashFilter.tipo !== "todos") filtrosAtivosTxt.push(`Tipo: ${tipoPartyLabel(dashFilter.tipo)}`);
  if (dashFilter.status !== "todos") filtrosAtivosTxt.push(`Situação: ${dashFilter.status}`);
  if (dashFilter.caminho !== "todos") filtrosAtivosTxt.push(`Caminho: ${dashFilter.caminho === "parcial" ? "Perda Parcial" : dashFilter.caminho === "integral" ? "Perda Integral" : "Outros"}`);
  if (dashFilter.manual) filtrosAtivosTxt.push("Somente criados manualmente");
  if (dashFilter.aberto) filtrosAtivosTxt.push("Somente em aberto (Pendente/Em andamento)");

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
  // Todos os grupos e todos os agentes (a pedido do usuário) — sem corte de
  // "top 10": as duas listas e as duas tabelas mostram o recorte inteiro.
  const rankGrupos = aggGrupoProdutor.map((a) => ({ label: a.key, value: a.count }));
  const rankAgentes = aggAgente.map((a) => ({ label: a.key, value: a.count }));

  function goSinistros(patch) { dashGoToSinistros(navigate, dashFilter, patch); }

  // Linhas de quantidade por Grupo de Produtores / Agente. O clique leva pra
  // tela Sinistros com o MESMO critério da contagem (lf.grupoProdutor /
  // lf.agente), zerando a outra dimensão pra lista bater exatamente com o
  // número da linha.
  function grupoAgenteRows(agg, campo) {
    const outro = campo === "grupoProdutor" ? "agente" : "grupoProdutor";
    return agg.map((a) => {
      const ir = () => goSinistros({ [campo]: a.key, [outro]: "todos" });
      return {
        onClick: ir,
        cells: [
          <td key="k">{a.key}</td>,
          <td key="c" className="mono right">{fmtNum(a.count)}</td>,
          <td key="pc" className="right"><PbarCell pct={total ? (a.count / total) * 100 : 0} color={cssVar("--brand", "#2563eb")} /></td>,
          <td key="in" className="mono right">{fmtNum(a.indenizados)}</td>,
          <td key="at" className="mono right">{fmtNum(a.atrasados)}</td>,
          <td key="sa" className="mono right">{fmtNum(a.semAtu)}</td>,
          <td key="acao"><button className="btn sec xs" onClick={(e) => { e.stopPropagation(); ir(); }}>Ver sinistros</button></td>,
        ],
      };
    });
  }
  const grupoProdutorRows = grupoAgenteRows(aggGrupoProdutor, "grupoProdutor");
  const agenteRows = grupoAgenteRows(aggAgente, "agente");

  const oficinaRows = aggOficina.slice(0, 15).map((a) => ({
    onClick: () => goSinistros({ oficina: a.key }),
    cells: [
      <td key="k">{a.key}</td>,
      <td key="c" className="mono right">{fmtNum(a.count)}</td>,
      <td key="tmr" className="mono right">{fmtDias(a.tmr)}</td>,
      <td key="vi" className="mono right">{money(a.valind)}</td>,
      <td key="tm" className="mono right">{money(a.ticketMedio)}</td>,
      <td key="pa" className="right"><PbarCell pct={a.pctAtraso} color={cssVar("--danger", "#dc2626")} /></td>,
      <td key="acao"><button className="btn sec xs" onClick={(e) => { e.stopPropagation(); goSinistros({ oficina: a.key }); }}>Ver sinistros</button></td>,
    ],
  }));
  const seguradoraRows = aggSeguradora.slice(0, 15).map((a) => ({
    onClick: () => goSinistros({ cia: a.key }),
    cells: [
      <td key="k">{a.key}</td>,
      <td key="c" className="mono right">{fmtNum(a.count)}</td>,
      <td key="tma" className="mono right">{fmtDias(a.tma)}</td>,
      <td key="tme" className="mono right">{fmtDias(a.tme)}</td>,
      <td key="vi" className="mono right">{money(a.valind)}</td>,
      <td key="ti" className="right"><PbarCell pct={a.taxaIndeniz} color={cssVar("--ok", "#16a34a")} /></td>,
      <td key="acao"><button className="btn sec xs" onClick={(e) => { e.stopPropagation(); goSinistros({ cia: a.key }); }}>Ver sinistros</button></td>,
    ],
  }));
  const ramoRows = aggRamo.map((a) => ({
    onClick: () => goSinistros({ ramo: a.key }),
    cells: [
      <td key="k">{a.key}</td>,
      <td key="c" className="mono right">{fmtNum(a.count)}</td>,
      <td key="tma" className="mono right">{fmtDias(a.tma)}</td>,
      <td key="tme" className="mono right">{fmtDias(a.tme)}</td>,
      <td key="tmr" className="mono right">{fmtDias(a.tmr)}</td>,
      <td key="vi" className="mono right">{money(a.valind)}</td>,
      <td key="acao"><button className="btn sec xs" onClick={(e) => { e.stopPropagation(); goSinistros({ ramo: a.key }); }}>Ver sinistros</button></td>,
    ],
  }));

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Indicadores, BI e cruzamento de dados dos sinistros — Integração CORP</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn sec" onClick={abrirImpressao}>🖨 Imprimir / PDF</button>
          <button className="btn" onClick={() => navigate("integracao")}>↻ Sincronizar</button>
        </div>
      </div>

      {printing && printOpts.capa && (
        <div className="print-capa">
          <h2>Dashboard — Relatório de Sinistros</h2>
          <div className="print-capa-meta">
            Gerado em {fmtDateHoraBR(new Date().toISOString())}{currentUser && currentUser.nome ? ` por ${currentUser.nome}` : ""}
            {" • "}{fmtNum(total)} de {fmtNum(totalGeral)} sinistro(s) {periodoTxt}
          </div>
          <div className="print-capa-filtros">
            <b>Filtros aplicados:</b>{" "}
            {filtrosAtivosTxt.length ? filtrosAtivosTxt.join(" • ") : "nenhum — toda a base sincronizada"}
          </div>
        </div>
      )}

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
          <label className="mini">Grupo de Produtores:</label>
          <select className="inline" style={{ minWidth: 200 }} value={dashFilter.grupoProdutor} onChange={(e) => patchFilter({ grupoProdutor: e.target.value })}>
            <option value="todos">Todos os grupos</option>
            {grupoProdutorOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <label className="mini">Agente:</label>
          <select className="inline" style={{ minWidth: 200 }} value={dashFilter.agente} onChange={(e) => patchFilter({ agente: e.target.value })}>
            <option value="todos">Todos os agentes</option>
            {agenteOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 11 }}>(vínculos dos processos já buscados no CORP — importe em lote em Configurações se faltar algum)</span>
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

      {mostraSecao("resumo") && (
        <>
          <div className="exec-summary">
            <h3>📊 Resumo executivo</h3>
            <p>
              Considerando {fmtNum(total)} sinistro(s) {periodoTxt}: <b>{fmtNum(emAndamento)}</b> em andamento,{" "}
              <b>{fmtNum(indenizados)}</b> indenizado(s) (taxa de {fmtPct(taxaIndeniz)}), <b>{fmtNum(constatacoes)}</b> em constatação, e{" "}
              <b>{fmtNum(semIndeniz)}</b> encerrado(s) sem indenização — taxa de desfecho positivo (indenizados + constatação): <b>{fmtPct(taxaPositiva)}</b>.{" "}
              Tempo médio de abertura (ocorrência → aviso): <b>{fmtDias(tmaMedio)}</b>.{" "}
              Tempo médio de encerramento (aviso → encerramento): <b>{fmtDias(tmeMedio)}</b>.{" "}
              Tempo médio de conclusão de reparo (Perda Parcial): <b>{fmtDias(tmrMedio)}</b>.{" "}
              {(atrasados || semAtu)
                ? <span style={{ color: "var(--danger)", fontWeight: 700 }}>Atenção: {atrasados} processo(s) atrasado(s) e {semAtu} sem atualização há mais de 3 dias.</span>
                : <span style={{ color: "var(--ok)", fontWeight: 700 }}>Nenhum processo atrasado ou sem atualização neste recorte.</span>}
            </p>
          </div>
        </>
      )}

      {mostraSecao("volume") && (
        <>
          <div className="section-title">Volume e Situação</div>
          {algum("vol_total", "vol_andamento", "vol_indenizados", "vol_semIndeniz") && (
            <div className="kpi-grid">
              {mostra("vol_total") && <Kpi n={fmtNum(total)} l="Sinistros no recorte" cls="c-blue" sub={totalGeral !== total ? `de ${fmtNum(totalGeral)} no total` : null} onClick={() => goSinistros({})} title="Ver todos os sinistros deste recorte" />}
              {mostra("vol_andamento") && <Kpi n={fmtNum(emAndamento)} l="Em andamento" cls="c-amber" onClick={() => goSinistros({ status: "Em andamento" })} />}
              {mostra("vol_indenizados") && <Kpi n={fmtNum(indenizados)} l="Indenizados" cls="c-green" sub={`${fmtPct(taxaIndeniz)} de taxa`} onClick={() => goSinistros({ status: "Indenizado" })} />}
              {mostra("vol_semIndeniz") && <Kpi n={fmtNum(semIndeniz)} l="Sem indenização" cls="c-gray" onClick={() => goSinistros({ status: "Encerrado sem Indenização" })} />}
            </div>
          )}
          {algum("vol_pendentes", "vol_negados", "vol_atrasados", "vol_semAtu") && (
            <div className="kpi-grid" style={{ marginTop: 14 }}>
              {mostra("vol_pendentes") && <Kpi n={fmtNum(pendente)} l="Pendentes" cls="c-amber" onClick={() => goSinistros({ status: "Pendente" })} />}
              {mostra("vol_negados") && <Kpi n={fmtNum(negado)} l="Negados" cls="c-red" alert={negado > 0} onClick={() => goSinistros({ status: "Negado" })} />}
              {mostra("vol_atrasados") && <Kpi n={fmtNum(atrasados)} l="Atrasados" cls="c-red" sub="Próxima ação vencida" alert={atrasados > 0} onClick={() => goSinistros({ atrasado: true })} />}
              {mostra("vol_semAtu") && <Kpi n={fmtNum(semAtu)} l="Sem atualização" cls="c-amber" sub="+3 dias sem histórico" alert={semAtu > 0} onClick={() => goSinistros({ semAtu: true })} />}
            </div>
          )}
          {algum("vol_constatacoes", "vol_taxaPositiva") && (
            <div className="kpi-grid" style={{ marginTop: 14 }}>
              {mostra("vol_constatacoes") && <Kpi n={fmtNum(constatacoes)} l="Constatações" cls="c-blue" sub="Cobertura ao terceiro, sem indenização ao segurado" onClick={() => goSinistros({ status: "Constatação" })} />}
              {/* Taxa não é um conjunto de processos (é indenizados + constatações
                  sobre o total), então não tem lista equivalente pra abrir — fica
                  sem clique de propósito, como os cartões de valor e tempo médio. */}
              {mostra("vol_taxaPositiva") && <Kpi n={fmtPct(taxaPositiva)} l="Taxa de desfecho positivo" cls="c-green" sub="Indenizados + Constatações" />}
            </div>
          )}
        </>
      )}

      {mostraSecao("financeiro") && (
        <>
          <div className="section-title">Indicadores Financeiros</div>
          <div className="kpi-grid">
            {mostra("fin_avaliado") && <Kpi n={money(totalAvaliado)} l="Total avaliado" cls="c-blue" />}
            {mostra("fin_indenizado") && <Kpi n={money(totalIndenizado)} l="Total indenizado" cls="c-green" />}
            {mostra("fin_ticket") && <Kpi n={money(ticketMedio)} l="Ticket médio (indenizados)" cls="c-purple" />}
            {mostra("fin_franquia") && <Kpi n={money(totalFranquia)} l="Total em franquias" cls="c-gray" />}
          </div>
        </>
      )}

      {mostraSecao("tempo") && (
        <>
          <div className="section-title">Indicadores de Tempo (SLA de Atendimento)</div>
          <div className="kpi-grid">
            {mostra("tmp_tma") && <Kpi n={fmtDias(tmaMedio)} l="Tempo médio de abertura" cls="c-blue" sub={`Ocorrência → Aviso (n=${tmaArr.length})`} />}
            {mostra("tmp_tme") && <Kpi n={fmtDias(tmeMedio)} l="Tempo médio de encerramento" cls="c-green" sub={`Aviso → Encerramento (n=${tmeArr.length})`} />}
            {mostra("tmp_tmr") && <Kpi n={fmtDias(tmrMedio)} l="Tempo médio de conclusão de reparo" cls="c-amber" sub={`Aviso → Conclusão, Perda Parcial (n=${tmrArr.length})`} />}
            {mostra("tmp_vinculos") && <Kpi n={fmtNum(vinculados)} l="Sinistros com vínculos" cls="c-purple" sub="Segurado + Terceiros relacionados" />}
          </div>
        </>
      )}

      {mostraSecao("distribuicao") && (
        <>
          <div className="section-title">Análise de Distribuição</div>
          <div className="charts-grid c3">
            {mostra("dist_situacao") && <div className="chart-card">
              <h4>Distribuição por Situação</h4>
              <p className="sub">Clique numa fatia para ver os sinistros</p>
              <div className="flexrow">
                <DonutChart data={statusData} onClick={(d) => goSinistros({ status: d.label })} />
                <Legend data={statusData} onClick={(d) => goSinistros({ status: d.label })} />
              </div>
            </div>}
            {mostra("dist_tipo") && <div className="chart-card">
              <h4>Distribuição por Tipo de Parte</h4>
              <p className="sub">Segurado, Terceiro ou Atendimento</p>
              <div className="flexrow">
                <DonutChart data={tipoData} onClick={(d) => goSinistros({ tipo: d.key })} />
                <Legend data={tipoData} onClick={(d) => goSinistros({ tipo: d.key })} />
              </div>
            </div>}
            {mostra("dist_funil") && <div className="chart-card">
              <h4>Funil por Etapa da Jornada</h4>
              <p className="sub">Onde os sinistros em aberto estão parados</p>
              <RankList data={etapaData} onClick={(d) => goSinistros({ etapa: d.label })} />
            </div>}
          </div>
        </>
      )}

      {mostraSecao("evolucao") && (
        <>
          <div className="section-title">Evolução Temporal e Atendimento</div>
          <div className="charts-grid">
            {mostra("evo_mensal") && <div className="chart-card">
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
            </div>}
            {mostra("evo_atendimento") && <div className="chart-card">
              <h4>Análise de Atendimento</h4>
              <p className="sub">Temperatura e situação de atendimento registradas nos processos • clique num item para ver os sinistros</p>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>TEMPERATURA</div>
                  {/* "Não definida" = processo sem termômetro/situação registrados;
                      na tela Sinistros isso é a opção "__sem__" de cada filtro. */}
                  <Legend data={tempData} onClick={(d) => goSinistros({ termometro: d.label === "Não definida" ? "__sem__" : d.label })} />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>SITUAÇÃO DE ATENDIMENTO</div>
                  <Legend data={sitData} onClick={(d) => goSinistros({ sitatend: d.label === "Não definida" ? "__sem__" : d.label })} />
                </div>
              </div>
            </div>}
          </div>
        </>
      )}

      {mostraSecao("rankings") && (
        <>
          <div className="section-title">Rankings por Volume</div>
          <div className="charts-grid">
            {mostra("rk_oficinas") && <div className="chart-card">
              <h4>Top 10 Oficinas/Prestadores por Volume</h4>
              <p className="sub">Clique numa barra para ver os sinistros da oficina</p>
              <RankList data={topOficinas} onClick={(d) => goSinistros({ oficina: d.label })} />
            </div>}
            {mostra("rk_seguradoras") && <div className="chart-card">
              <h4>Top 10 Seguradoras por Volume</h4>
              <p className="sub">Clique numa barra para ver os sinistros da seguradora</p>
              <RankList data={topSeguradoras} onClick={(d) => goSinistros({ cia: d.label })} />
            </div>}
          </div>
        </>
      )}

      {mostraSecao("grupoAgente") && (
        <>
          <div className="section-title">Volume por Grupo de Produtores e Agente</div>
          <div className="charts-grid">
            {mostra("ga_grupos") && <div className="chart-card">
              <h4>Grupos de Produtores por Volume</h4>
              <p className="sub">
                {gruposOcultosNoRecorte ? `${fmtNum(aggGrupoProdutor.length)} de ${fmtNum(aggGrupoTodos.length)} grupo(s)` : `Todos os ${fmtNum(aggGrupoProdutor.length)} grupo(s)`} do recorte • clique numa barra para ver os processos do grupo
                {semGrupo ? ` • ${fmtNum(semGrupo)} sem produtor vinculado` : ""}
                {gruposOcultosNoRecorte ? ` • ${fmtNum(gruposOcultosNoRecorte)} desabilitado(s) em Configurações` : ""}
              </p>
              <RankList data={rankGrupos} onClick={(d) => goSinistros({ grupoProdutor: d.label, agente: "todos" })} />
            </div>}
            {mostra("ga_agentes") && <div className="chart-card">
              <h4>Agentes por Volume</h4>
              <p className="sub">
                Todos os {fmtNum(aggAgente.length)} agente(s) do recorte • clique numa barra para ver os processos do agente
                {semAgente ? ` • ${fmtNum(semAgente)} sem agente vinculado` : ""}
              </p>
              <RankList data={rankAgentes} onClick={(d) => goSinistros({ agente: d.label, grupoProdutor: "todos" })} />
            </div>}
          </div>
        </>
      )}

      {mostraSecao("desempenho") && (
        <>
          <div className="section-title">Cruzamento de Dados — Desempenho Operacional</div>
          {mostra("des_oficina") && <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Desempenho por Oficina/Prestador</h3>
              <span className="muted" style={{ fontSize: 12 }}>{aggOficina.length} oficina(s) no recorte</span>
            </div>
            <p className="muted" style={{ margin: "6px 0 12px" }}>TMR = tempo médio entre o aviso e a conclusão do reparo (etapa "Conclusão", caminho Perda Parcial). Ordenado por volume.</p>
            {aggOficina.length ? <PerfTable headers={["Oficina", "Qtd.", "TMR médio", "Total indenizado", "Ticket médio", "% Atrasados", "Ações"]} rows={oficinaRows} /> : <EmptyState>Sem dados de oficina para este recorte.</EmptyState>}
          </div>}
          {mostra("des_seguradora") && <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Desempenho por Seguradora</h3>
              <span className="muted" style={{ fontSize: 12 }}>{aggSeguradora.length} seguradora(s) no recorte</span>
            </div>
            <p className="muted" style={{ margin: "6px 0 12px" }}>TMA = ocorrência → aviso. TME = aviso → encerramento. Taxa de indenização = indenizados / total de cada seguradora.</p>
            {aggSeguradora.length ? <PerfTable headers={["Seguradora", "Qtd.", "TMA médio", "TME médio", "Total indenizado", "Taxa indeniz.", "Ações"]} rows={seguradoraRows} /> : <EmptyState>Sem dados de seguradora para este recorte.</EmptyState>}
          </div>}
          {mostra("des_ramo") && <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Desempenho por Ramo</h3>
              <span className="muted" style={{ fontSize: 12 }}>{aggRamo.length} ramo(s) no recorte</span>
            </div>
            {aggRamo.length ? <PerfTable headers={["Ramo", "Qtd.", "TMA médio", "TME médio", "TMR médio", "Total indenizado", "Ações"]} rows={ramoRows} /> : <EmptyState>Sem dados de ramo para este recorte.</EmptyState>}
          </div>}

          {mostra("des_grupo") && <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Quantidade de Processos por Grupo de Produtores</h3>
              <span className="muted" style={{ fontSize: 12 }}>
                {aggGrupoProdutor.length} grupo(s) no recorte{gruposOcultosNoRecorte ? ` • ${gruposOcultosNoRecorte} desabilitado(s)` : ""}
              </span>
            </div>
            <p className="muted" style={{ margin: "6px 0 12px" }}>
              Grupo de Produtores = nome do produtor sem o sufixo da unidade/filial (tudo antes do último " - "), então as várias
              unidades do mesmo produtor entram numa linha só. Um processo com mais de um vínculo conta em cada grupo, por isso a
              soma das linhas pode passar do total do recorte.{semGrupo ? ` ${fmtNum(semGrupo)} processo(s) do recorte estão sem produtor vinculado e não aparecem aqui.` : ""}
              {gruposOcultosNoRecorte ? ` ${fmtNum(gruposOcultosNoRecorte)} grupo(s) foram desabilitados em Configurações → Agentes & Produtores e ficam fora desta lista (os processos deles seguem contando nos demais indicadores).` : ""}
            </p>
            {grupoProdutorRows.length ? <PerfTable headers={["Grupo de Produtores", "Qtd.", "% do recorte", "Indenizados", "Atrasados", "Sem atualização", "Ações"]} rows={grupoProdutorRows} /> : <EmptyState>Nenhum produtor vinculado nos processos deste recorte.</EmptyState>}
          </div>}
          {mostra("des_agente") && <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Quantidade de Processos por Agente</h3>
              <span className="muted" style={{ fontSize: 12 }}>{aggAgente.length} agente(s) no recorte</span>
            </div>
            <p className="muted" style={{ margin: "6px 0 12px" }}>
              Mesmo critério do filtro de Agente da tela Sinistros. Um processo com mais de um agente vinculado conta em cada um
              deles.{semAgente ? ` ${fmtNum(semAgente)} processo(s) do recorte estão sem agente vinculado e não aparecem aqui.` : ""}
            </p>
            {agenteRows.length ? <PerfTable headers={["Agente", "Qtd.", "% do recorte", "Indenizados", "Atrasados", "Sem atualização", "Ações"]} rows={agenteRows} /> : <EmptyState>Nenhum agente vinculado nos processos deste recorte.</EmptyState>}
          </div>}
        </>
      )}

      {mostraSecao("criticos") && (
        <>
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
        </>
      )}

      {printOpen && (
        <DashboardPrintModal
          blocos={PRINT_BLOCKS}
          opts={printOpts}
          onToggle={togglePrintOpt}
          onToggleBloco={togglePrintBloco}
          onMarcarTodos={(v) => setPrintOpts(printOptsTodos(v))}
          onConfirm={gerarPdf}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </div>
  );
}

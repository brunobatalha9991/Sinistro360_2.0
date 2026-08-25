import { useMemo, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { useListFilter } from "../hooks/useListFilter";
import { patchListFilter, resetListFilter } from "../state/listFilter";
import { isAdmin } from "../data/auth";
import { EmptyState } from "../components/EmptyState.jsx";
import { ClaimsTable } from "../components/ClaimsTable.jsx";
import { ColumnPicker } from "../components/ColumnPicker.jsx";
import { getAllCols } from "../logic/claimColumns.jsx";
import { loadCols, saveCols } from "../logic/columnPrefs";
import { exportCSV } from "../logic/exportCsv";
import {
  visibleClaims, campoEfetivo, situacaoEfetiva, getUserJourney, getNextAction,
  getSitAtend, getTemp, getResponsavel, isAtrasado, isSemAtualizacao, isManualClaim,
  allJourneyStages, currentStage, getAgenteProdutor, getAgentesEfetivo, distinctGruposProdutores, grupoProdutor,
  distinctComputed, claimTemFlagHistorico,
} from "../logic/claims";

const DEFAULT_TEMP_OPTIONS = ["Tranquilo", "Moderado", "Grave", "Em atenção"];

export function Sinistros() {
  const { records, config } = useData();
  const { navigate } = useHashRoute();
  const { currentUser, currentRole } = useAuth();
  const lf = useListFilter();
  const [pref, setPref] = useState(loadCols);

  const allClaimsRaw = records.corp_claims || [];
  const overrides = records.corp_overrides || {};
  const users = records.corp_users || [];
  const templates = config.corp_journey_templates || {};
  const atendTemplate = config.corp_atendimento_template;
  const sitOptions = config.corp_sit_options || ["Aguard. Cliente", "Aguard. Seguradora", "Aguard. Corretora", "Aguard. Oficina"];
  const tempOptions = config.corp_temp_options && config.corp_temp_options.length ? config.corp_temp_options : DEFAULT_TEMP_OPTIONS;
  // Vínculo de acesso por Agente/Produtor (usuários "Consulta" vinculados)
  // — sem vínculo configurado, não filtra nada.
  const claims = useMemo(() => visibleClaims(records.corp_claims, overrides, currentUser), [records.corp_claims, overrides, currentUser]);
  const agenteOptions = getAgentesEfetivo(config, overrides, claims);
  const grupoProdutorOptions = distinctGruposProdutores(overrides, claims);
  const oficinaOptions = distinctComputed(claims, (x) => campoEfetivo(overrides, x, "oficina"));

  function updatePref(next) { setPref(next); saveCols(next); }

  // Porte 1:1 de passa() do HTML original: cada grupo de contagem aplica
  // todos os filtros MENOS ele mesmo, pra mostrar quantos itens cada opção
  // teria se você a selecionasse a partir do recorte atual.
  function passa(c, except) {
    const q = (lf.q || "").toLowerCase();
    if (except !== "tipo" && lf.tipo !== "todos" && c.partyType !== lf.tipo) return false;
    if (except !== "status" && lf.status !== "todos" && situacaoEfetiva(overrides, c).label !== lf.status) return false;
    if (except !== "etapa" && lf.etapa !== "todos" && currentStage(overrides, templates, atendTemplate, c) !== lf.etapa) return false;
    if (except !== "especial") {
      if (lf.pa) { const na = getNextAction(overrides, c.id); if (!na || !na.date || na.date > lf.pa) return false; }
      if (lf.atrasado && !isAtrasado(overrides, c)) return false;
      if (lf.semAtu && !isSemAtualizacao(overrides, c)) return false;
    }
    if (except !== "manual" && lf.manual && !isManualClaim(c)) return false;
    if (except !== "caminho" && lf.caminho && lf.caminho !== "todos" && (getUserJourney(overrides, c.id) || {}).caminho !== lf.caminho) return false;
    if (except !== "aberto" && lf.aberto) {
      const sl = situacaoEfetiva(overrides, c).label;
      if (sl !== "Pendente" && sl !== "Em andamento") return false;
    }
    if (lf.ocoDe && (!c.datoco || c.datoco < lf.ocoDe)) return false;
    if (lf.ocoAte && (!c.datoco || c.datoco > lf.ocoAte)) return false;
    if (lf.aviDe && (!c.datavi || c.datavi < lf.aviDe)) return false;
    if (lf.aviAte && (!c.datavi || c.datavi > lf.aviAte)) return false;
    if (except !== "responsavel" && lf.responsavel && lf.responsavel !== "todos") {
      const sitR = situacaoEfetiva(overrides, c).label;
      if (sitR !== "Pendente" && sitR !== "Em andamento") return false;
      const rP = getResponsavel(overrides, c.id);
      if (lf.responsavel === "__sem__") { if (rP) return false; }
      else if (!rP || rP.id !== lf.responsavel) return false;
    }
    if (except !== "sitatend" && lf.sitatend && lf.sitatend !== "todas") {
      if (getSitAtend(overrides, c.id) !== lf.sitatend) return false;
    }
    if (except !== "termometro" && lf.termometro && lf.termometro !== "todas") {
      const t = getTemp(overrides, c.id);
      if (lf.termometro === "__sem__") { if (t) return false; }
      else if (t !== lf.termometro) return false;
    }
    if (except !== "agente" && lf.agente && lf.agente !== "todos") {
      const ap = getAgenteProdutor(overrides, c.id);
      if (!ap || (ap.agentes || []).indexOf(lf.agente) < 0) return false;
    }
    if (except !== "grupoProdutor" && lf.grupoProdutor && lf.grupoProdutor !== "todos") {
      const ap = getAgenteProdutor(overrides, c.id);
      if (!ap || !(ap.produtores || []).some((p) => grupoProdutor(p) === lf.grupoProdutor)) return false;
    }
    if (except !== "oficina" && lf.oficina && lf.oficina !== "todas") {
      if (campoEfetivo(overrides, c, "oficina") !== lf.oficina) return false;
    }
    if (except !== "aguardandoRetornoHist" && lf.aguardandoRetornoHist && !claimTemFlagHistorico(overrides, c.id, "aguardandoRetorno")) return false;
    if (except !== "limitacaoComunicacaoHist" && lf.limitacaoComunicacaoHist && !claimTemFlagHistorico(overrides, c.id, "limitacaoComunicacao")) return false;
    if (except !== "texto" && q) {
      const hay = [campoEfetivo(overrides, c, "segurado"), campoEfetivo(overrides, c, "placa"), campoEfetivo(overrides, c, "numsin"), campoEfetivo(overrides, c, "numapo"), campoEfetivo(overrides, c, "cia"), c.partyType, campoEfetivo(overrides, c, "oficina"), campoEfetivo(overrides, c, "ramo")].join(" ").toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }

  const baseTipo = claims.filter((c) => passa(c, "tipo"));
  const baseStatus = claims.filter((c) => passa(c, "status"));
  const baseEtapa = claims.filter((c) => passa(c, "etapa"));
  const baseEspec = claims.filter((c) => passa(c, "especial"));
  const baseManual = claims.filter((c) => passa(c, "manual"));
  const baseAberto = claims.filter((c) => passa(c, "aberto"));
  const baseCaminho = claims.filter((c) => passa(c, "caminho"));
  const baseAguardHist = claims.filter((c) => passa(c, "aguardandoRetornoHist"));
  const baseLimComHist = claims.filter((c) => passa(c, "limitacaoComunicacaoHist"));

  const cntTipo = {}; let totalNaoFinal = 0;
  baseTipo.forEach((c) => {
    if (situacaoEfetiva(overrides, c).label !== "Indenizado" && situacaoEfetiva(overrides, c).label !== "Encerrado sem Indenização") {
      cntTipo[c.partyType] = (cntTipo[c.partyType] || 0) + 1;
      totalNaoFinal++;
    }
  });
  const ct = (key) => (key === "todos" ? totalNaoFinal : cntTipo[key] || 0);

  const cntStatus = {};
  baseStatus.forEach((c) => { const lb = situacaoEfetiva(overrides, c).label; cntStatus[lb] = (cntStatus[lb] || 0) + 1; });
  const cs = (key) => (key === "todos" ? baseStatus.length : cntStatus[key] || 0);

  const statusChips = [["todos", "Todos"], ["Em andamento", "Em andamento"], ["Pendente", "Pendentes"], ["Indenizado", "Indenizados"], ["Encerrado sem Indenização", "Sem indenização"]];
  const tipoChips = [["todos", "Todos os tipos"], ["Segurado", "Segurados"], ["Terceiro", "Terceiros"], ["Aviso", "Atendimentos"]];

  const qtdParcial = baseCaminho.filter((c) => (getUserJourney(overrides, c.id) || {}).caminho === "parcial").length;
  const qtdIntegral = baseCaminho.filter((c) => (getUserJourney(overrides, c.id) || {}).caminho === "integral").length;
  const qtdAtrasado = baseEspec.filter((c) => isAtrasado(overrides, c)).length;
  const qtdSemAtu = baseEspec.filter((c) => isSemAtualizacao(overrides, c)).length;
  const qtdManual = baseManual.filter(isManualClaim).length;
  const qtdAberto = baseAberto.filter((c) => { const l = situacaoEfetiva(overrides, c).label; return l === "Pendente" || l === "Em andamento"; }).length;
  const qtdAguardHist = baseAguardHist.filter((c) => claimTemFlagHistorico(overrides, c.id, "aguardandoRetorno")).length;
  const qtdLimComHist = baseLimComHist.filter((c) => claimTemFlagHistorico(overrides, c.id, "limitacaoComunicacao")).length;

  const stageNames = allJourneyStages(templates, atendTemplate);
  const stageCounts = {}; let stageTotal = 0;
  baseEtapa.forEach((c) => { const s = currentStage(overrides, templates, atendTemplate, c); if (s) { stageCounts[s] = (stageCounts[s] || 0) + 1; stageTotal++; } });
  const etapaChips = [["todos", `Todas etapas (${stageTotal})`]].concat(stageNames.map((n) => [n, `${n} (${stageCounts[n] || 0})`]));

  // filtro final exibido na tabela (mesma lógica de renderList() do original)
  const q = (lf.q || "").toLowerCase();
  const rows = claims.filter((c) => {
    if (lf.status !== "todos" && situacaoEfetiva(overrides, c).label !== lf.status) return false;
    if (lf.tipo !== "todos" && c.partyType !== lf.tipo) return false;
    if (lf.etapa !== "todos" && currentStage(overrides, templates, atendTemplate, c) !== lf.etapa) return false;
    if (lf.pa) { const na = getNextAction(overrides, c.id); if (!na || !na.date || na.date > lf.pa) return false; }
    if (lf.atrasado && !isAtrasado(overrides, c)) return false;
    if (lf.semAtu && !isSemAtualizacao(overrides, c)) return false;
    if (lf.manual && !isManualClaim(c)) return false;
    if (lf.caminho && lf.caminho !== "todos" && (getUserJourney(overrides, c.id) || {}).caminho !== lf.caminho) return false;
    if (lf.aberto) {
      const sl = situacaoEfetiva(overrides, c).label;
      if (sl !== "Pendente" && sl !== "Em andamento") return false;
    }
    if (lf.ocoDe && (!c.datoco || c.datoco < lf.ocoDe)) return false;
    if (lf.ocoAte && (!c.datoco || c.datoco > lf.ocoAte)) return false;
    if (lf.aviDe && (!c.datavi || c.datavi < lf.aviDe)) return false;
    if (lf.aviAte && (!c.datavi || c.datavi > lf.aviAte)) return false;
    if (lf.responsavel && lf.responsavel !== "todos") {
      const sL = situacaoEfetiva(overrides, c).label;
      if (sL !== "Pendente" && sL !== "Em andamento") return false;
      const rL = getResponsavel(overrides, c.id);
      if (lf.responsavel === "__sem__") { if (rL) return false; }
      else if (!rL || rL.id !== lf.responsavel) return false;
    }
    if (lf.sitatend && lf.sitatend !== "todas") {
      if (getSitAtend(overrides, c.id) !== lf.sitatend) return false;
    }
    if (lf.termometro && lf.termometro !== "todas") {
      const t = getTemp(overrides, c.id);
      if (lf.termometro === "__sem__") { if (t) return false; }
      else if (t !== lf.termometro) return false;
    }
    if (lf.agente && lf.agente !== "todos") {
      const ap = getAgenteProdutor(overrides, c.id);
      if (!ap || (ap.agentes || []).indexOf(lf.agente) < 0) return false;
    }
    if (lf.grupoProdutor && lf.grupoProdutor !== "todos") {
      const ap = getAgenteProdutor(overrides, c.id);
      if (!ap || !(ap.produtores || []).some((p) => grupoProdutor(p) === lf.grupoProdutor)) return false;
    }
    if (lf.oficina && lf.oficina !== "todas" && campoEfetivo(overrides, c, "oficina") !== lf.oficina) return false;
    if (lf.aguardandoRetornoHist && !claimTemFlagHistorico(overrides, c.id, "aguardandoRetorno")) return false;
    if (lf.limitacaoComunicacaoHist && !claimTemFlagHistorico(overrides, c.id, "limitacaoComunicacao")) return false;
    if (!q) return true;
    return [campoEfetivo(overrides, c, "segurado"), campoEfetivo(overrides, c, "placa"), campoEfetivo(overrides, c, "numsin"), campoEfetivo(overrides, c, "numapo"), campoEfetivo(overrides, c, "cia"), c.partyType, campoEfetivo(overrides, c, "oficina"), campoEfetivo(overrides, c, "ramo")].join(" ").toLowerCase().indexOf(q) >= 0;
  });

  let activeCount = 0;
  if (lf.tipo && lf.tipo !== "todos") activeCount++;
  if (lf.status && lf.status !== "todos") activeCount++;
  if (lf.etapa && lf.etapa !== "todos") activeCount++;
  if (lf.ocoDe || lf.ocoAte) activeCount++;
  if (lf.aviDe || lf.aviAte) activeCount++;
  if (lf.pa) activeCount++;
  if (lf.atrasado) activeCount++;
  if (lf.semAtu) activeCount++;
  if (lf.manual) activeCount++;
  if (lf.aberto) activeCount++;
  if (lf.caminho && lf.caminho !== "todos") activeCount++;
  if (lf.agente && lf.agente !== "todos") activeCount++;
  if (lf.grupoProdutor && lf.grupoProdutor !== "todos") activeCount++;
  if (lf.oficina && lf.oficina !== "todas") activeCount++;
  if (lf.aguardandoRetornoHist) activeCount++;
  if (lf.limitacaoComunicacaoHist) activeCount++;

  const allCols = getAllCols({ overrides, allClaimsRaw, navigate });

  function dtField(label, keyDe, keyAte) {
    return (
      <div className="chips" style={{ alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>{label}:</span>
        <span className="muted" style={{ fontSize: 12 }}>de</span>
        <input type="date" className="inline" style={{ minWidth: 140 }} value={lf[keyDe] || ""} onChange={(e) => patchListFilter({ [keyDe]: e.target.value })} />
        <span className="muted" style={{ fontSize: 12 }}>até</span>
        <input type="date" className="inline" style={{ minWidth: 140 }} value={lf[keyAte] || ""} onChange={(e) => patchListFilter({ [keyAte]: e.target.value })} />
        {(lf[keyDe] || lf[keyAte]) && (
          <button className="chip-btn" onClick={() => patchListFilter({ [keyDe]: "", [keyAte]: "" })}>limpar</button>
        )}
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>Sinistros</h1><p>{claims.length} registros (segurados, terceiros e avisos) da API CORP</p></div>
        <button className="btn" onClick={() => navigate("integracao")}>↻ Sincronizar</button>
      </div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <button className={"btn" + (lf.showFilters ? "" : " sec")} onClick={() => patchListFilter({ showFilters: !lf.showFilters })}>
            {lf.showFilters ? "▲ Ocultar filtros" : "▼ Filtros"}
          </button>
          {activeCount ? <span className="badge blue">{activeCount} filtro(s) ativo(s)</span> : <span className="muted" style={{ fontSize: 12 }}>Nenhum filtro ativo</span>}
          <button className="btn sec sm" onClick={resetListFilter}>Limpar todos os filtros</button>
        </div>

        <div className={lf.showFilters ? "" : "hidden"} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "4px 14px", marginBottom: 14, background: "var(--surface-2)" }}>
          <div className="filter-group">
            <div className="filter-group-title">Tipo de parte</div>
            <div className="chips">
              {tipoChips.map(([k, label]) => (
                <div key={k} className={"chip-btn" + (lf.tipo === k ? " active" : "")} onClick={() => patchListFilter({ tipo: k })}>{label} ({ct(k)})</div>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-group-title">Datas</div>
            {dtField("Dt. Ocorrência", "ocoDe", "ocoAte")}
            {dtField("Dt. Aviso", "aviDe", "aviAte")}
          </div>

          <div className="filter-group">
            <div className="filter-group-title">Situação do processo</div>
            <div className="chips">
              {statusChips.map(([k, label]) => (
                <div key={k} className={"chip-btn" + (lf.status === k ? " active" : "")} onClick={() => patchListFilter({ status: k })}>{label} ({cs(k)})</div>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-group-title">Caminho e etapa da jornada</div>
            <div className="chips">
              <span className="muted" style={{ fontSize: 12, marginRight: 4, alignSelf: "center" }}>Caminho:</span>
              <div className={"chip-btn" + (lf.caminho === "todos" ? " active" : "")} onClick={() => patchListFilter({ caminho: "todos" })}>Todos</div>
              <div className={"chip-btn" + (lf.caminho === "parcial" ? " active" : "")} onClick={() => patchListFilter({ caminho: "parcial" })}>Perda Parcial ({qtdParcial})</div>
              <div className={"chip-btn" + (lf.caminho === "integral" ? " active" : "")} onClick={() => patchListFilter({ caminho: "integral" })}>Perda Integral ({qtdIntegral})</div>
            </div>
            <div className="chips">
              {etapaChips.map(([k, label]) => (
                <div key={k} className={"chip-btn" + (lf.etapa === k ? " active" : "")} onClick={() => patchListFilter({ etapa: k })}>{label}</div>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-group-title">Prazos e alertas</div>
            <div className="chips" style={{ alignItems: "center" }}>
              <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Próxima ação até:</span>
              <input type="date" className="inline" style={{ minWidth: 150 }} value={lf.pa || ""} onChange={(e) => patchListFilter({ pa: e.target.value })} />
              {lf.pa && <button className="chip-btn" onClick={() => patchListFilter({ pa: "" })}>limpar data</button>}
              <div className={"chip-btn" + (lf.atrasado ? " active" : "")} onClick={() => patchListFilter({ atrasado: !lf.atrasado })}>⏰ Atrasados ({qtdAtrasado})</div>
              <div className={"chip-btn" + (lf.semAtu ? " active" : "")} onClick={() => patchListFilter({ semAtu: !lf.semAtu })}>🔕 Sem atualização ({qtdSemAtu})</div>
              <div className={"chip-btn" + (lf.manual ? " active" : "")} onClick={() => patchListFilter({ manual: !lf.manual })}>✎ Criados manualmente ({qtdManual})</div>
              <div className={"chip-btn" + (lf.aberto ? " active" : "")} onClick={() => patchListFilter({ aberto: !lf.aberto })}>📂 Em aberto (Pendente/Em andamento) ({qtdAberto})</div>
              <div className={"chip-btn" + (lf.aguardandoRetornoHist ? " active" : "")} onClick={() => patchListFilter({ aguardandoRetornoHist: !lf.aguardandoRetornoHist })}>⏳ Aguardando retorno ({qtdAguardHist})</div>
              <div className={"chip-btn" + (lf.limitacaoComunicacaoHist ? " active" : "")} onClick={() => patchListFilter({ limitacaoComunicacaoHist: !lf.limitacaoComunicacaoHist })}>🚧 Limitação de comunicação ({qtdLimComHist})</div>
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-group-title">Atendimento</div>
            <div className="chips" style={{ alignItems: "center" }}>
              <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Situação:</span>
              <select className="inline" style={{ minWidth: 180 }} value={lf.sitatend} onChange={(e) => patchListFilter({ sitatend: e.target.value })}>
                <option value="todas">Todas as situações</option>
                {sitOptions.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <span className="muted" style={{ fontSize: 12, marginLeft: 8, marginRight: 4 }}>Termômetro:</span>
              <select className="inline" style={{ minWidth: 180 }} value={lf.termometro} onChange={(e) => patchListFilter({ termometro: e.target.value })}>
                <option value="todas">Todos os termômetros</option>
                <option value="__sem__">⚠ Não definida</option>
                {tempOptions.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-group-title">Responsável</div>
            <div className="chips" style={{ alignItems: "center" }}>
              <select className="inline" style={{ minWidth: 200 }} value={lf.responsavel} onChange={(e) => patchListFilter({ responsavel: e.target.value })}>
                <option value="todos">Responsável: todos</option>
                {(currentRole === "atendente" || isAdmin(currentUser)) && <option value="__sem__">⚠ Sem responsável (definir)</option>}
                {users.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              <span className="muted" style={{ fontSize: 11 }}>(traz apenas Pendente / Em andamento)</span>
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-group-title">Agente / Grupo de Produtores</div>
            <div className="chips" style={{ alignItems: "center" }}>
              <select className="inline" style={{ minWidth: 200 }} value={lf.agente} onChange={(e) => patchListFilter({ agente: e.target.value })}>
                <option value="todos">Agente: todos</option>
                {agenteOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select className="inline" style={{ minWidth: 200 }} value={lf.grupoProdutor} onChange={(e) => patchListFilter({ grupoProdutor: e.target.value })}>
                <option value="todos">Grupo de Produtores: todos</option>
                {grupoProdutorOptions.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <span className="muted" style={{ fontSize: 11 }}>(dados de processos já buscados — importe em lote em Configurações se faltar algum)</span>
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-group-title">Oficina</div>
            <div className="chips" style={{ alignItems: "center" }}>
              <select className="inline" style={{ minWidth: 220 }} value={lf.oficina} onChange={(e) => patchListFilter({ oficina: e.target.value })}>
                <option value="todas">Oficina: todas</option>
                {oficinaOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="toolbar">
          <input placeholder="Buscar por nome, placa, nº sinistro, tipo (segurado/terceiro)..." value={lf.q} onChange={(e) => patchListFilter({ q: e.target.value })} />
          <button className="btn sec sm" onClick={() => exportCSV(rows)}>Exportar CSV</button>
          <button className="btn ghost sm" onClick={() => navigate("integracao")}>↻ Sincronizar</button>
        </div>

        <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
          {rows.length} registro(s) exibido(s) de {claims.length} no total
        </div>
        <ColumnPicker allCols={allCols} pref={pref} onChange={updatePref} />
        {rows.length ? <ClaimsTable rows={rows} allCols={allCols} pref={pref} onPrefChange={updatePref} /> : <EmptyState>Nenhum registro encontrado.</EmptyState>}
      </div>
    </div>
  );
}

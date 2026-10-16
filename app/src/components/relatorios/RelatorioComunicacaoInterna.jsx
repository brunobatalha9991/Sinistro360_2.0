import { useMemo, useState } from "react";
import { useData } from "../../data/DataProvider.jsx";
import { useAuth } from "../../hooks/useAuth";
import { isAdmin } from "../../data/auth";
import { EmptyState } from "../EmptyState.jsx";
import { visibleClaims } from "../../logic/claims";
import { tarefasNoEscopo, TASK_FLAGS_DEFAULT } from "../../logic/tasks";
import { fmtDateBR, todayISO } from "../../logic/format";
import { downloadXlsx } from "../../logic/xlsxExport";
import {
  COLUNAS_COMUNICACAO, FILTRO_COMUNICACAO_PADRAO, TIPO_ATENDIMENTO_LABEL,
  montarLinhasComunicacao, filtrarLinhasComunicacao, ordenarLinhasComunicacao,
} from "../../logic/relatorioComunicacaoInterna";
import { RelatorioTabela, RelatorioPrintView, RelatorioHeader } from "./RelatorioBase.jsx";
import { useImpressaoRelatorio } from "../../hooks/useImpressaoRelatorio";

const TITULO = "Comunicação interna";
const DEFAULT_TASK_TYPES = ["Comunicação", "Lembrete", "Tarefa", "Mesa de Atendimento"];
const STATUS = [["todas", "Todos"], ["em_aberto", "Em aberto"], ["Pendente", "Pendente"], ["Em andamento", "Em andamento"], ["Concluído", "Concluído"]];
const URGENCIAS = [["todas", "Todas"], ["Urgente", "Urgente"], ["Moderado", "Moderado"], ["Leve", "Leve"]];
const LEITURA = [
  ["todas", "Todas"], ["todos_cientes", "Todos os destinatários cientes"],
  ["pendente_ciencia", "Algum destinatário sem ciente"], ["nao_lida", "Algum destinatário não leu"],
];
const ARQUIVADAS = [["incluir", "Incluir arquivadas"], ["excluir", "Sem arquivadas"], ["somente", "Somente arquivadas"]];
const COLUNAS_PADRAO = () => Object.fromEntries(COLUNAS_COMUNICACAO.map((c) => [c.key, c.padrao !== false]));

function Sel({ label, value, onChange, opcoes, minWidth = 150 }) {
  return (
    <div className="field" style={{ minWidth }}>
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

export function RelatorioComunicacaoInterna({ onVoltar }) {
  const { records, config } = useData();
  const { currentUser } = useAuth();
  const overrides = records.corp_overrides || {};
  const users = records.corp_users || [];
  const claims = useMemo(() => visibleClaims(records.corp_claims, overrides, currentUser), [records.corp_claims, overrides, currentUser]);
  // Mesmo escopo do módulo Comunicação: admin/VIP enxergam todas as
  // tarefas; os demais só aquelas em que são origem ou destinatário.
  const podeVerTodos = isAdmin(currentUser);
  const escopoId = podeVerTodos ? null : currentUser && currentUser.id;
  const tasks = useMemo(() => tarefasNoEscopo(records.corp_tasks, escopoId), [records.corp_tasks, escopoId]);

  const [f, setF] = useState(FILTRO_COMUNICACAO_PADRAO);
  const [cols, setCols] = useState(COLUNAS_PADRAO);
  const [colsAberto, setColsAberto] = useState(false);
  const { printing, imprimir } = useImpressaoRelatorio();
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const todasLinhas = useMemo(
    () => montarLinhasComunicacao({ tasks, notifs: records.corp_notifs || [], users, claims, overrides, config }),
    [tasks, records.corp_notifs, users, claims, overrides, config],
  );
  const linhas = ordenarLinhasComunicacao(filtrarLinhasComunicacao(todasLinhas, f));
  const colunas = COLUNAS_COMUNICACAO.filter((c) => cols[c.key]);

  const taskTypes = config.corp_task_types && config.corp_task_types.length ? config.corp_task_types : DEFAULT_TASK_TYPES;
  const taskFlags = config.corp_task_flags && config.corp_task_flags.length ? config.corp_task_flags : TASK_FLAGS_DEFAULT;
  const nomeUser = (id) => (users.find((u) => u.id === id) || {}).nome || "?";
  const origemIds = [...new Set(todasLinhas.map((l) => l.origemId).filter(Boolean))];
  const destIds = [...new Set(todasLinhas.flatMap((l) => l.destinatarioIds))];
  const porNome = (a, b) => nomeUser(a).localeCompare(nomeUser(b), "pt-BR");

  const labelDe = (lista, v) => (lista.find(([k]) => k === v) || [v, v])[1];
  const filtrosTxt = [
    f.criadaDe || f.criadaAte ? `Criadas ${f.criadaDe ? "de " + fmtDateBR(f.criadaDe) : ""}${f.criadaAte ? " até " + fmtDateBR(f.criadaAte) : ""}` : null,
    f.status !== "todas" ? `Status: ${labelDe(STATUS, f.status)}` : null,
    f.tipo !== "todos" ? `Tipo: ${f.tipo}` : null,
    f.urgencia !== "todas" ? `Urgência: ${f.urgencia}` : null,
    f.atendimento !== "todos" ? `Atendimento: ${f.atendimento}` : null,
    f.origem !== "todos" ? `Origem: ${nomeUser(f.origem)}` : null,
    f.destinatario !== "todos" ? `Destinatário: ${nomeUser(f.destinatario)}` : null,
    f.leitura !== "todas" ? `Leitura: ${labelDe(LEITURA, f.leitura)}` : null,
    f.emergencia !== "todas" ? `Emergência: ${f.emergencia === "sim" ? "Sim" : "Não"}` : null,
    f.sinalizador !== "todos" ? `Sinalizador: ${f.sinalizador}` : null,
    f.arquivadas !== "incluir" ? labelDe(ARQUIVADAS, f.arquivadas) : null,
    f.q ? `Busca: "${f.q}"` : null,
    !podeVerTodos ? `Somente comunicações de ${currentUser.nome} (origem ou destinatário)` : null,
  ].filter(Boolean);

  function exportarExcel() {
    downloadXlsx({
      fileName: `relatorio_comunicacao_interna_${todayISO()}.xlsx`,
      sheetName: "Comunicação interna",
      columns: colunas,
      rows: linhas.map((l) => colunas.map((c) => l[c.key])),
    });
  }

  if (printing) {
    return <RelatorioPrintView titulo={`Relatório — ${TITULO}`} currentUser={currentUser} total={linhas.length} filtrosTxt={filtrosTxt} colunas={colunas} linhas={linhas} />;
  }

  const qtdFiltros = filtrosTxt.length - (podeVerTodos ? 0 : 1);
  const resumo = {
    abertas: linhas.filter((l) => l.status !== "Concluído").length,
    pendCiencia: linhas.filter((l) => l.qtdDestinatarios && !l.todosCientes).length,
    emergencias: linhas.filter((l) => l.emergencia === "Sim").length,
    vencidas: linhas.filter((l) => l.atrasada === "Sim").length,
  };

  return (
    <div className="page-enter">
      <RelatorioHeader
        titulo={TITULO}
        descricao="Todas as tarefas/comunicações com origem, destinatários, confirmação de leitura, indicadores, vínculos e datas."
        onVoltar={onVoltar} onExcel={exportarExcel} onPdf={imprimir} desabilitado={!linhas.length || !colunas.length}
      />

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Filtros da emissão</h3>
          <button className="btn ghost xs" disabled={!qtdFiltros} onClick={() => setF(FILTRO_COMUNICACAO_PADRAO)}>Limpar filtros (emissão geral)</button>
        </div>
        <div className="rel-filtros">
          <div className="field"><label>Criada de</label><input type="date" value={f.criadaDe} onChange={(e) => set({ criadaDe: e.target.value })} /></div>
          <div className="field"><label>Criada até</label><input type="date" value={f.criadaAte} onChange={(e) => set({ criadaAte: e.target.value })} /></div>
          <Sel label="Status" value={f.status} onChange={(v) => set({ status: v })} opcoes={STATUS} />
          <Sel label="Tipo" value={f.tipo} onChange={(v) => set({ tipo: v })} opcoes={[["todos", "Todos"], ...taskTypes.map((t) => [t, t])]} />
          <Sel label="Urgência" value={f.urgencia} onChange={(v) => set({ urgencia: v })} opcoes={URGENCIAS} />
          <Sel label="Atendimento" value={f.atendimento} onChange={(v) => set({ atendimento: v })} opcoes={[["todos", "Todos"], ...Object.values(TIPO_ATENDIMENTO_LABEL).map((l) => [l, l])]} />
          <Sel label="Origem" value={f.origem} onChange={(v) => set({ origem: v })} opcoes={[["todos", "Todos"], ...origemIds.sort(porNome).map((id) => [id, nomeUser(id)])]} />
          <Sel label="Destinatário" value={f.destinatario} onChange={(v) => set({ destinatario: v })} opcoes={[["todos", "Todos"], ...destIds.sort(porNome).map((id) => [id, nomeUser(id)])]} />
          <Sel label="Confirmação de leitura" value={f.leitura} onChange={(v) => set({ leitura: v })} opcoes={LEITURA} minWidth={210} />
          <Sel label="Emergência" value={f.emergencia} onChange={(v) => set({ emergencia: v })} opcoes={[["todas", "Todas"], ["sim", "Sim"], ["nao", "Não"]]} />
          <Sel label="Sinalizador" value={f.sinalizador} onChange={(v) => set({ sinalizador: v })} opcoes={[["todos", "Todos"], ...taskFlags.map((t) => [t, t])]} />
          <Sel label="Arquivadas" value={f.arquivadas} onChange={(v) => set({ arquivadas: v })} opcoes={ARQUIVADAS} />
          <div className="field"><label>Buscar (protocolo, título, descrição)</label><input value={f.q} placeholder="Ex.: CI-000123" onChange={(e) => set({ q: e.target.value })} /></div>
        </div>

        <div style={{ marginTop: 12, borderTop: "1px solid var(--border-soft)", paddingTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Colunas do relatório ({colunas.length} de {COLUNAS_COMUNICACAO.length})</span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="btn ghost xs" onClick={() => setCols(Object.fromEntries(COLUNAS_COMUNICACAO.map((c) => [c.key, true])))}>Todas</button>
              <button className="btn ghost xs" onClick={() => setCols(COLUNAS_PADRAO())}>Padrão</button>
              <button className="btn sec xs" onClick={() => setColsAberto((v) => !v)}>{colsAberto ? "Ocultar" : "Escolher colunas"}</button>
            </span>
          </div>
          {colsAberto && (
            <div className="rel-colunas">
              {COLUNAS_COMUNICACAO.map((c) => (
                <label key={c.key}>
                  <input type="checkbox" style={{ width: "auto" }} checked={!!cols[c.key]} onChange={(e) => setCols((x) => ({ ...x, [c.key]: e.target.checked }))} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
          {colunas.length > 14 && (
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Com muitas colunas o PDF fica com letra pequena — para o PDF, prefira as colunas principais. O Excel comporta todas.
            </div>
          )}
        </div>
      </div>

      <div className="rel-resumo">
        <span><b>{linhas.length}</b> comunicação(ões)</span>
        <span><b>{resumo.abertas}</b> em aberto</span>
        <span><b>{resumo.pendCiencia}</b> com destinatário sem ciente</span>
        <span><b>{resumo.vencidas}</b> com próx. ação vencida</span>
        <span><b>{resumo.emergencias}</b> emergência(s)</span>
      </div>

      <div className="card">
        {linhas.length && colunas.length ? (
          <div className="rel-acomp-wrap">
            <RelatorioTabela colunas={colunas} linhas={linhas} />
          </div>
        ) : (
          <EmptyState>{colunas.length ? "Nenhuma comunicação no recorte selecionado." : "Marque ao menos uma coluna."}</EmptyState>
        )}
        <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
          Confirmação de leitura: <b>Ciente</b> = clicou em "✓ Ciente" depois da última ação; <b>Ciente (versão anterior)</b> = clicou, mas a tarefa mudou depois;
          {" "}<b>Lida, sem ciente</b> = abriu a tarefa sem clicar em Ciente; <b>Não lida</b> = tem notificação ainda não aberta.
          {" "}Tarefas concluídas há mais de 15 dias são apagadas automaticamente pelo módulo Comunicação e não aparecem aqui.
        </div>
      </div>
    </div>
  );
}

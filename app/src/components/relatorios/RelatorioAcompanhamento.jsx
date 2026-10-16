import { useMemo, useState } from "react";
import { useData } from "../../data/DataProvider.jsx";
import { useAuth } from "../../hooks/useAuth";
import { EmptyState } from "../EmptyState.jsx";
import { visibleClaims, situacaoEfetiva } from "../../logic/claims";
import { todayISO } from "../../logic/format";
import { downloadXlsx } from "../../logic/xlsxExport";
import { COLUNAS_ACOMPANHAMENTO, linhaAcompanhamento, ordenarLinhas } from "../../logic/relatorioAcompanhamento";
import { RelatorioTabela, RelatorioPrintView, RelatorioHeader } from "./RelatorioBase.jsx";
import { useImpressaoRelatorio } from "../../hooks/useImpressaoRelatorio";

const TIPOS = [["todos", "Todos"], ["Atendimento", "Atendimento"], ["Segurado", "Segurado"], ["Terceiro", "Terceiro"]];
const TITULO = "Acompanhamento de processos";

export function RelatorioAcompanhamento({ onVoltar }) {
  const { records, config } = useData();
  const { currentUser } = useAuth();
  const overrides = records.corp_overrides || {};
  const templates = config.corp_journey_templates || {};
  const atendTemplate = config.corp_atendimento_template;
  // Sempre com overrides + currentUser: sem eles, usuários Consulta com
  // vínculo de Agente/Produtor veriam processos de fora do seu recorte.
  const claims = useMemo(() => visibleClaims(records.corp_claims, overrides, currentUser), [records.corp_claims, overrides, currentUser]);

  const [tipo, setTipo] = useState("todos");
  const [responsavel, setResponsavel] = useState("todos");
  const [soAberto, setSoAberto] = useState(true);
  const { printing, imprimir } = useImpressaoRelatorio();

  const todasLinhas = useMemo(() => {
    const base = soAberto
      ? claims.filter((c) => { const l = situacaoEfetiva(overrides, c, atendTemplate, templates).label; return l === "Pendente" || l === "Em andamento"; })
      : claims;
    return ordenarLinhas(base.map((c) => linhaAcompanhamento(overrides, c)));
  }, [claims, overrides, atendTemplate, templates, soAberto]);

  const responsaveis = useMemo(
    () => [...new Set(todasLinhas.map((l) => l.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [todasLinhas],
  );

  const linhas = todasLinhas.filter((l) =>
    (tipo === "todos" || l.tipo === tipo)
    && (responsavel === "todos" || (responsavel === "__sem__" ? !l.responsavel : l.responsavel === responsavel)));

  const filtrosTxt = [
    soAberto ? "Somente em aberto (Pendente / Em andamento)" : "Todas as situações",
    tipo !== "todos" ? `Tipo: ${tipo}` : null,
    responsavel !== "todos" ? `Responsável: ${responsavel === "__sem__" ? "Sem responsável" : responsavel}` : null,
  ].filter(Boolean);

  function exportarExcel() {
    downloadXlsx({
      fileName: `relatorio_acompanhamento_${todayISO()}.xlsx`,
      sheetName: "Acompanhamento",
      columns: COLUNAS_ACOMPANHAMENTO,
      rows: linhas.map((l) => COLUNAS_ACOMPANHAMENTO.map((c) => l[c.key])),
    });
  }

  if (printing) {
    return <RelatorioPrintView titulo={TITULO} currentUser={currentUser} total={linhas.length} filtrosTxt={filtrosTxt} colunas={COLUNAS_ACOMPANHAMENTO} linhas={linhas} />;
  }

  return (
    <div className="page-enter">
      <RelatorioHeader
        titulo={TITULO} descricao="Último histórico e próxima ação de cada processo."
        onVoltar={onVoltar} onExcel={exportarExcel} onPdf={imprimir} desabilitado={!linhas.length}
      />
      <div className="card">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Responsável</label>
            <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="__sem__">Sem responsável</option>
              {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer", paddingBottom: 8 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={soAberto} onChange={(e) => setSoAberto(e.target.checked)} />
            Somente em aberto (Pendente / Em andamento)
          </label>
          <span className="muted" style={{ fontSize: 12.5, paddingBottom: 8 }}>{linhas.length} processo(s)</span>
        </div>

        {linhas.length ? (
          <div className="rel-acomp-wrap">
            <RelatorioTabela colunas={COLUNAS_ACOMPANHAMENTO} linhas={linhas} />
          </div>
        ) : (
          <EmptyState>Nenhum processo no recorte selecionado.</EmptyState>
        )}
      </div>
    </div>
  );
}

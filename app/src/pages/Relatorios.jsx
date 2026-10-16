import { useEffect, useMemo, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "../components/EmptyState.jsx";
import { mapSituacao } from "../logic/situacao";
import { visibleClaims, situacaoEfetiva } from "../logic/claims";
import { fmtDateBR, fmtDateHoraBR, todayISO } from "../logic/format";
import { downloadXlsx } from "../logic/xlsxExport";
import { COLUNAS_ACOMPANHAMENTO, linhaAcompanhamento, ordenarLinhas } from "../logic/relatorioAcompanhamento";

function MiniTable({ data }) {
  const keys = Object.keys(data);
  if (!keys.length) return <EmptyState>Sem dados.</EmptyState>;
  return (
    <table>
      <tbody>
        {keys.map((x) => (
          <tr key={x}>
            <td>{x}</td>
            <td className="right mono">{String(data[x])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TIPOS = [["todos", "Todos"], ["Atendimento", "Atendimento"], ["Segurado", "Segurado"], ["Terceiro", "Terceiro"]];

function TabelaAcompanhamento({ linhas }) {
  return (
    <table className="rel-acomp-table">
      <thead>
        <tr>{COLUNAS_ACOMPANHAMENTO.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.id}>
            {COLUNAS_ACOMPANHAMENTO.map((c) => (
              <td key={c.key} className={c.type === "date" ? "mono nowrap" : c.type === "wrap" ? "pre" : ""}>
                {c.type === "date" ? (l[c.key] ? fmtDateBR(l[c.key]) : "—") : l[c.key] || "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Porte 1:1 de Pages.relatorios() do HTML original + relatório de
// Acompanhamento (Excel/PDF).
export function Relatorios() {
  const { records, config } = useData();
  const { currentUser } = useAuth();
  const overrides = records.corp_overrides || {};
  const templates = config.corp_journey_templates || {};
  const atendTemplate = config.corp_atendimento_template;
  // Sempre com overrides + currentUser: sem eles, usuários Consulta com
  // vínculo de Agente/Produtor veriam processos de fora do seu recorte.
  const claims = useMemo(() => visibleClaims(records.corp_claims, overrides, currentUser), [records.corp_claims, overrides, currentUser]);

  const porSit = {};
  const porCia = {};
  claims.forEach((c) => {
    const s = mapSituacao(c.situacao).label;
    porSit[s] = (porSit[s] || 0) + 1;
    if (c.cia) porCia[c.cia] = (porCia[c.cia] || 0) + 1;
  });

  // ---- Relatório de Acompanhamento ----
  const [tipo, setTipo] = useState("todos");
  const [responsavel, setResponsavel] = useState("todos");
  const [soAberto, setSoAberto] = useState(true);
  const [printing, setPrinting] = useState(false);

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

  // PDF pelo próprio navegador (window.print), igual ao Dashboard: sai
  // vetorial e sem dependência nova. Durante `printing` a página renderiza
  // só a capa + a tabela (ver .rel-acomp-* em styles/global.css).
  useEffect(() => {
    if (!printing) return;
    let encerrado = false;
    function encerrar() { if (encerrado) return; encerrado = true; setPrinting(false); }
    window.addEventListener("afterprint", encerrar);
    const t = setTimeout(() => {
      try { window.print(); } catch { /* navegador sem suporte: volta ao normal */ }
      setTimeout(encerrar, 1200);
    }, 200);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", encerrar); };
  }, [printing]);

  if (printing) {
    return (
      <div className="rel-acomp-print">
        <div className="print-capa">
          <h2>Relatório de Acompanhamento</h2>
          <div className="print-capa-meta">
            Gerado em {fmtDateHoraBR(new Date().toISOString())}{currentUser && currentUser.nome ? ` por ${currentUser.nome}` : ""}
            {" • "}{linhas.length} processo(s)
          </div>
          <div className="print-capa-filtros"><b>Filtros aplicados:</b> {filtrosTxt.join(" • ")}</div>
        </div>
        <TabelaAcompanhamento linhas={linhas} />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Relatórios</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Acompanhamento</h3>
            <div className="muted" style={{ fontSize: 12.5 }}>Último histórico e próxima ação de cada processo.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn sec" disabled={!linhas.length} onClick={exportarExcel}>📊 Exportar Excel</button>
            <button className="btn sec" disabled={!linhas.length} onClick={() => setPrinting(true)}>🖨 Exportar PDF</button>
          </div>
        </div>

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
            <TabelaAcompanhamento linhas={linhas} />
          </div>
        ) : (
          <EmptyState>Nenhum processo no recorte selecionado.</EmptyState>
        )}
      </div>

      <div className="grid c2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Por situação</h3>
          <MiniTable data={porSit} />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Por seguradora</h3>
          <MiniTable data={porCia} />
        </div>
      </div>
    </div>
  );
}

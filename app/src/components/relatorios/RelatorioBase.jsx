import { fmtDateBR, fmtDateHoraBR } from "../../logic/format";

// Peças comuns a todos os relatórios do módulo Relatórios: a tabela (mesma
// na prévia da tela e no PDF) e a capa do PDF. O modo impressão fica em
// hooks/useImpressaoRelatorio.js.
// Colunas: [{ key, label, type }] — type "date" | "datetime" | "number" |
// "wrap" | omitido, o mesmo formato que logic/xlsxExport.js usa pro Excel.

function celula(c, v) {
  if (c.type === "date") return v ? fmtDateBR(v) : "—";
  if (c.type === "datetime") return v ? fmtDateHoraBR(v) : "—";
  if (c.type === "number") return v == null || v === "" ? "—" : String(v);
  return v == null || v === "" ? "—" : String(v);
}

export function RelatorioTabela({ colunas, linhas }) {
  return (
    <table className="rel-acomp-table">
      <thead>
        <tr>{colunas.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.id}>
            {colunas.map((c) => (
              <td
                key={c.key}
                className={c.type === "date" || c.type === "datetime" ? "mono nowrap" : c.type === "number" ? "mono right" : c.type === "wrap" ? "pre" : ""}
              >
                {celula(c, l[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RelatorioPrintView({ titulo, currentUser, total, filtrosTxt, colunas, linhas }) {
  return (
    <div className="rel-acomp-print">
      <div className="print-capa">
        <h2>{titulo}</h2>
        <div className="print-capa-meta">
          Gerado em {fmtDateHoraBR(new Date().toISOString())}{currentUser && currentUser.nome ? ` por ${currentUser.nome}` : ""}
          {" • "}{total} registro(s)
        </div>
        <div className="print-capa-filtros"><b>Filtros aplicados:</b> {filtrosTxt.length ? filtrosTxt.join(" • ") : "nenhum — emissão geral"}</div>
      </div>
      <RelatorioTabela colunas={colunas} linhas={linhas} />
    </div>
  );
}

// Cabeçalho de cada relatório: voltar ao catálogo + título + botões.
export function RelatorioHeader({ titulo, descricao, onVoltar, onExcel, onPdf, desabilitado }) {
  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn ghost xs" style={{ marginBottom: 6 }} onClick={onVoltar}>← Todos os relatórios</button>
          <h1>{titulo}</h1>
          {descricao && <p className="muted" style={{ margin: 0 }}>{descricao}</p>}
        </div>
        {(onExcel || onPdf) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {onExcel && <button className="btn sec" disabled={desabilitado} onClick={onExcel}>📊 Exportar Excel</button>}
            {onPdf && <button className="btn sec" disabled={desabilitado} onClick={onPdf}>🖨 Exportar PDF</button>}
          </div>
        )}
      </div>
    </>
  );
}

import { useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { downloadCSV, downloadHistoricoTemplate, processHistoricoCsv } from "../../logic/csvImport";
import { loadComms } from "../../logic/claims";

// Porte 1:1 do card "Importar último histórico em lote" das Configurações
// do HTML original.
export function HistoricoImportCard({ claims, overrides, actions, canEdit }) {
  const { currentUser } = useAuth();
  const fileRef = useRef(null);

  function importFile(file) {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = processHistoricoCsv(e.target.result, claims, overrides, loadComms, currentUser?.nome, (claimId, comment) => {
        actions.appendComment(claimId, comment);
        actions.logAudit(claimId, "Histórico importado via planilha", comment.text);
      });
      if (!result) { alert("Planilha vazia ou em formato inválido."); return; }
      downloadCSV("relatorio_importacao_historico.csv", result.report);
      alert(`Importação concluída: ${result.ok} registrado(s), ${result.ignorados} ignorado(s) (último histórico já era manual), ${result.falha} com problema. O relatório de validação foi baixado.`);
    };
    reader.onerror = () => alert("Não foi possível ler o arquivo.");
    reader.readAsText(file, "UTF-8");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Importar último histórico em lote</h3>
      <p className="muted">
        Baixe a planilha modelo, preencha a coluna "Últ. Histórico" no formato DD/MM/AAAA: descrição (ex.: 10/08/2026: Aguard. chegada de peças) e importe de volta. O sistema localiza o processo pelo Nosso N°, Tipo, Segurado/Terceiro e N° Sinistro, e registra a comunicação com Com quem = Dados importado e Meio = Dados importado. Só importa se o processo ainda não tiver histórico ou se o último registrado também tiver sido uma importação — se o último foi uma ação humana, o processo é ignorado.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn sec" onClick={() => downloadHistoricoTemplate(claims)}>⬇ Baixar planilha modelo</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Importar planilha preenchida</button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) importFile(f); e.target.value = ""; }}
        />
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        Depois de importar, um relatório CSV de validação é baixado automaticamente, linha a linha, mostrando o que foi registrado e o que precisa de revisão manual.
      </p>
    </div>
  );
}

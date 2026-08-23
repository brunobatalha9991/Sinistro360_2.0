import { useRef } from "react";
import { downloadCSV, downloadProximaAcaoTemplate, processProximaAcaoCsv } from "../../logic/csvImport";
import { getNextAction } from "../../logic/claims";

// Importar Próxima ação em lote — mesma lógica de HistoricoImportCard.jsx
// (planilha modelo → preencher → importar → relatório de validação), mas
// pra Próxima ação: colunas de título e data separadas, e só preenche
// processos que ainda NÃO têm nenhuma Próxima ação definida (não
// sobrescreve a de quem já tem uma).
export function ProximaAcaoImportCard({ claims, overrides, actions, canEdit }) {
  const fileRef = useRef(null);

  function importFile(file) {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = processProximaAcaoCsv(e.target.result, claims, overrides, getNextAction, (claimId, na) => {
        actions.saveNextAction(claimId, na);
        actions.logAudit(claimId, "Próxima ação importada via planilha", na.title);
      });
      if (!result) { alert("Planilha vazia ou em formato inválido."); return; }
      downloadCSV("relatorio_importacao_proxima_acao.csv", result.report);
      alert(`Importação concluída: ${result.ok} registrado(s), ${result.ignorados} ignorado(s) (já tinham Próxima ação), ${result.falha} com problema. O relatório de validação foi baixado.`);
    };
    reader.onerror = () => alert("Não foi possível ler o arquivo.");
    reader.readAsText(file, "UTF-8");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Importar Próxima ação em lote</h3>
      <p className="muted">
        Baixe a planilha modelo, preencha as colunas "Próxima Ação" (título) e "Data (DD/MM/AAAA)" (opcional — deixe em branco pra "Sem prazo") e importe de volta. O sistema localiza o processo pelo Nosso N°, Tipo, Segurado/Terceiro e N° Sinistro. Só preenche processos que ainda não têm nenhuma Próxima ação definida — quem já tem uma não é alterado.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn sec" onClick={() => downloadProximaAcaoTemplate(claims)}>⬇ Baixar planilha modelo</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Importar planilha preenchida</button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) importFile(f); e.target.value = ""; }}
        />
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        Depois de importar, um relatório CSV de validação é baixado automaticamente, linha a linha, mostrando o que foi registrado, o que foi ignorado (já tinha Próxima ação) e o que precisa de revisão manual.
      </p>
    </div>
  );
}

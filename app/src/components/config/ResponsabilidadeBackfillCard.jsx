import { useState } from "react";
import { getHistoricoDoProcesso, estimarHistoricoLegado } from "../../logic/responsabilidade";

// Migração aditiva e reversível (Fase 2 — IA Sinistros): gera, a partir do
// log de auditoria em texto livre já existente, uma ESTIMATIVA de histórico
// de responsabilidade para processos que ainda não têm nenhum intervalo
// estruturado. Nunca apaga nem sobrescreve nada — só adiciona registros
// novos em corp_responsabilidade_historico, sempre marcados como
// "estimado_legado" (ver ResponsabilidadePanel.jsx e
// docs/ia-sinistros/regras-responsabilidade.md).
//
// Rollback: como esta migração só ADICIONA entradas a uma coleção nova
// (nunca toca em corp_claims/corp_overrides), reverter significa apenas
// remover as entradas com origemAlteracao "estimado_legado" dessa coleção
// (ou, no limite, esvaziar a coleção inteira) — nenhum outro dado do
// sistema é afetado.
export function ResponsabilidadeBackfillCard({ claims, records, saveRecord, canEdit }) {
  const [resultado, setResultado] = useState(null);
  const historicoAtual = records.corp_responsabilidade_historico || [];

  function rodarMigracao() {
    if (!canEdit) { alert("Apenas administradores podem gerar a migração de histórico."); return; }
    const agoraISO = new Date().toISOString();
    const overrides = records.corp_overrides || {};
    const users = records.corp_users || [];

    let migrados = 0, semNadaAEstimar = 0, jaTinhamHistorico = 0;
    const novasEntradas = [];

    claims.forEach((c) => {
      if (getHistoricoDoProcesso(historicoAtual, c.id).length) { jaTinhamHistorico++; return; }
      const estimado = estimarHistoricoLegado(c, overrides, users, agoraISO);
      if (!estimado.length) { semNadaAEstimar++; return; }
      migrados++;
      novasEntradas.push(...estimado);
    });

    if (novasEntradas.length) {
      saveRecord("corp_responsabilidade_historico", (current) => [...(current || []), ...novasEntradas]);
    }
    setResultado({ migrados, semNadaAEstimar, jaTinhamHistorico, entradasGeradas: novasEntradas.length });
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Histórico de Responsabilidade — migração de dados legados</h3>
      <p className="muted">
        Gera uma estimativa de histórico de responsabilidade para processos que ainda não têm nenhum intervalo estruturado, a partir do log de auditoria interna já existente de cada processo. Toda entrada gerada assim fica marcada como <b>"Estimado (legado)"</b> — nunca é apresentada como um fato confirmado. Pode ser executada mais de uma vez sem duplicar: processos que já têm histórico (real ou estimado) são ignorados.
      </p>
      <button className="btn" onClick={rodarMigracao}>Gerar histórico estimado para processos pendentes</button>
      {resultado && (
        <p style={{ marginTop: 10, fontSize: 13 }}>
          <b>{resultado.migrados}</b> processo(s) migrado(s) ({resultado.entradasGeradas} intervalo(s) gerado(s)) •{" "}
          <b>{resultado.semNadaAEstimar}</b> sem nenhum dado aproveitável para estimar •{" "}
          <b>{resultado.jaTinhamHistorico}</b> já tinham histórico e foram ignorados.
        </p>
      )}
    </div>
  );
}

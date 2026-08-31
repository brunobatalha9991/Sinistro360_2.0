import { useState } from "react";
import { createPortal } from "react-dom";
import { usePublicTrackingActions } from "../../hooks/usePublicTrackingActions";
import { gerarTokenPublico, montarSnapshotPublico, urlAcompanhamento } from "../../logic/publicTracking";
import { fmtDateHoraBR } from "../../logic/format";

// Link de acompanhamento público (a pedido do usuário) — gera um token
// novo por clique, grava o resumo curado em corp_public_tracking (ver
// logic/publicTracking.js) e mostra a URL pronta pra copiar/enviar ao
// cliente. Nunca reaproveita um token revogado.
export function LinkAcompanhamentoModal({ c, overrides, templates, atendTemplateCfg, actions, canEdit, onClose }) {
  const { syncPublicTracking, revogarPublicTracking } = usePublicTrackingActions();
  const tracking = (overrides[c.id] || {}).publicTracking;
  const [copiado, setCopiado] = useState(false);

  function gerar() {
    if (!canEdit) return;
    const token = gerarTokenPublico();
    actions.gerarLinkAcompanhamento(c.id, token);
    syncPublicTracking(token, montarSnapshotPublico(c, overrides, templates, atendTemplateCfg));
    actions.logAudit(c.id, "Link de acompanhamento gerado", "");
    setCopiado(false);
  }
  function revogar() {
    if (!canEdit || !tracking) return;
    if (!confirm("Revogar este link? Quem já tiver o link salvo não vai mais conseguir acompanhar por ele.")) return;
    actions.revogarLinkAcompanhamento(c.id);
    revogarPublicTracking(tracking.token);
    actions.logAudit(c.id, "Link de acompanhamento revogado", "");
  }
  function copiar() {
    if (!tracking || !navigator.clipboard) return;
    navigator.clipboard.writeText(urlAcompanhamento(tracking.token)).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }).catch(() => {});
  }

  const ativo = !!(tracking && tracking.ativo);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <div style={{ width: 520, maxWidth: "100%", background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>🔗 Link de acompanhamento</h3>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>

        <p className="muted" style={{ fontSize: 12.5 }}>
          Gera uma página pública, sem login, onde o cliente vê só a situação atual, a etapa da jornada e a previsão da próxima ação deste processo — nada de histórico interno, valores ou dados de outros processos.
        </p>

        {ativo ? (
          <>
            <div className="field">
              <label>Link ativo — criado em {fmtDateHoraBR(tracking.criadoEm)}{tracking.criadoPor ? ` por ${tracking.criadoPor}` : ""}</label>
              <input readOnly value={urlAcompanhamento(tracking.token)} onFocus={(e) => e.target.select()} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn sec sm" onClick={copiar}>{copiado ? "Copiado!" : "Copiar link"}</button>
              {canEdit && <button className="btn danger sm" onClick={revogar}>Revogar link</button>}
            </div>
          </>
        ) : (
          <>
            {tracking && <p className="muted" style={{ fontSize: 12 }}>O link anterior foi revogado e não funciona mais.</p>}
            {canEdit ? (
              <button className="btn sm" onClick={gerar}>+ Gerar link de acompanhamento</button>
            ) : (
              <p className="muted" style={{ fontSize: 12 }}>Seu perfil é apenas de consulta — só quem pode editar o processo gera o link.</p>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

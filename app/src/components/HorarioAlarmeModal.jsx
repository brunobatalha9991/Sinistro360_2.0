import { createPortal } from "react-dom";
import { fmtDateBR } from "../logic/format";

// Alarme visual de emergência (a pedido do usuário: "totalmente
// perceptível... como se fosse um alarme") pro horário definido numa etapa
// de Atendimento (ver useHorarioAlarme.js/stepHoraConfig em logic/claims.js).
// Cobre a tela inteira, acima de qualquer outro modal, com fundo e borda
// piscando em vermelho — só some quando o usuário dispensa (ou o horário
// deixa de estar vencido, ex.: a etapa foi concluída).
export function HorarioAlarmeModal({ alarmes, onDismiss, onDismissAll, navigate }) {
  if (!alarmes.length) return null;

  function abrirProcesso(a) {
    onDismiss(a.key);
    navigate("sinistro", a.claimId);
  }

  return createPortal(
    <div className="alarme-hora-overlay">
      <div className="alarme-hora-box">
        <div className="alarme-hora-icone">🚨</div>
        <h2 className="alarme-hora-titulo">HORÁRIO VENCIDO</h2>
        <p className="alarme-hora-sub">
          {alarmes.length === 1 ? "1 processo sob sua responsabilidade" : `${alarmes.length} processos sob sua responsabilidade`} passou do horário definido:
        </p>
        <div className="alarme-hora-lista">
          {alarmes.map((a) => (
            <div key={a.key} className="alarme-hora-item">
              <div>
                <div className="alarme-hora-item-titulo">{a.numsin ? `Sinistro ${a.numsin}` : "Processo"} — {a.segurado || "—"}</div>
                <div className="alarme-hora-item-sub">{a.title} • {a.label}: {fmtDateBR(a.date)} às {a.hora}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button type="button" className="btn sm" onClick={() => abrirProcesso(a)}>Ver processo</button>
                <button type="button" className="btn sec xs" onClick={() => onDismiss(a.key)}>Dispensar</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn ghost sm" style={{ marginTop: 14 }} onClick={onDismissAll}>Dispensar todos</button>
      </div>
    </div>,
    document.body,
  );
}

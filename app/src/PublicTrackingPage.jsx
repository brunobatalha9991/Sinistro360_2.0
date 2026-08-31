import { useEffect, useState } from "react";
import { fetchPublicTracking } from "./data/publicTrackingClient";
import { fmtDateBR, fmtDateHoraBR, txt } from "./logic/format";

const SIT_CLASSE = { green: "green", gray: "gray", amber: "amber" };

// Página pública de acompanhamento (a pedido do usuário) — SEM login, SEM
// DataProvider: renderizada direto por main.jsx quando a URL bate com
// #/acompanhar/<token>, antes de qualquer coisa do app interno montar (ver
// main.jsx). Lê só o resumo curado de data/publicTrackingClient.js, nunca
// o restante do banco.
export function PublicTrackingPage({ token }) {
  const [estado, setEstado] = useState({ carregando: true, dados: null, erro: null });

  useEffect(() => {
    let vivo = true;
    fetchPublicTracking(token)
      .then((dados) => { if (vivo) setEstado({ carregando: false, dados, erro: null }); })
      .catch((e) => { if (vivo) setEstado({ carregando: false, dados: null, erro: e.message || "Falha ao carregar." }); });
    return () => { vivo = false; };
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--bg, #0b1220)" }}>
      <div className="card" style={{ maxWidth: 460, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Sinistro360</div>
          <div className="muted" style={{ fontSize: 12.5 }}>Acompanhamento do seu processo</div>
        </div>

        {estado.carregando && <p className="muted" style={{ textAlign: "center" }}>Carregando...</p>}

        {!estado.carregando && estado.erro && (
          <p style={{ color: "var(--danger)", textAlign: "center", fontSize: 13 }}>{estado.erro}</p>
        )}

        {!estado.carregando && !estado.erro && (!estado.dados || !estado.dados.ativo) && (
          <p className="muted" style={{ textAlign: "center", fontSize: 13.5 }}>
            Este link não está mais disponível. Entre em contato com a corretora para obter um novo.
          </p>
        )}

        {!estado.carregando && estado.dados && estado.dados.ativo && (
          <>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{txt(estado.dados.segurado)}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {estado.dados.numsin} {estado.dados.placa ? `• Placa ${estado.dados.placa}` : ""} {estado.dados.cia ? `• ${estado.dados.cia}` : ""}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <span className={"badge " + (SIT_CLASSE[estado.dados.situacaoCls] || "blue")} style={{ fontSize: 14, padding: "6px 14px" }}>
                {estado.dados.situacaoLabel}
              </span>
            </div>

            {estado.dados.etapa && (
              <div style={{ textAlign: "center", marginBottom: 10 }}>
                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px" }}>Etapa atual</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{estado.dados.etapa}</div>
              </div>
            )}

            {estado.dados.previsaoRetorno && (
              <div style={{ textAlign: "center", marginBottom: 10 }}>
                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px" }}>Previsão de retorno</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDateBR(estado.dados.previsaoRetorno)}</div>
              </div>
            )}

            <p className="muted" style={{ fontSize: 11, textAlign: "center", marginTop: 16 }}>
              Atualizado em {fmtDateHoraBR(estado.dados.atualizadoEm)}. Em caso de dúvidas, fale diretamente com a corretora.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

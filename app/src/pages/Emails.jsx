import { useEffect, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useOverrideActions } from "../hooks/useOverrideActions";
import { EmptyState } from "../components/EmptyState.jsx";
import { ProcSearch } from "../components/ProcSearch.jsx";
import { visibleClaims, isManualClaim } from "../logic/claims";
import { fmtDateHoraBR, txt } from "../logic/format";
import { isOutlookConfigured, getOutlookAccount, outlookLogin, getOutlookToken } from "../outlook/msalClient";
import { fetchInboxMessages } from "../logic/outlookApi";
import { encontrarProcessosNoEmail, MOTIVO_LABEL } from "../logic/emailMatching";

// Vínculo manual de um e-mail não identificado automaticamente — reaproveita
// o mesmo ProcSearch já usado em Tarefas (vincular a processo existente).
function VincularEmailBox({ onVincular, claims }) {
  const [aberto, setAberto] = useState(false);
  const [claimId, setClaimId] = useState("");
  if (!aberto) {
    return <button className="btn sec xs" onClick={() => setAberto(true)}>Vincular a processo</button>;
  }
  return (
    <div style={{ marginTop: 8 }}>
      <ProcSearch value={{ label: "" }} onChange={setClaimId} claims={claims} />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button className="btn sm" disabled={!claimId} onClick={() => onVincular(claimId)}>Confirmar vínculo</button>
        <button className="btn sec sm" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </div>
  );
}

// Módulo "E-mails" — a pedido do usuário: lê a caixa de entrada do Outlook
// (Microsoft Graph, login OAuth próprio, sem senha passando pelo sistema) e
// tenta identificar, pra cada e-mail, a qual processo ele se refere (nº de
// sinistro, placa ou nome do segurado no corpo). Nunca grava nada sozinho —
// só registra um ALERTA no processo (ver DetailHeader.jsx), que o usuário
// decide se transforma em atualização de histórico ou dispensa. E-mails sem
// nenhum sinal em comum ficam marcados em outra cor, pra revisão manual.
export function Emails() {
  const { records, config } = useData();
  const { navigate } = useHashRoute();
  const actions = useOverrideActions();

  const claims = visibleClaims(records.corp_claims).filter((c) => !isManualClaim(c));
  const overrides = records.corp_overrides || {};
  const configurado = isOutlookConfigured(config);

  const [conta, setConta] = useState(null);
  const [emails, setEmails] = useState([]);
  const [matches, setMatches] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!configurado) return;
    getOutlookAccount(config).then(setConta).catch(() => setConta(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configurado]);

  async function conectar() {
    setErro(null);
    try {
      const account = await outlookLogin(config);
      setConta(account);
    } catch (e) {
      setErro(e.message || "Falha ao conectar com o Outlook.");
    }
  }

  async function carregarCaixaEntrada() {
    setCarregando(true); setErro(null);
    try {
      const token = await getOutlookToken(config);
      const lista = await fetchInboxMessages(token, { top: 50 });
      const novosMatches = {};
      lista.forEach((email) => {
        const texto = `${email.assunto}\n${email.corpoTexto}`;
        const achados = encontrarProcessosNoEmail(texto, claims, overrides);
        novosMatches[email.id] = achados;
        achados.forEach(({ claimId, motivos }) => {
          actions.addEmailAlerta(claimId, {
            emailId: email.id, assunto: email.assunto, remetente: email.remetenteNome || email.remetente,
            recebidoEm: email.recebidoEm, resumo: email.resumo, corpoTexto: email.corpoTexto, motivos,
            encontradoEm: new Date().toISOString(), dismissed: false,
          });
        });
      });
      setEmails(lista);
      setMatches(novosMatches);
    } catch (e) {
      setErro(e.message || "Falha ao carregar a caixa de entrada.");
    } finally {
      setCarregando(false);
    }
  }

  function vincularManual(email, claimId) {
    if (!claimId) return;
    actions.addEmailAlerta(claimId, {
      emailId: email.id, assunto: email.assunto, remetente: email.remetenteNome || email.remetente,
      recebidoEm: email.recebidoEm, resumo: email.resumo, corpoTexto: email.corpoTexto, motivos: ["manual"],
      encontradoEm: new Date().toISOString(), dismissed: false,
    });
    setMatches((m) => ({ ...m, [email.id]: [...(m[email.id] || []), { claimId, motivos: ["manual"] }] }));
  }

  if (!configurado) {
    return (
      <div className="page-enter">
        <div className="page-head"><div><h1>E-mails</h1><p>Caixa de entrada do Outlook</p></div></div>
        <div className="card">
          <EmptyState>
            Outlook ainda não configurado. Configure o Client ID em Configurações → Outlook (E-mails).
          </EmptyState>
          <button className="btn sec sm" style={{ marginTop: 10 }} onClick={() => navigate("config")}>Ir para Configurações</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>E-mails</h1><p>Caixa de entrada do Outlook — identificação automática de processos</p></div>
      </div>

      <div className="card">
        {!conta ? (
          <>
            <p className="muted">Conecte sua conta Microsoft/Outlook pra carregar a caixa de entrada.</p>
            <button className="btn" onClick={conectar}>Conectar com Outlook</button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span className="badge green">Conectado como {conta.username}</span>
              <button className="btn sec sm" disabled={carregando} onClick={carregarCaixaEntrada}>
                {carregando ? "Carregando..." : "Atualizar caixa de entrada"}
              </button>
            </div>
            {erro && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{erro}</div>}
          </>
        )}
      </div>

      {!!emails.length && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Caixa de entrada</h3>
            <span className="muted" style={{ fontSize: 12 }}>{emails.length} e-mail(s)</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {emails.map((email) => {
              const achados = matches[email.id] || [];
              const identificado = achados.length > 0;
              return (
                <div
                  key={email.id}
                  style={{
                    border: "1px solid " + (identificado ? "var(--border)" : "rgba(var(--warn-rgb),.5)"),
                    background: identificado ? "transparent" : "rgba(var(--warn-rgb),.06)",
                    borderRadius: 8, padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{email.assunto}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{txt(email.remetenteNome || email.remetente)} • {fmtDateHoraBR(email.recebidoEm)}</div>
                    </div>
                    {identificado ? (
                      <span className="badge green">Identificado</span>
                    ) : (
                      <span className="badge amber">Não identificado — revisar manualmente</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 6, color: "var(--muted)" }}>{email.resumo}</div>

                  {identificado ? (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {achados.map(({ claimId, motivos }) => {
                        const c = claims.find((x) => x.id === claimId);
                        if (!c) return null;
                        return (
                          <div key={claimId} style={{ fontSize: 12.5 }}>
                            <a onClick={() => navigate("sinistro", claimId)} style={{ cursor: "pointer" }}>
                              {c.numsin || "#" + c.nosnum} — {txt(c.segurado)}
                            </a>
                            <span className="muted"> ({motivos.map((m) => MOTIVO_LABEL[m] || m).join(", ")})</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <VincularEmailBox claims={claims} onVincular={(claimId) => vincularManual(email, claimId)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

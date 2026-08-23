import { useEffect, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useOverrideActions } from "../hooks/useOverrideActions";
import { EmptyState } from "../components/EmptyState.jsx";
import { ProcSearch } from "../components/ProcSearch.jsx";
import { visibleClaims, isManualClaim } from "../logic/claims";
import { fmtDateHoraBR, txt } from "../logic/format";
import { isOutlookConfigured, getOutlookAccount, outlookLogin, getOutlookToken } from "../outlook/msalClient";
import { fetchInboxMessages as fetchOutlookMessages } from "../logic/outlookApi";
import { isGmailConfigured, getGmailAccountEmail, getGmailToken, gmailLogin, saveGmailAccountEmail } from "../gmail/googleAuthClient";
import { fetchInboxMessages as fetchGmailMessages, fetchGmailProfile } from "../logic/gmailApi";
import { encontrarProcessosNoEmail, MOTIVO_LABEL } from "../logic/emailMatching";

const PROVEDOR_LABEL = { outlook: "Outlook", gmail: "Gmail" };

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

// Bloco de conexão de um provedor (Outlook ou Gmail) — os dois convivem: dá
// pra ter só um configurado, ou os dois ao mesmo tempo (útil quando a conta
// corporativa do Outlook está travada esperando aprovação de administrador
// e uma conta Gmail pessoal serve de alternativa sem esse bloqueio).
function ProvedorBox({ provedor, conta, carregando, onConectar, onAtualizar }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{PROVEDOR_LABEL[provedor]}</h3>
      {!conta ? (
        <button className="btn" onClick={onConectar}>Conectar com {PROVEDOR_LABEL[provedor]}</button>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span className="badge green">Conectado como {conta}</span>
          <button className="btn sec sm" disabled={carregando} onClick={onAtualizar}>
            {carregando ? "Carregando..." : "Atualizar caixa de entrada"}
          </button>
        </div>
      )}
    </div>
  );
}

// Módulo "E-mails" — lê a caixa de entrada (Outlook e/ou Gmail, login OAuth
// próprio de cada provedor, sem senha passando pelo sistema) e tenta
// identificar, pra cada e-mail, a qual processo ele se refere (nº de
// sinistro, placa ou nome do segurado no assunto+corpo). Nunca grava nada
// sozinho — só registra um ALERTA no processo (ver DetailHeader.jsx), que o
// usuário decide se transforma em atualização de histórico ou dispensa.
// E-mails sem nenhum sinal em comum ficam marcados em outra cor, pra
// revisão manual.
export function Emails() {
  const { records, config } = useData();
  const { navigate } = useHashRoute();
  const actions = useOverrideActions();

  const claims = visibleClaims(records.corp_claims).filter((c) => !isManualClaim(c));
  const overrides = records.corp_overrides || {};
  const outlookOk = isOutlookConfigured(config);
  const gmailOk = isGmailConfigured(config);

  const [contaOutlook, setContaOutlook] = useState(null);
  const [contaGmail, setContaGmail] = useState(getGmailAccountEmail());
  const [emails, setEmails] = useState([]);
  const [matches, setMatches] = useState({});
  const [carregando, setCarregando] = useState(null); // "outlook" | "gmail" | null
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (outlookOk) getOutlookAccount(config).then((a) => setContaOutlook(a)).catch(() => setContaOutlook(null));
    if (gmailOk && getGmailToken()) setContaGmail(getGmailAccountEmail());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlookOk, gmailOk]);

  async function conectarOutlook() {
    setErro(null);
    try {
      const account = await outlookLogin(config);
      setContaOutlook(account);
    } catch (e) {
      setErro(e.message || "Falha ao conectar com o Outlook.");
    }
  }
  async function conectarGmail() {
    setErro(null);
    try {
      const token = await gmailLogin(config);
      const conta = await fetchGmailProfile(token);
      saveGmailAccountEmail(conta);
      setContaGmail(conta);
    } catch (e) {
      setErro(e.message || "Falha ao conectar com o Gmail.");
    }
  }

  function registrarAchados(lista, provedor) {
    const novosMatches = {};
    lista.forEach((email) => {
      const texto = `${email.assunto}\n${email.corpoTexto}`;
      const achados = encontrarProcessosNoEmail(texto, claims, overrides);
      novosMatches[email.id] = achados;
      achados.forEach(({ claimId, motivos }) => {
        actions.addEmailAlerta(claimId, {
          emailId: email.id, provedor, assunto: email.assunto, remetente: email.remetenteNome || email.remetente,
          recebidoEm: email.recebidoEm, resumo: email.resumo, corpoTexto: email.corpoTexto, motivos,
          encontradoEm: new Date().toISOString(), dismissed: false,
        });
      });
    });
    setEmails((atual) => {
      const semEsseProvedor = atual.filter((e) => e.provedor !== provedor);
      return [...semEsseProvedor, ...lista].sort((a, b) => String(b.recebidoEm).localeCompare(String(a.recebidoEm)));
    });
    setMatches((m) => ({ ...m, ...novosMatches }));
  }

  async function atualizarOutlook() {
    setCarregando("outlook"); setErro(null);
    try {
      const token = await getOutlookToken(config);
      const brutos = await fetchOutlookMessages(token, { top: 50 });
      registrarAchados(brutos.map((e) => ({ ...e, id: `outlook:${e.id}`, provedor: "outlook" })), "outlook");
    } catch (e) {
      setErro(e.message || "Falha ao carregar a caixa de entrada do Outlook.");
    } finally {
      setCarregando(null);
    }
  }
  async function atualizarGmail() {
    setCarregando("gmail"); setErro(null);
    try {
      const token = getGmailToken();
      if (!token) throw new Error("Sessão do Gmail expirada. Clique em \"Conectar com Gmail\" de novo.");
      const brutos = await fetchGmailMessages(token, { top: 50 });
      registrarAchados(brutos.map((e) => ({ ...e, id: `gmail:${e.id}`, provedor: "gmail" })), "gmail");
    } catch (e) {
      setErro(e.message || "Falha ao carregar a caixa de entrada do Gmail.");
    } finally {
      setCarregando(null);
    }
  }

  function vincularManual(email, claimId) {
    if (!claimId) return;
    actions.addEmailAlerta(claimId, {
      emailId: email.id, provedor: email.provedor, assunto: email.assunto, remetente: email.remetenteNome || email.remetente,
      recebidoEm: email.recebidoEm, resumo: email.resumo, corpoTexto: email.corpoTexto, motivos: ["manual"],
      encontradoEm: new Date().toISOString(), dismissed: false,
    });
    setMatches((m) => ({ ...m, [email.id]: [...(m[email.id] || []), { claimId, motivos: ["manual"] }] }));
  }

  if (!outlookOk && !gmailOk) {
    return (
      <div className="page-enter">
        <div className="page-head"><div><h1>E-mails</h1><p>Caixa de entrada (Outlook/Gmail)</p></div></div>
        <div className="card">
          <EmptyState>
            Nenhum provedor de e-mail configurado ainda. Configure o Outlook e/ou o Gmail em Configurações → E-mails (Outlook / Gmail).
          </EmptyState>
          <button className="btn sec sm" style={{ marginTop: 10 }} onClick={() => navigate("config")}>Ir para Configurações</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>E-mails</h1><p>Caixa de entrada — identificação automática de processos</p></div>
      </div>

      <div className="grid c2">
        {outlookOk && (
          <ProvedorBox
            provedor="outlook" conta={contaOutlook ? contaOutlook.username : null} carregando={carregando === "outlook"}
            onConectar={conectarOutlook} onAtualizar={atualizarOutlook}
          />
        )}
        {gmailOk && (
          <ProvedorBox
            provedor="gmail" conta={contaGmail} carregando={carregando === "gmail"}
            onConectar={conectarGmail} onAtualizar={atualizarGmail}
          />
        )}
      </div>
      {erro && <div className="card" style={{ color: "var(--danger)", fontSize: 13 }}>{erro}</div>}

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
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {email.assunto} <span className="badge gray" style={{ fontSize: 10, marginLeft: 6 }}>{PROVEDOR_LABEL[email.provedor]}</span>
                      </div>
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

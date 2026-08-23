import { useEffect, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useOverrideActions } from "../hooks/useOverrideActions";
import { useEmailStateActions } from "../hooks/useEmailStateActions";
import { EmptyState } from "../components/EmptyState.jsx";
import { ProcSearch } from "../components/ProcSearch.jsx";
import { EmailViewerModal } from "../components/EmailViewerModal.jsx";
import { ReplyEmailModal } from "../components/ReplyEmailModal.jsx";
import { visibleClaims, isManualClaim, emailAlertaDispensado } from "../logic/claims";
import { fmtDateHoraBR, txt } from "../logic/format";
import { setDemandaPrefill } from "../state/taskModal";
import { isGmailConfigured, getGmailAccountEmail, getGmailToken, gmailLogin, saveGmailAccountEmail } from "../gmail/googleAuthClient";
import { fetchInboxMessages, fetchGmailProfile, trashMessage, sendRawMessage, modifyLabels, fetchAttachmentData } from "../logic/gmailApi";
import { buildRawMessage } from "../logic/gmailCompose";
import { encontrarProcessosNoEmail, MOTIVO_LABEL } from "../logic/emailMatching";
import { encontrarRegraAplicavel } from "../logic/emailRules";

function fmtBytes(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

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

// Módulo "E-mails" — lê a caixa de entrada do Gmail (login OAuth próprio,
// sem senha passando pelo sistema) e tenta identificar, pra cada e-mail, a
// qual processo ele se refere (nº de sinistro, placa ou nome do segurado no
// assunto+corpo). Nunca grava nada sozinho — só registra um ALERTA no
// processo (ver DetailHeader.jsx), que o usuário decide se transforma em
// atualização de histórico ou dispensa. E-mails sem nenhum sinal em comum
// ficam marcados em outra cor, pra revisão manual.
export function Emails() {
  const { records, config } = useData();
  const { navigate } = useHashRoute();
  const actions = useOverrideActions();
  const emailState = useEmailStateActions();

  const claims = visibleClaims(records.corp_claims).filter((c) => !isManualClaim(c));
  const overrides = records.corp_overrides || {};
  const configurado = isGmailConfigured(config);

  const [conta, setConta] = useState(getGmailAccountEmail());
  const [emails, setEmails] = useState([]);
  const [matches, setMatches] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [emailAberto, setEmailAberto] = useState(null);

  const [busca, setBusca] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [verArquivados, setVerArquivados] = useState(false);
  const [selecionados, setSelecionados] = useState({});
  const [excluindo, setExcluindo] = useState(false);
  const [respondendo, setRespondendo] = useState(null);
  const assinatura = config.corp_email_assinatura || "";

  useEffect(() => {
    if (configurado && getGmailToken()) setConta(getGmailAccountEmail());
  }, [configurado]);

  async function conectar() {
    setErro(null);
    try {
      const token = await gmailLogin(config);
      const email = await fetchGmailProfile(token);
      saveGmailAccountEmail(email);
      setConta(email);
    } catch (e) {
      setErro(e.message || "Falha ao conectar com o Gmail.");
    }
  }

  async function carregarCaixaEntrada() {
    setCarregando(true); setErro(null);
    try {
      const token = getGmailToken();
      if (!token) throw new Error('Sessão do Gmail expirada. Clique em "Conectar com Gmail" de novo.');
      const brutos = await fetchInboxMessages(token, { top: 50 });
      const regras = config.corp_email_regras || [];
      const restantes = [];
      let movidos = 0;
      // Regras de pasta (a pedido do usuário): a primeira regra que bater
      // move o e-mail de verdade no Gmail (sai da INBOX, ganha o rótulo da
      // pasta) — some da lista aqui também, já que não está mais na caixa
      // de entrada.
      for (const email of brutos) {
        const regra = encontrarRegraAplicavel(email, regras);
        if (regra) {
          try {
            await modifyLabels(token, email.id, { addLabelIds: [regra.labelId], removeLabelIds: ["INBOX"] });
            movidos++;
            continue;
          } catch {
            // se falhar ao mover, mantém na caixa de entrada normal
          }
        }
        restantes.push(email);
      }

      const novosMatches = {};
      restantes.forEach((email) => {
        const texto = `${email.assunto}\n${email.corpoTexto}`;
        // Não volta a mostrar como identificado um vínculo que o usuário já
        // removeu manualmente antes (mesmo que a identificação automática
        // bata de novo numa atualização seguinte da caixa de entrada).
        const achados = encontrarProcessosNoEmail(texto, claims, overrides)
          .filter(({ claimId }) => !emailAlertaDispensado(overrides, claimId, email.id));
        novosMatches[email.id] = achados;
        achados.forEach(({ claimId, motivos }) => {
          actions.addEmailAlerta(claimId, {
            emailId: email.id, provedor: "gmail", assunto: email.assunto, remetente: email.remetenteNome || email.remetente,
            recebidoEm: email.recebidoEm, resumo: email.resumo, corpoTexto: email.corpoTexto, motivos,
            encontradoEm: new Date().toISOString(), dismissed: false,
          });
        });
      });
      setEmails(restantes);
      setMatches(novosMatches);
      setSelecionados({});
      if (movidos) setErro(null);
    } catch (e) {
      setErro(e.message || "Falha ao carregar a caixa de entrada.");
    } finally {
      setCarregando(false);
    }
  }

  function toggleSelecionado(emailId) {
    setSelecionados((s) => ({ ...s, [emailId]: !s[emailId] }));
  }
  function toggleSelecionarTodos(lista) {
    const todosMarcados = lista.length && lista.every((e) => selecionados[e.id]);
    setSelecionados((s) => {
      const next = { ...s };
      lista.forEach((e) => { next[e.id] = !todosMarcados; });
      return next;
    });
  }
  const idsSelecionados = Object.keys(selecionados).filter((id) => selecionados[id]);

  // Exclui de verdade no Gmail — vai pra Lixeira (reversível por lá, até 30
  // dias), não é apagado pra sempre.
  async function excluirSelecionados() {
    if (!idsSelecionados.length) return;
    if (!confirm(`Excluir ${idsSelecionados.length} e-mail(s) selecionado(s)? Vão pra Lixeira do Gmail.`)) return;
    setExcluindo(true); setErro(null);
    try {
      const token = getGmailToken();
      if (!token) throw new Error("Sessão do Gmail expirada.");
      for (const id of idsSelecionados) {
        await trashMessage(token, id);
      }
      setEmails((atual) => atual.filter((e) => !selecionados[e.id]));
      setSelecionados({});
    } catch (e) {
      setErro(e.message || "Falha ao excluir os e-mails selecionados.");
    } finally {
      setExcluindo(false);
    }
  }

  async function enviarResposta({ to, cc, assunto, corpo }) {
    const token = getGmailToken();
    if (!token) throw new Error("Sessão do Gmail expirada. Conecte de novo.");
    const raw = buildRawMessage({
      to, cc, subject: assunto, body: corpo,
      inReplyTo: respondendo.messageIdHeader, references: respondendo.messageIdHeader,
    });
    await sendRawMessage(token, raw);
  }

  async function baixarAnexo(email, anexo) {
    setErro(null);
    try {
      const token = getGmailToken();
      if (!token) throw new Error("Sessão do Gmail expirada.");
      const b64url = await fetchAttachmentData(token, email.id, anexo.attachmentId);
      const norm = b64url.replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(norm);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: anexo.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = anexo.filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e.message || "Falha ao baixar o anexo.");
    }
  }

  function vincularManual(email, claimId) {
    if (!claimId) return;
    actions.addEmailAlerta(claimId, {
      emailId: email.id, provedor: "gmail", assunto: email.assunto, remetente: email.remetenteNome || email.remetente,
      recebidoEm: email.recebidoEm, resumo: email.resumo, corpoTexto: email.corpoTexto, motivos: ["manual"],
      encontradoEm: new Date().toISOString(), dismissed: false,
    });
    setMatches((m) => ({ ...m, [email.id]: [...(m[email.id] || []), { claimId, motivos: ["manual"] }] }));
  }

  // Remove um vínculo (automático ou manual) — a pedido do usuário: às
  // vezes a identificação automática erra, e é melhor poder tirar na hora,
  // direto na caixa de entrada, em vez de precisar abrir o processo.
  function removerVinculo(email, claimId) {
    actions.dismissEmailAlerta(claimId, email.id);
    setMatches((m) => ({ ...m, [email.id]: (m[email.id] || []).filter((a) => a.claimId !== claimId) }));
  }

  // Cria uma tarefa já com o conteúdo do e-mail (título/descrição
  // preenchidos) — se o e-mail bateu com exatamente um processo, já vincula
  // direto; se bateu com mais de um ou nenhum, fica sem processo vinculado
  // pra decidir na hora de criar. Mesmo mecanismo de prefill já usado no
  // atalho "Criar tarefa vinculada a este processo" (DetailHeader.jsx).
  function criarTarefa(email) {
    const achados = matches[email.id] || [];
    setDemandaPrefill({
      titulo: `E-mail: ${email.assunto}`,
      descricao: `[E-mail de ${email.remetenteNome || email.remetente} em ${fmtDateHoraBR(email.recebidoEm)}]\n\n${email.corpoTexto}`,
      processoId: achados.length === 1 ? achados[0].claimId : "",
    });
    navigate("tarefas", "newfromdemanda");
  }

  const emailsFiltrados = emails.filter((email) => {
    if (emailState.isArquivado(email.id) !== verArquivados) return false;
    if (dataDe && (!email.recebidoEm || email.recebidoEm.slice(0, 10) < dataDe)) return false;
    if (dataAte && (!email.recebidoEm || email.recebidoEm.slice(0, 10) > dataAte)) return false;
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      const hay = `${email.assunto} ${email.remetenteNome} ${email.remetente} ${email.corpoTexto}`.toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
  const qtdArquivados = emails.filter((e) => emailState.isArquivado(e.id)).length;

  if (!configurado) {
    return (
      <div className="page-enter">
        <div className="page-head"><div><h1>E-mails</h1><p>Caixa de entrada do Gmail</p></div></div>
        <div className="card">
          <EmptyState>
            Gmail ainda não configurado. Configure o Client ID em Configurações → E-mails (Gmail).
          </EmptyState>
          <button className="btn sec sm" style={{ marginTop: 10 }} onClick={() => navigate("config")}>Ir para Configurações</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>E-mails</h1><p>Caixa de entrada do Gmail — identificação automática de processos</p></div>
      </div>

      <div className="card">
        {!conta ? (
          <>
            <p className="muted">Conecte sua conta Gmail pra carregar a caixa de entrada.</p>
            <button className="btn" onClick={conectar}>Conectar com Gmail</button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span className="badge green">Conectado como {conta}</span>
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
            <span className="muted" style={{ fontSize: 12 }}>{emailsFiltrados.length} de {emails.length} e-mail(s)</span>
          </div>

          <div className="chips" style={{ alignItems: "center", marginTop: 10 }}>
            <input placeholder="Buscar por assunto, remetente ou conteúdo..." style={{ minWidth: 260, flex: 1 }} value={busca} onChange={(e) => setBusca(e.target.value)} />
            <span className="muted" style={{ fontSize: 12 }}>de</span>
            <input type="date" className="inline" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
            <span className="muted" style={{ fontSize: 12 }}>até</span>
            <input type="date" className="inline" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
            {(dataDe || dataAte) && <button className="chip-btn" onClick={() => { setDataDe(""); setDataAte(""); }}>limpar datas</button>}
            <div className={"chip-btn" + (verArquivados ? " active" : "")} onClick={() => setVerArquivados((v) => !v)}>
              Arquivados ({qtdArquivados})
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
              <input type="checkbox" checked={!!emailsFiltrados.length && emailsFiltrados.every((e) => selecionados[e.id])} onChange={() => toggleSelecionarTodos(emailsFiltrados)} />
              Selecionar todos
            </label>
            {idsSelecionados.length > 0 && (
              <button className="btn danger sm" disabled={excluindo} onClick={excluirSelecionados}>
                {excluindo ? "Excluindo..." : `Excluir selecionados (${idsSelecionados.length})`}
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {!emailsFiltrados.length ? (
              <EmptyState>{verArquivados ? "Nenhum e-mail arquivado." : "Nenhum e-mail para este filtro."}</EmptyState>
            ) : emailsFiltrados.map((email) => {
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0, flex: 1 }}>
                      <input type="checkbox" style={{ flexShrink: 0, width: 16, height: 16 }} checked={!!selecionados[email.id]} onChange={() => toggleSelecionado(email.id)} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={email.assunto}>{email.assunto}</div>
                        <div className="muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txt(email.remetenteNome || email.remetente)} • {fmtDateHoraBR(email.recebidoEm)}</div>
                      </div>
                    </div>
                    {identificado ? (
                      <span className="badge green">Identificado</span>
                    ) : (
                      <span className="badge amber">Não identificado — revisar manualmente</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 6, color: "var(--muted)" }}>{email.resumo}</div>

                  {!!(email.anexos && email.anexos.length) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {email.anexos.map((a) => (
                        <a key={a.attachmentId} className="badge gray" style={{ cursor: "pointer" }} onClick={() => baixarAnexo(email, a)}>
                          📎 {a.filename} {a.size ? `(${fmtBytes(a.size)})` : ""}
                        </a>
                      ))}
                    </div>
                  )}

                  {identificado && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {achados.map(({ claimId, motivos }) => {
                        const c = claims.find((x) => x.id === claimId);
                        if (!c) return null;
                        return (
                          <div key={claimId} style={{ fontSize: 12.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <div>
                              <a onClick={() => navigate("sinistro", claimId)} style={{ cursor: "pointer" }}>
                                {c.numsin || "#" + c.nosnum} — {txt(c.segurado)}
                              </a>
                              <span className="muted"> ({motivos.map((m) => MOTIVO_LABEL[m] || m).join(", ")})</span>
                            </div>
                            <a style={{ color: "var(--danger)", cursor: "pointer", fontSize: 11.5, flexShrink: 0 }} onClick={() => removerVinculo(email, claimId)}>✕ Remover vínculo</a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!identificado && <VincularEmailBox claims={claims} onVincular={(claimId) => vincularManual(email, claimId)} />}

                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <button className="btn sec xs" onClick={() => setEmailAberto(email)}>Ver e-mail completo</button>
                    <button className="btn sec xs" onClick={() => setRespondendo(email)}>Responder</button>
                    <button className="btn sec xs" onClick={() => criarTarefa(email)}>Criar tarefa</button>
                    {verArquivados ? (
                      <button className="btn sec xs" onClick={() => emailState.desarquivar(email.id)}>Desarquivar</button>
                    ) : (
                      <button className="btn sec xs" onClick={() => emailState.arquivar(email.id)}>Arquivar</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <EmailViewerModal email={emailAberto} onClose={() => setEmailAberto(null)} />
      {respondendo && (
        <ReplyEmailModal
          email={respondendo} assinatura={assinatura}
          onSend={enviarResposta} onClose={() => setRespondendo(null)}
        />
      )}
    </div>
  );
}

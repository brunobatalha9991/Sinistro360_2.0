import { useState } from "react";
import { createPortal } from "react-dom";
import { fmtDateHoraBR, txt } from "../logic/format";
import { generateContent, isGeminiConfigured } from "../ai/geminiApi.js";

function fmtBytes(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Sugestão de mensagem pro WhatsApp do segurado, gerada por IA com base no
// e-mail em exibição (a pedido do usuário) — mesma integração Gemini/mesmo
// padrão da "Sugestão de mensagem para o cliente" do Histórico
// (CommsPanel.jsx): roda só sob clique, nunca envia nada sozinha — o texto
// fica num campo editável pro usuário revisar, copiar e colar no WhatsApp.
function SugestaoWhatsappBox({ email, clienteNome }) {
  const [sugestao, setSugestao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const configurado = isGeminiConfigured();

  async function gerar() {
    setGerando(true); setErro(null); setCopiado(false);
    try {
      const { text } = await generateContent({
        systemInstruction: "Você ajuda um atendente de seguros a redigir uma mensagem curta, clara e cordial para enviar ao segurado pelo WhatsApp, em português do Brasil, resumindo uma novidade do sinistro recebida por e-mail. Baseie-se só no conteúdo do e-mail fornecido, sem inventar informações que não estão nele. Responda só com o texto da mensagem, sem explicações nem saudação de e-mail formal.",
        contents: [{
          role: "user",
          parts: [{ text: `Segurado: ${clienteNome || "(nome não identificado)"}\nAssunto do e-mail: ${email.assunto || ""}\n\nConteúdo do e-mail:\n${email.corpoTexto || ""}\n\nEscreva a mensagem para o WhatsApp do segurado com base neste e-mail.` }],
        }],
      });
      setSugestao(text);
    } catch (e) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  }

  function copiar() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(sugestao).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }).catch(() => {});
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--surface-2)", marginTop: 14 }}>
      <b style={{ fontSize: 13 }}>🤖 Mensagem para o WhatsApp do segurado</b>
      <p className="muted" style={{ fontSize: 11.5, margin: "4px 0 8px" }}>
        Gerada por IA com base neste e-mail — revise antes de enviar, nada é enviado automaticamente.
      </p>
      {!configurado ? (
        <p className="muted" style={{ fontSize: 12 }}>Assistente IA não configurado (chave do Gemini ausente) — este recurso fica indisponível até configurar.</p>
      ) : (
        <>
          <button type="button" className="btn sec sm" onClick={gerar} disabled={gerando}>{gerando ? "Gerando..." : sugestao ? "Gerar novamente" : "🤖 Gerar mensagem"}</button>
          {erro && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erro}</div>}
          {sugestao && (
            <>
              <textarea rows={4} style={{ marginTop: 8 }} value={sugestao} onChange={(e) => setSugestao(e.target.value)} />
              <button type="button" className="btn sec xs" style={{ marginTop: 6 }} onClick={copiar}>{copiado ? "Copiado!" : "Copiar"}</button>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Tela sobreposta pra ver o corpo completo de um e-mail — a pedido do
// usuário: a caixa de entrada e o alerta dentro do processo só mostravam
// um resumo curto. Reaproveitado em Emails.jsx (sem navegação: index/total/
// onPrev/onNext/onUsar/onDispensar ficam undefined) e em DetailHeader.jsx
// (com setas ‹ › quando o processo tem mais de um e-mail vinculado, e
// Usar/Dispensar agindo sempre sobre o e-mail exibido no momento). Anexos
// (email.anexos) só aparecem quando onBaixarAnexo é passado, a pedido do
// usuário: precisam ficar disponíveis pra baixar aqui dentro, não só na
// Caixa de entrada. `clienteNome` (nome do segurado) só vem de
// DetailHeader.jsx — junto com onUsar, condiciona a caixa de sugestão de
// WhatsApp via IA, que só faz sentido com o e-mail vinculado a um processo.
export function EmailViewerModal({ email, onClose, index, total, onPrev, onNext, onUsar, onDispensar, onBaixarAnexo, clienteNome }) {
  if (!email) return null;
  const showNav = total > 1;
  const anexos = email.anexos || [];
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <div style={{ width: 680, maxWidth: "100%", background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0 }}>{txt(email.assunto)}</h3>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {txt(email.remetenteNome || email.remetente)} • {fmtDateHoraBR(email.recebidoEm)}
            </div>
          </div>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>

        {showNav && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 }}>
            <button className="btn sec xs" onClick={onPrev} disabled={index <= 0}>‹ Anterior</button>
            <span className="muted" style={{ fontSize: 12 }}>{index + 1} de {total}</span>
            <button className="btn sec xs" onClick={onNext} disabled={index >= total - 1}>Próximo ›</button>
          </div>
        )}

        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "var(--surface-2)", maxHeight: "60vh", overflow: "auto" }}>
          <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{txt(email.corpoTexto)}</div>
        </div>

        {onBaixarAnexo && !!anexos.length && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
              Anexos ({anexos.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {anexos.map((a) => (
                <a key={a.attachmentId} className="badge gray" style={{ cursor: "pointer" }} onClick={() => onBaixarAnexo(a)}>
                  📎 {a.filename} {a.size ? `(${fmtBytes(a.size)})` : ""}
                </a>
              ))}
            </div>
          </div>
        )}

        {onUsar && <SugestaoWhatsappBox key={email.emailId} email={email} clienteNome={clienteNome} />}

        {(onUsar || onDispensar) && (
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {onUsar && <button className="btn xs" onClick={onUsar}>Transformar em atualização</button>}
            {onDispensar && <button className="btn sec xs" onClick={onDispensar}>Dispensar este e-mail</button>}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

import { useState } from "react";
import { createPortal } from "react-dom";
import { generateContent, isGeminiConfigured } from "../../ai/geminiApi.js";
import { montarMensagemLote, montarContextoLoteParaIA, DEFAULT_TRATATIVA_LOTE_TEMPLATE } from "../../logic/tratativaLote";
import { campoEfetivo } from "../../logic/claims";
import { txt } from "../../logic/format";

// "Tratativa em lote" — a pedido do usuário: em vez de cobrar a oficina
// processo por processo, reúne todos os processos em aberto (ver
// claimsAbertosDaOficina) numa única tela com 2 mensagens prontas pra
// copiar/colar no WhatsApp. Nada é enviado automaticamente.
export function TratativaLoteModal({ claims, overrides, templates, atendTemplateCfg, config, onClose }) {
  const template = config.corp_tratativa_lote_template || DEFAULT_TRATATIVA_LOTE_TEMPLATE;
  const [msg1, setMsg1] = useState(() => montarMensagemLote(template, claims, overrides));
  const [msg2, setMsg2] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);
  const [copiado1, setCopiado1] = useState(false);
  const [copiado2, setCopiado2] = useState(false);
  const configurado = isGeminiConfigured();

  async function gerarMsg2() {
    setGerando(true); setErro(null); setCopiado2(false);
    try {
      const contexto = montarContextoLoteParaIA(claims, overrides, templates, atendTemplateCfg);
      const { text } = await generateContent({
        systemInstruction: "Você ajuda um atendente de seguros a redigir uma mensagem cordial e objetiva para uma oficina mecânica, cobrando atualização sobre vários veículos em reparo ao mesmo tempo. Baseie-se só no contexto de cada processo fornecido (etapa atual, último histórico com a oficina, próxima ação) — cite cada placa separadamente, sem inventar informação que não está no contexto. Responda só com o texto da mensagem, em português do Brasil, sem saudação de e-mail formal.",
        contents: [{ role: "user", parts: [{ text: `Contexto de cada processo:\n${contexto}\n\nEscreva a mensagem para a oficina com base neste contexto, pedindo um retorno preciso sobre cada veículo.` }] }],
      });
      setMsg2(text);
    } catch (e) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  }

  function copiar(texto, setCopiado) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }).catch(() => {});
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <div style={{ width: 680, maxWidth: "100%", background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>Tratativa em lote</h3>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>

        {!claims.length ? (
          <p className="muted" style={{ fontSize: 13 }}>Nenhum processo em aberto nesta oficina no momento.</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 12 }}>
              {claims.length} processo(s) em aberto nesta oficina, incluído(s) nas mensagens abaixo. Nada é enviado automaticamente — copie e cole no WhatsApp.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {claims.map((c) => (
                <span key={c.id} className="badge gray mono" title={txt(campoEfetivo(overrides, c, "segurado"))}>
                  {txt(campoEfetivo(overrides, c, "placa")) || (c.numsin || "#" + c.nosnum)}
                </span>
              ))}
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--surface-2)" }}>
              <b style={{ fontSize: 13 }}>Mensagem 1 — template padrão</b>
              <p className="muted" style={{ fontSize: 11.5, margin: "4px 0 8px" }}>
                Uma pergunta por placa, no template configurado em Configurações → Tratativa em lote.
              </p>
              <textarea rows={8} value={msg1} onChange={(e) => setMsg1(e.target.value)} />
              <button type="button" className="btn sec xs" style={{ marginTop: 6 }} onClick={() => copiar(msg1, setCopiado1)}>{copiado1 ? "Copiado!" : "Copiar"}</button>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--surface-2)", marginTop: 14 }}>
              <b style={{ fontSize: 13 }}>🤖 Mensagem 2 — gerada por IA</b>
              <p className="muted" style={{ fontSize: 11.5, margin: "4px 0 8px" }}>
                Baseada na etapa atual, último histórico com a oficina e próxima ação de cada processo — revise antes de enviar.
              </p>
              {!configurado ? (
                <p className="muted" style={{ fontSize: 12 }}>Assistente IA não configurado (chave do Gemini ausente) — este recurso fica indisponível até configurar.</p>
              ) : (
                <>
                  <button type="button" className="btn sec sm" onClick={gerarMsg2} disabled={gerando}>{gerando ? "Gerando..." : msg2 ? "Gerar novamente" : "🤖 Gerar mensagem"}</button>
                  {erro && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erro}</div>}
                  {msg2 && (
                    <>
                      <textarea rows={8} style={{ marginTop: 8 }} value={msg2} onChange={(e) => setMsg2(e.target.value)} />
                      <button type="button" className="btn sec xs" style={{ marginTop: 6 }} onClick={() => copiar(msg2, setCopiado2)}>{copiado2 ? "Copiado!" : "Copiar"}</button>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

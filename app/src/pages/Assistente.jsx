import { useEffect, useRef, useState } from "react";
import { useStore } from "../hooks/useStore";
import { useAiChatActions } from "../hooks/useAiChatActions";
import { aiChatStore } from "../state/aiChat";
import { isGeminiConfigured } from "../ai/geminiApi";
import { EmptyState } from "../components/EmptyState.jsx";
import { ActionProposalCard } from "../components/ai/ActionProposalCard.jsx";
import { FeedbackButtons } from "../components/ai/FeedbackButtons.jsx";
import { EnsinarAssistente } from "../components/ai/EnsinarAssistente.jsx";

function EnvelopeMeta({ envelope }) {
  if (!envelope) return null;
  const { fontes, limitacoes, confianca, metodologia } = envelope;
  if (!fontes.length && !limitacoes.length && !metodologia) return null;
  return (
    <div className="ai-envelope-meta">
      <span className={"badge " + (confianca === "alta" ? "green" : "amber")}>
        {confianca === "alta" ? "Confiança alta — baseada em dados do sistema" : "Confiança baixa — sem consulta a dados"}
      </span>
      {!!fontes.length && (
        <div className="ai-envelope-fontes">
          <b>Fontes:</b>{" "}
          {fontes.map((f, i) => (
            <span key={f.tipo + f.id}>
              {i > 0 && " · "}
              {f.url_interna ? <a href={f.url_interna}>{f.descricao}</a> : f.descricao}
            </span>
          ))}
        </div>
      )}
      {metodologia && <div className="ai-envelope-metodologia" title={metodologia}>Metodologia: {metodologia}</div>}
      {!!limitacoes.length && limitacoes.map((l, i) => <div key={i} className="ai-envelope-limitacao">⚠ {l}</div>)}
    </div>
  );
}

function Bubble({ message }) {
  if (message.type === "action_proposal") return <ActionProposalCard message={message} />;
  const mine = message.role === "user";
  const isError = message.role === "error";
  return (
    <div className={"chat-msg " + (mine ? "mine" : "theirs") + (isError ? " ai-msg-error" : "")}>
      <div style={{ whiteSpace: "pre-wrap" }}>{message.text}</div>
      <EnvelopeMeta envelope={message.envelope} />
      {message.envelope && <FeedbackButtons respostaId={message.id} />}
    </div>
  );
}

export function Assistente() {
  const { messages, busy, error } = useStore(aiChatStore);
  const { sendMessage } = useAiChatActions();
  const [text, setText] = useState("");
  const boxRef = useRef(null);
  const configured = isGeminiConfigured();

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages.length, busy]);

  function send() {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    sendMessage(t);
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Assistente IA</h1>
          <p>Converse com o Gemini para analisar dados, gerar relatórios e propor ações no sistema.</p>
        </div>
      </div>

      {!configured ? (
        <div className="card">
          <EmptyState>
            Chave da API do Gemini não configurada. Defina <code>VITE_GEMINI_API_KEY</code> em <code>app/.env.local</code> e reinicie o servidor de desenvolvimento para habilitar o assistente.
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <div style={{ marginBottom: 10 }}><EnsinarAssistente /></div>
          <div className="chat-box" ref={boxRef} style={{ maxHeight: 480 }}>
            {!messages.length ? (
              <div className="chat-empty">Pergunte algo, ex.: "quantos sinistros em andamento por seguradora?"</div>
            ) : (
              messages.map((m) => <Bubble key={m.id} message={m} />)
            )}
            {busy && <div className="ai-typing">Assistente digitando…</div>}
          </div>
          {error && <div className="badge red" style={{ marginTop: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end" }}>
            <textarea
              rows={2} placeholder="Escreva sua pergunta ou pedido..." style={{ flex: 1 }}
              value={text} disabled={busy}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="btn" style={{ whiteSpace: "nowrap" }} onClick={send} disabled={busy || !text.trim()}>Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
}

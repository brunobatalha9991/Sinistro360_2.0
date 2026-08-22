import { useEffect, useRef, useState } from "react";
import { useStore } from "../hooks/useStore";
import { useAiChatActions } from "../hooks/useAiChatActions";
import { aiChatStore } from "../state/aiChat";
import { isGeminiConfigured } from "../ai/geminiApi";
import { EmptyState } from "../components/EmptyState.jsx";
import { ActionProposalCard } from "../components/ai/ActionProposalCard.jsx";

function Bubble({ message }) {
  if (message.type === "action_proposal") return <ActionProposalCard message={message} />;
  const mine = message.role === "user";
  const isError = message.role === "error";
  return (
    <div className={"chat-msg " + (mine ? "mine" : "theirs") + (isError ? " ai-msg-error" : "")}>
      <div style={{ whiteSpace: "pre-wrap" }}>{message.text}</div>
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

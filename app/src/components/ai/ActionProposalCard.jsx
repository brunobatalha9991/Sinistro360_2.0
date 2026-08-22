import { useAiChatActions } from "../../hooks/useAiChatActions";

const STATUS_LABEL = { confirmed: "Confirmado ✓", cancelled: "Cancelado ✕" };

// Card exibido no chat quando uma tool de escrita propõe uma ação — só
// grava de verdade quando o usuário clica em Confirmar (ver
// src/hooks/useAiChatActions.js confirmProposal/cancelProposal).
export function ActionProposalCard({ message }) {
  const { confirmProposal, cancelProposal } = useAiChatActions();
  const { proposal } = message;
  const pending = proposal.status === "pending";

  return (
    <div className="ai-proposal">
      <div className="ai-proposal-summary">{proposal.summary}</div>
      {proposal.after && <pre className="ai-proposal-diff">{JSON.stringify(proposal.after, null, 2)}</pre>}
      {pending ? (
        <div className="ai-proposal-actions">
          <button className="btn xs" onClick={() => confirmProposal(message.id)}>Confirmar</button>
          <button className="btn sec xs" onClick={() => cancelProposal(message.id)}>Cancelar</button>
        </div>
      ) : (
        <span className={"badge " + (proposal.status === "confirmed" ? "green" : "gray")}>{STATUS_LABEL[proposal.status]}</span>
      )}
    </div>
  );
}

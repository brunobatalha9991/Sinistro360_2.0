import { useState } from "react";
import { useIaFeedback } from "../../hooks/useIaFeedback";

const AVALIACOES = [
  ["util", "👍", "Útil"],
  ["nao_util", "👎", "Não útil"],
  ["incorreta", "⚠", "Informação incorreta"],
];

// Feedback é sempre uma ação humana explícita — nunca inferido pela IA
// (Fase 6, ver docs/ia-sinistros/memoria-e-feedback.md).
export function FeedbackButtons({ respostaId }) {
  const { registrarFeedback, feedbackDeUsuario } = useIaFeedback();
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState("");
  const dado = feedbackDeUsuario(respostaId);

  if (dado) {
    return <div className="ai-feedback-done">Feedback registrado: {AVALIACOES.find((a) => a[0] === dado.avaliacao)?.[2] || dado.avaliacao}. Obrigado.</div>;
  }

  return (
    <div className="ai-feedback">
      {AVALIACOES.map(([valor, icone, label]) => (
        <button key={valor} className="btn sec xs" title={label} onClick={() => registrarFeedback({ respostaId, avaliacao: valor })}>{icone}</button>
      ))}
      <button className="btn ghost xs" onClick={() => setComentando((v) => !v)}>💬 Comentar</button>
      {comentando && (
        <div style={{ display: "flex", gap: 6, marginTop: 6, width: "100%" }}>
          <input placeholder="O que faltou ou estava errado?" style={{ flex: 1 }} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          <button className="btn xs" onClick={() => { registrarFeedback({ respostaId, avaliacao: "faltou_informacao", comentario }); setComentando(false); setComentario(""); }}>Enviar</button>
        </div>
      )}
    </div>
  );
}

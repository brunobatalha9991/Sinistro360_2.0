import { useState } from "react";
import { useIaMemoria } from "../../hooks/useIaMemoria";
import { grupoDoUsuario } from "../../logic/memoriaIA";
import { useAuth } from "../../hooks/useAuth";

const ESCOPO_LABEL = {
  pessoal: "Só para mim",
  equipe: "Para minha equipe (fica pendente de aprovação de um admin)",
  organizacional: "Para toda a corretora (fica pendente de aprovação de um admin)",
};

// Criação de memória é sempre uma ação humana explícita — a IA nunca decide
// sozinha transformar algo dito na conversa em conhecimento permanente
// (Fase 6, docs/ia-sinistros/memoria-e-feedback.md).
export function EnsinarAssistente() {
  const { currentUser } = useAuth();
  const { criarMemoria } = useIaMemoria();
  const [aberto, setAberto] = useState(false);
  const [escopo, setEscopo] = useState("pessoal");
  const [conteudo, setConteudo] = useState("");
  const [status, setStatus] = useState(null);

  function salvar() {
    if (!conteudo.trim()) return;
    const mem = criarMemoria({ escopo, conteudo, equipeGrupo: escopo === "equipe" ? grupoDoUsuario(currentUser) : undefined });
    setConteudo("");
    setStatus(mem.status === "aprovado" ? "Salvo — já vale a partir da próxima pergunta." : "Enviado para aprovação de um administrador.");
    setTimeout(() => setStatus(null), 4000);
  }

  if (!aberto) {
    return <button className="btn ghost sm" onClick={() => setAberto(true)}>🎓 Ensinar o assistente</button>;
  }

  return (
    <div className="ai-ensinar">
      <div className="field">
        <label>O que o assistente deve lembrar?</label>
        <textarea rows={2} placeholder="Ex.: prefiro respostas curtas e direto ao ponto." value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select className="inline" value={escopo} onChange={(e) => setEscopo(e.target.value)}>
          {Object.keys(ESCOPO_LABEL).map((k) => <option key={k} value={k}>{ESCOPO_LABEL[k]}</option>)}
        </select>
        <button className="btn xs" onClick={salvar}>Salvar</button>
        <button className="btn sec xs" onClick={() => setAberto(false)}>Fechar</button>
      </div>
      {status && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{status}</p>}
    </div>
  );
}

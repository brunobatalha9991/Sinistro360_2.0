import { EmptyState } from "../EmptyState.jsx";
import { useIaMemoria } from "../../hooks/useIaMemoria";

const ESCOPO_LABEL = { pessoal: "Pessoal", equipe: "Equipe", organizacional: "Organizacional" };

function nomeDe(users, id) { return (users.find((u) => u.id === id) || {}).nome || "—"; }

// Painel administrativo de aprovação de memórias (Fase 6) — só admin
// (mesmo padrão do resto de Configurações). Memória pessoal nunca aparece
// aqui: nasce autoaprovada e só o próprio dono usa.
export function MemoriasIACard({ users }) {
  const { memorias, aprovarMemoria, rejeitarMemoria, expirarMemoria } = useIaMemoria();
  const pendentes = memorias.filter((m) => m.status === "pendente_aprovacao");
  const aprovadas = memorias.filter((m) => m.status === "aprovado" && m.escopo !== "pessoal");

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Memórias da IA — aprovação</h3>
      <p className="muted">
        Conhecimento de equipe/organizacional sugerido pelos usuários (via "Ensinar o assistente" no chat) só passa a valer para os outros depois de aprovado aqui. Memórias pessoais não aparecem — cada usuário gerencia as suas.
      </p>

      <h4 style={{ marginBottom: 6 }}>Pendentes de aprovação ({pendentes.length})</h4>
      {!pendentes.length ? <EmptyState>Nenhuma memória pendente.</EmptyState> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {pendentes.map((m) => (
            <div key={m.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
              <div><span className="badge blue">{ESCOPO_LABEL[m.escopo]}</span> <span className="muted" style={{ fontSize: 12 }}>sugerido por {nomeDe(users, m.criadoPor)}</span></div>
              <div style={{ marginTop: 6 }}>{m.conteudo}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button className="btn xs" onClick={() => aprovarMemoria(m.id)}>Aprovar</button>
                <button className="btn sec xs" onClick={() => rejeitarMemoria(m.id)}>Rejeitar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h4 style={{ marginBottom: 6 }}>Aprovadas (equipe/organizacional) ({aprovadas.length})</h4>
      {!aprovadas.length ? <EmptyState>Nenhuma memória aprovada ainda.</EmptyState> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {aprovadas.map((m) => (
            <div key={m.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div>
                <span className="badge green">{ESCOPO_LABEL[m.escopo]}</span>{" "}
                <span style={{ marginLeft: 6 }}>{m.conteudo}</span>
              </div>
              <button className="btn sec xs" onClick={() => expirarMemoria(m.id)}>Expirar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

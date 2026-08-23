import { useData } from "../../data/DataProvider.jsx";
import { EmptyState } from "../EmptyState.jsx";
import { setDemandaPrefill } from "../../state/taskModal";

// Tarefas vinculadas a esta seguradora (t.seguradoraId) — mesmo mecanismo de
// prefill já usado em "Criar tarefa vinculada a este processo"
// (DetailHeader.jsx), agora com seguradoraId em vez de processoId.
export function TarefasSeguradoraPanel({ seguradoraId, seguradoraNome, navigate }) {
  const { records } = useData();
  const tarefas = (records.corp_tasks || []).filter((t) => t.seguradoraId === seguradoraId);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Tarefas vinculadas ({tarefas.length})</h3>
        <button
          className="btn sec sm"
          onClick={() => {
            setDemandaPrefill({ titulo: `Seguradora ${seguradoraNome}`, descricao: "", seguradoraId });
            navigate("tarefas", "newfromdemanda");
          }}
        >
          + Criar tarefa vinculada a esta seguradora
        </button>
      </div>

      {tarefas.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {tarefas.map((t) => (
            <div key={t.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, cursor: "pointer" }} onClick={() => navigate("tarefas")}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className={"badge " + (t.status === "Concluído" ? "green" : t.status === "Em andamento" ? "amber" : "blue")}>{t.status}</span>
                <span className="badge gray">{t.tipo}</span>
              </div>
              <div style={{ fontWeight: 600, marginTop: 6 }}>{t.titulo}</div>
              {t.descricao && <div style={{ fontSize: 13, marginTop: 4 }}>{t.descricao}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 14 }}><EmptyState>Nenhuma tarefa vinculada a esta seguradora ainda.</EmptyState></div>
      )}
    </div>
  );
}

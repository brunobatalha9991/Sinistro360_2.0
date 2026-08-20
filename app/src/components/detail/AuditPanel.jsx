import { EmptyState } from "../EmptyState.jsx";
import { loadAudit } from "../../logic/claims";
import { txt } from "../../logic/format";

// Porte 1:1 de auditPanel() do HTML original.
export function AuditPanel({ c, overrides }) {
  const a = loadAudit(overrides, c.id).slice().reverse();
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Auditoria Interna</h3>
        <span className="tag-manual">Registros automáticos e inalteráveis</span>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>Cada ação executada neste processo gera um registro permanente. Não pode ser editado nem apagado, e é preservado na sincronização.</p>
      {!a.length ? <EmptyState>Nenhuma ação registrada ainda.</EmptyState> : (
        <div style={{ overflow: "auto" }}>
          <table>
            <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Perfil</th><th>Ação</th><th>Detalhe</th></tr></thead>
            <tbody>
              {a.map((r) => {
                const dt = new Date(r.at);
                const when = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
                return (
                  <tr key={r.id}>
                    <td className="mono">{when}</td>
                    <td>{txt(r.who)}</td>
                    <td>{r.role === "admin" ? "Admin" : "Usuário"}</td>
                    <td>{txt(r.acao)}</td>
                    <td>{txt(r.detalhe)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

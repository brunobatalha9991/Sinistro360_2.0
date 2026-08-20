import { useData } from "../data/DataProvider.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

// Porte 1:1 de Pages.clientes() do HTML original.
export function Clientes() {
  const { records } = useData();
  const claims = records.corp_claims || [];

  const map = {};
  claims.forEach((c) => {
    if (c.segurado) (map[c.segurado] = map[c.segurado] || []).push(c);
  });
  const names = Object.keys(map).sort();

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Clientes</h1>
          <p>{names.length} segurados</p>
        </div>
      </div>
      <div className="card">
        {names.length ? (
          <table>
            <thead>
              <tr>
                <th>Segurado</th>
                <th>Sinistros</th>
                <th>Placas</th>
              </tr>
            </thead>
            <tbody>
              {names.map((n) => (
                <tr key={n}>
                  <td>{n}</td>
                  <td>{map[n].length} sinistro(s)</td>
                  <td>{map[n].map((c) => c.placa).filter(Boolean).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>Sincronize para ver clientes.</EmptyState>
        )}
      </div>
    </div>
  );
}

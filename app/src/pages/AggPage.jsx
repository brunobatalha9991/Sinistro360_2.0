import { useData } from "../data/DataProvider.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

// Porte 1:1 de aggPage() do HTML original — conta sinistros agrupados por
// um campo simples do registro (usado por Seguradoras e Oficinas).
export function AggPage({ field, title }) {
  const { records } = useData();
  const claims = records.corp_claims || [];

  const map = {};
  claims.forEach((c) => {
    const v = c[field];
    if (v) map[v] = (map[v] || 0) + 1;
  });
  const keys = Object.keys(map).sort();

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{keys.length} registros</p>
        </div>
      </div>
      <div className="card">
        {keys.length ? (
          <table>
            <thead>
              <tr>
                <th>{title}</th>
                <th>Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{map[k]} sinistro(s)</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState>Sem dados.</EmptyState>
        )}
      </div>
    </div>
  );
}

export function Seguradoras() { return <AggPage field="cia" title="Seguradoras" />; }
export function Oficinas() { return <AggPage field="oficina" title="Oficinas/Prestadores" />; }

import { useData } from "../data/DataProvider.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { mapSituacao } from "../logic/situacao";

function MiniTable({ data }) {
  const keys = Object.keys(data);
  if (!keys.length) return <EmptyState>Sem dados.</EmptyState>;
  return (
    <table>
      <tbody>
        {keys.map((x) => (
          <tr key={x}>
            <td>{x}</td>
            <td className="right mono">{String(data[x])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Porte 1:1 de Pages.relatorios() do HTML original.
export function Relatorios() {
  const { records } = useData();
  const claims = records.corp_claims || [];

  const porSit = {};
  const porCia = {};
  claims.forEach((c) => {
    const s = mapSituacao(c.situacao).label;
    porSit[s] = (porSit[s] || 0) + 1;
    if (c.cia) porCia[c.cia] = (porCia[c.cia] || 0) + 1;
  });

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Relatórios</h1>
        </div>
      </div>
      <div className="grid c2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Por situação</h3>
          <MiniTable data={porSit} />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Por seguradora</h3>
          <MiniTable data={porCia} />
        </div>
      </div>
    </div>
  );
}

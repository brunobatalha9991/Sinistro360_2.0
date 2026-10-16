import { useMemo } from "react";
import { useData } from "../../data/DataProvider.jsx";
import { useAuth } from "../../hooks/useAuth";
import { EmptyState } from "../EmptyState.jsx";
import { mapSituacao } from "../../logic/situacao";
import { visibleClaims } from "../../logic/claims";
import { RelatorioHeader } from "./RelatorioBase.jsx";

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

// Porte 1:1 de Pages.relatorios() do HTML original — contagem de processos
// por situação e por seguradora.
export function RelatorioResumo({ onVoltar }) {
  const { records } = useData();
  const { currentUser } = useAuth();
  const overrides = records.corp_overrides || {};
  const claims = useMemo(() => visibleClaims(records.corp_claims, overrides, currentUser), [records.corp_claims, overrides, currentUser]);

  const porSit = {};
  const porCia = {};
  claims.forEach((c) => {
    const s = mapSituacao(c.situacao).label;
    porSit[s] = (porSit[s] || 0) + 1;
    if (c.cia) porCia[c.cia] = (porCia[c.cia] || 0) + 1;
  });

  return (
    <div className="page-enter">
      <RelatorioHeader titulo="Resumo por situação e seguradora" descricao="Quantidade de processos por situação e por seguradora." onVoltar={onVoltar} />
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

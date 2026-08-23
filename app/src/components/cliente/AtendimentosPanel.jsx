import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { setDetailTab } from "../../state/detailTab";
import { txt } from "../../logic/format";

// Sinistros vinculados a este cliente, com filtro De/Até por data de
// ocorrência (mesmo padrão de período usado em Desempenho.jsx). "Ver
// apólice" abre o processo já na aba Anexos (a pedido do usuário — vínculo
// com a URL de apólice), reaproveitando a busca sob demanda que já existe
// ali (useDocumentoCorp.js) em vez de duplicar N chamadas ao CORP aqui.
export function AtendimentosPanel({ claims, navigate }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const filtrados = claims.filter((c) => {
    if (de && (!c.datoco || c.datoco < de)) return false;
    if (ate && (!c.datoco || c.datoco > ate)) return false;
    return true;
  });

  function abrirApolice(c) {
    setDetailTab("anexos");
    navigate("sinistro", c.id);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Atendimentos</h3>
        <span className="muted" style={{ fontSize: 12 }}>{filtrados.length} de {claims.length}</span>
      </div>
      <div className="chips" style={{ alignItems: "center", marginTop: 10 }}>
        <span className="muted" style={{ fontSize: 12 }}>Dt. ocorrência de</span>
        <input type="date" className="inline" value={de} onChange={(e) => setDe(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>até</span>
        <input type="date" className="inline" value={ate} onChange={(e) => setAte(e.target.value)} />
        {(de || ate) && <button className="chip-btn" onClick={() => { setDe(""); setAte(""); }}>limpar</button>}
      </div>

      {filtrados.length ? (
        <table style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Nº Sinistro</th>
              <th>Seguradora</th>
              <th>Placa</th>
              <th>Oficina</th>
              <th>Dt. Ocorrência</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id}>
                <td style={{ cursor: "pointer" }} onClick={() => navigate("sinistro", c.id)}><a>{c.numsin || "#" + c.nosnum}</a></td>
                <td>{txt(c.cia)}</td>
                <td>{txt(c.placa)}</td>
                <td>{txt(c.oficina)}</td>
                <td>{txt(c.datoco)}</td>
                <td><button className="btn sec xs" onClick={() => abrirApolice(c)}>Ver apólice</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ marginTop: 14 }}><EmptyState>Nenhum atendimento para este filtro.</EmptyState></div>
      )}
    </div>
  );
}

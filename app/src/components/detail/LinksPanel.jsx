import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { PartyBadge } from "../PartyBadge.jsx";
import { relatedClaims, getManualLinks } from "../../logic/claims";
import { mapSituacao } from "../../logic/situacao";
import { txt } from "../../logic/format";

// Porte 1:1 de linksPanel() do HTML original.
export function LinksPanel({ c, claims, allClaimsRaw, overrides, actions, navigate, setDetailTab }) {
  const rel = relatedClaims(overrides, allClaimsRaw, c);
  const [q, setQ] = useState("");

  const linked = getManualLinks(overrides, c.id);
  const query = q.toLowerCase().trim();
  const found = query.length < 2 ? [] : claims.filter((x) => {
    if (x.id === c.id || linked.indexOf(x.id) >= 0) return false;
    return [x.segurado, x.placa, x.numsin].join(" ").toLowerCase().indexOf(query) >= 0;
  }).slice(0, 15);

  return (
    <div>
      {!rel.length ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Processos vinculados</h3>
          <EmptyState>Nenhum processo vinculado. Use a busca abaixo para vincular manualmente um terceiro/segurado a este processo.</EmptyState>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Processos vinculados ({rel.length})</h3>
          <p className="muted">Vínculos criados manualmente. Navegue entre segurado e terceiro(s).</p>
          <div style={{ overflow: "auto" }}>
            <table>
              <thead><tr><th>Tipo</th><th>Nº Sinistro</th><th>Nome</th><th>Placa</th><th>Situação</th><th>Ações</th></tr></thead>
              <tbody>
                {rel.map((r) => {
                  const sit = mapSituacao(r.situacao);
                  return (
                    <tr key={r.id}>
                      <td><PartyBadge pt={r.partyType} /></td>
                      <td className="mono">{txt(r.numsin)}</td>
                      <td>{txt(r.segurado)}</td>
                      <td className="mono">{txt(r.placa)}</td>
                      <td><span className={"badge " + sit.cls}>{sit.label}</span></td>
                      <td>
                        <button className="btn sec sm" onClick={() => { setDetailTab("vinculos"); navigate("sinistro", r.id); }}>Abrir →</button>
                        <button className="btn danger sm" style={{ marginLeft: 6 }} onClick={() => actions.removeLink(c.id, r.id)}>Desvincular</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Vincular processo</h3>
        <p className="muted">Busque o processo do terceiro (ou do segurado) que pertence ao mesmo evento e clique em Vincular. O vínculo vale nos dois sentidos e é preservado na sincronização.</p>
        <input placeholder="Buscar por nome, placa ou nº sinistro para vincular..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ marginTop: 10 }}>
          {query.length > 0 && query.length < 2 && <div className="muted" style={{ padding: 8 }}>Digite ao menos 2 caracteres.</div>}
          {query.length >= 2 && !found.length && <div className="muted" style={{ padding: 8 }}>Nenhum processo encontrado.</div>}
          {found.map((x) => (
            <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 8, borderBottom: "1px solid var(--line)" }}>
              <div>
                <PartyBadge pt={x.partyType} />
                <span style={{ marginLeft: 8 }}>{(x.numsin || "#" + x.nosnum) + " — " + txt(x.segurado) + (x.placa ? ` (${x.placa})` : "")}</span>
              </div>
              <button className="btn sm" onClick={() => { actions.addLink(c.id, x.id); setQ(""); }}>+ Vincular</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

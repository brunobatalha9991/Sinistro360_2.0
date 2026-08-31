import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { txt } from "../../logic/format";
import { claimsAbertosDaOficina } from "../../logic/tratativaLote";
import { TratativaLoteModal } from "./TratativaLoteModal.jsx";

// Sinistros vinculados a esta oficina, com filtro De/Até por data de
// ocorrência (mesmo padrão de período usado em Desempenho.jsx). "Tratativa
// em lote" (a pedido do usuário) reúne todos os processos EM ABERTO desta
// oficina (independente do filtro de data acima) numa única tela com
// mensagens prontas pra copiar — ver TratativaLoteModal.jsx.
export function AtendimentosPanel({ claims, navigate, oficinaNome, overrides, templates, atendTemplateCfg, config }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [tratativaAberta, setTratativaAberta] = useState(false);

  const filtrados = claims.filter((c) => {
    if (de && (!c.datoco || c.datoco < de)) return false;
    if (ate && (!c.datoco || c.datoco > ate)) return false;
    return true;
  });

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Atendimentos</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>{filtrados.length} de {claims.length}</span>
          <button type="button" className="btn sec sm" onClick={() => setTratativaAberta(true)}>📋 Tratativa em lote</button>
        </div>
      </div>
      {tratativaAberta && (
        <TratativaLoteModal
          claims={claimsAbertosDaOficina(claims, overrides, oficinaNome, templates, atendTemplateCfg)}
          overrides={overrides} templates={templates} atendTemplateCfg={atendTemplateCfg} config={config}
          onClose={() => setTratativaAberta(false)}
        />
      )}
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
              <th>Segurado</th>
              <th>Placa</th>
              <th>Seguradora</th>
              <th>Dt. Ocorrência</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => navigate("sinistro", c.id)}>
                <td><a>{c.numsin || "#" + c.nosnum}</a></td>
                <td>{txt(c.segurado)}</td>
                <td>{txt(c.placa)}</td>
                <td>{txt(c.cia)}</td>
                <td>{txt(c.datoco)}</td>
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

import { useMemo, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { EmptyState } from "../components/EmptyState.jsx";
import { ConsultaCorpBox } from "../components/ConsultaCorpBox.jsx";
import { visibleClaims } from "../logic/claims";
import {
  listaClientes, clienteClaims, clienteComsCliente, clienteAvaliacaoMedia,
} from "../logic/clientes";

// Módulo Clientes (Fase 3) — mesmo padrão de Oficinas.jsx/Seguradoras.jsx.
export function Clientes() {
  const { records, config } = useData();
  const { navigate } = useHashRoute();
  const [busca, setBusca] = useState("");
  const [consultaCorpAberta, setConsultaCorpAberta] = useState(false);

  const claims = visibleClaims(records.corp_claims);
  const overrides = records.corp_overrides || {};
  const ocorrencias = records.corp_cliente_ocorrencias || [];

  const linhas = useMemo(() => {
    const lista = listaClientes(claims, overrides);
    return lista.map((cl) => {
      const cs = clienteClaims(claims, overrides, cl.nome);
      const coms = clienteComsCliente(claims, overrides, cl.nome);
      const media = clienteAvaliacaoMedia(coms);
      const abertas = ocorrencias.filter((x) => x.clienteId === cl.id && x.status === "aberta").length;
      const placas = cs.map((c) => c.placa).filter(Boolean).join(", ");
      return { ...cl, qtdSinistros: cs.length, media, reclamacoesAbertas: abertas, placas };
    });
  }, [claims, overrides, ocorrencias]);

  const filtradas = busca.trim()
    ? linhas.filter((cl) => cl.nome.toLowerCase().indexOf(busca.trim().toLowerCase()) >= 0)
    : linhas;

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Clientes</h1>
          <p>{linhas.length} cliente(s) — cadastro, reclamações, comunicação e avaliação</p>
        </div>
        <button className="btn sec sm" onClick={() => setConsultaCorpAberta((v) => !v)}>
          {consultaCorpAberta ? "▲ Ocultar consulta no CORP" : "🔍 Consultar no CORP"}
        </button>
      </div>

      {consultaCorpAberta && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Consultar no CORP</h3>
          <ConsultaCorpBox config={config} />
        </div>
      )}

      <div className="card">
        <input placeholder="Buscar cliente por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 360 }} />

        {filtradas.length ? (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Sinistros</th>
                <th>Placas</th>
                <th>Nota média</th>
                <th>Reclamações abertas</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((cl) => (
                <tr key={cl.id} style={{ cursor: "pointer" }} onClick={() => navigate("cliente", cl.id)}>
                  <td><a>{cl.nome}</a></td>
                  <td>{cl.qtdSinistros}</td>
                  <td>{cl.placas || "—"}</td>
                  <td>{cl.media != null ? `${cl.media.toFixed(1)} ★` : "—"}</td>
                  <td>{cl.reclamacoesAbertas > 0 ? <span className="badge red">{cl.reclamacoesAbertas}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ marginTop: 14 }}><EmptyState>Nenhum cliente encontrado.</EmptyState></div>
        )}
      </div>
    </div>
  );
}

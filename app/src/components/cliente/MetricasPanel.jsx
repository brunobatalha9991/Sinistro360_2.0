import {
  clienteComsCliente, clienteAvaliacaoMedia, clienteAgentesProdutores,
} from "../../logic/clientes";

function Kpi({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Métricas do cliente — nota média (agora que o canal Cliente também tem
// avaliação por estrelas no Histórico, a pedido do usuário) e o resumo de
// Agente/Produtor já vinculados aos sinistros deste cliente (dado
// sincronizado via /documento do CORP — ver clientes.js).
export function MetricasPanel({ clienteNome, claims, overrides }) {
  const coms = clienteComsCliente(claims, overrides, clienteNome);
  const media = clienteAvaliacaoMedia(coms);
  const { agentes, produtores } = clienteAgentesProdutores(claims, overrides, clienteNome);

  return (
    <div>
      <div className="grid c2">
        <Kpi label="Nota média" value={media != null ? `${media.toFixed(1)} ★` : "—"} sub={`${coms.filter((m) => m.avaliacao > 0).length} avaliação(ões)`} />
        <Kpi label="Sinistros avaliados" value={coms.filter((m) => m.avaliacao > 0).length} sub="Com nota registrada no Histórico" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Agente / Produtor</h3>
        <p className="muted" style={{ fontSize: 12 }}>Só mostra o que já foi carregado na Visão geral de algum sinistro deste cliente (busca sob demanda no CORP).</p>
        {agentes.length || produtores.length ? (
          <div className="grid c2">
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Agentes</div>
              {agentes.length ? agentes.map((a) => <div key={a} style={{ fontSize: 13 }}>{a}</div>) : <span className="muted" style={{ fontSize: 13 }}>Nenhum ainda.</span>}
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Produtores</div>
              {produtores.length ? produtores.map((p) => <div key={p} style={{ fontSize: 13 }}>{p}</div>) : <span className="muted" style={{ fontSize: 13 }}>Nenhum ainda.</span>}
            </div>
          </div>
        ) : (
          <p className="muted">Nenhum agente/produtor carregado ainda — abra a Visão geral de um sinistro deste cliente pra buscar.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Pesquisa de satisfação</h3>
        <p className="muted">Disponível quando o mecanismo de pesquisa de satisfação (corretora/seguradora/oficina) for implementado — fase futura deste módulo.</p>
      </div>
    </div>
  );
}

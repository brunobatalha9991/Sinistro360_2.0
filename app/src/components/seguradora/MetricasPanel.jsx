import {
  seguradoraComsSeguradora, seguradoraAvaliacaoMedia, seguradoraAguardandoLimitacaoCounts,
  seguradoraReferenciadaLivreEscolhaPorOficina, seguradoraSatisfacaoMedia,
} from "../../logic/seguradoras";

function Kpi({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Métricas de qualidade da seguradora — nota média (do Histórico dos
// sinistros) e Referenciada×Livre Escolha por oficina (visão inversa da
// mesma tabela mostrada em Oficinas). Diferente de Oficinas, não existe
// "tempo médio de reparo" aqui — é uma métrica de oficina/etapa da
// Jornada, não de seguradora.
export function MetricasPanel({ seguradoraNome, claims, overrides }) {
  const coms = seguradoraComsSeguradora(claims, overrides, seguradoraNome);
  const media = seguradoraAvaliacaoMedia(coms);
  const { aguardandoRetorno, limitacaoComunicacao } = seguradoraAguardandoLimitacaoCounts(coms);
  const porOficina = seguradoraReferenciadaLivreEscolhaPorOficina(claims, overrides, seguradoraNome);
  const oficinasKeys = Object.keys(porOficina).sort();
  const satisfacao = seguradoraSatisfacaoMedia(claims, overrides, seguradoraNome);

  return (
    <div>
      <div className="grid c3">
        <Kpi label="Nota média" value={media != null ? `${media.toFixed(1)} ★` : "—"} sub={`${coms.filter((m) => m.avaliacao > 0).length} avaliação(ões)`} />
        <Kpi label="Aguardando retorno" value={aguardandoRetorno} sub="Registrado no Histórico dos sinistros" />
        <Kpi label="Limitação de comunicação" value={limitacaoComunicacao} sub="Registrado no Histórico dos sinistros" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Referenciada × Livre Escolha, por oficina</h3>
        <p className="muted" style={{ fontSize: 12 }}>Conforme o campo "Vínculo com oficina" preenchido em Visão geral de cada sinistro.</p>
        {oficinasKeys.length ? (
          <table>
            <thead>
              <tr>
                <th>Oficina</th>
                <th>Referenciada</th>
                <th>Livre Escolha</th>
                <th>Sem vínculo definido</th>
              </tr>
            </thead>
            <tbody>
              {oficinasKeys.map((oficina) => (
                <tr key={oficina}>
                  <td>{oficina}</td>
                  <td>{porOficina[oficina].referenciada}</td>
                  <td>{porOficina[oficina].livreEscolha}</td>
                  <td className="muted">{porOficina[oficina].semVinculo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nenhum sinistro vinculado ainda.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Pesquisa de satisfação</h3>
        <p className="muted" style={{ fontSize: 12 }}>Nota que o cliente deu pra esta seguradora, registrada na aba "Pesquisa de satisfação" de cada sinistro.</p>
        {satisfacao != null ? (
          <div style={{ fontSize: 26, fontWeight: 700 }}>{satisfacao.toFixed(1)} ★</div>
        ) : (
          <p className="muted">Nenhuma pesquisa de satisfação registrada ainda pra esta seguradora.</p>
        )}
      </div>
    </div>
  );
}

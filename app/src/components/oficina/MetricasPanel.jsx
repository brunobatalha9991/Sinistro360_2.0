import {
  oficinaComsOficina, oficinaAvaliacaoMedia, oficinaAguardandoLimitacaoCounts,
  oficinaTempoMedioReparo, oficinaReferenciadaLivreEscolhaPorSeguradora,
} from "../../logic/oficinas";

function Kpi({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Métricas de qualidade da oficina — nota média (do Histórico dos
// sinistros), tempo médio de reparo (Jornada do cliente), evidências de
// comunicação (Aguardando retorno / Limitação de comunicação) e
// Referenciada×Livre Escolha por seguradora.
export function MetricasPanel({ oficinaNome, claims, overrides }) {
  const coms = oficinaComsOficina(claims, overrides, oficinaNome);
  const media = oficinaAvaliacaoMedia(coms);
  const { aguardandoRetorno, limitacaoComunicacao } = oficinaAguardandoLimitacaoCounts(coms);
  const tempoReparo = oficinaTempoMedioReparo(claims, overrides, oficinaNome);
  const porSeguradora = oficinaReferenciadaLivreEscolhaPorSeguradora(claims, overrides, oficinaNome);
  const seguradorasKeys = Object.keys(porSeguradora).sort();

  return (
    <div>
      <div className="grid c4">
        <Kpi label="Nota média" value={media != null ? `${media.toFixed(1)} ★` : "—"} sub={`${coms.filter((m) => m.avaliacao > 0).length} avaliação(ões)`} />
        <Kpi label="Tempo médio de reparo" value={tempoReparo != null ? `${tempoReparo.toFixed(1)} dias` : "—"} sub="Início → conclusão da etapa Reparo (Perda Parcial)" />
        <Kpi label="Aguardando retorno" value={aguardandoRetorno} sub="Registrado no Histórico dos sinistros" />
        <Kpi label="Limitação de comunicação" value={limitacaoComunicacao} sub="Evidência pra alinhar em reunião" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Referenciada × Livre Escolha, por seguradora</h3>
        <p className="muted" style={{ fontSize: 12 }}>Conforme o campo "Vínculo com oficina" preenchido em Visão geral de cada sinistro.</p>
        {seguradorasKeys.length ? (
          <table>
            <thead>
              <tr>
                <th>Seguradora</th>
                <th>Referenciada</th>
                <th>Livre Escolha</th>
                <th>Sem vínculo definido</th>
              </tr>
            </thead>
            <tbody>
              {seguradorasKeys.map((cia) => (
                <tr key={cia}>
                  <td>{cia}</td>
                  <td>{porSeguradora[cia].referenciada}</td>
                  <td>{porSeguradora[cia].livreEscolha}</td>
                  <td className="muted">{porSeguradora[cia].semVinculo}</td>
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
        <p className="muted">Disponível quando o mecanismo de pesquisa de satisfação (corretora/seguradora/oficina) for implementado — fase futura deste módulo.</p>
      </div>
    </div>
  );
}

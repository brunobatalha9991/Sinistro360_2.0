import { useMemo, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { EmptyState } from "../components/EmptyState.jsx";
import { calcularMetricasTodosUsuarios } from "../logic/desempenho";
import { patchListFilter, resetListFilter } from "../state/listFilter";
import { fmtNum } from "../logic/format";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function diasAtras(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function fmtDiasMedia(n) { return n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " d"; }

// Fase 5 (IA Sinistros) — painel simplificado, dimensionado para a escala
// real confirmada (até 5 usuários ativos) e sem SLA formal (usa a mesma
// regra de "Próxima ação" já existente). Ver docs/ia-sinistros/metricas-desempenho.md.
export function Desempenho() {
  const { records } = useData();
  const { navigate } = useHashRoute();
  const [periodoDe, setPeriodoDe] = useState(diasAtras(30));
  const [periodoAte, setPeriodoAte] = useState(todayISO());

  const users = records.corp_users || [];
  const claims = records.corp_claims || [];
  const overrides = records.corp_overrides || {};
  const historico = records.corp_responsabilidade_historico || [];

  const inicioISO = periodoDe ? periodoDe + "T00:00:00.000Z" : null;
  const fimISO = periodoAte ? periodoAte + "T23:59:59.999Z" : null;

  const metricas = useMemo(
    () => calcularMetricasTodosUsuarios({ users, claims, overrides, historico, periodoInicioISO: inicioISO, periodoFimISO: fimISO }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, claims, overrides, historico, inicioISO, fimISO]
  );

  function verSinistrosDoUsuario(usuarioId) {
    resetListFilter();
    patchListFilter({ responsavel: usuarioId, aberto: true, showFilters: true });
    navigate("sinistros");
  }

  const totalSemHistorico = metricas.reduce((s, m) => s + m.processosSemHistoricoEstruturado, 0);

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Desempenho</h1>
          <p>Métricas por usuário, baseadas no histórico de responsabilidade — respeita quem era responsável em cada período.</p>
        </div>
      </div>

      <div className="card">
        <div className="chips" style={{ alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Período:</span>
          <span className="muted" style={{ fontSize: 12 }}>de</span>
          <input type="date" className="inline" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} />
          <span className="muted" style={{ fontSize: 12 }}>até</span>
          <input type="date" className="inline" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} />
          {[7, 30, 90].map((d) => (
            <div key={d} className="chip-btn" onClick={() => { setPeriodoDe(diasAtras(d)); setPeriodoAte(todayISO()); }}>{d} dias</div>
          ))}
          <div className="chip-btn" onClick={() => { setPeriodoDe(""); setPeriodoAte(""); }}>Todo o histórico</div>
        </div>
        {totalSemHistorico > 0 && (
          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            ⚠ {totalSemHistorico} processo(s) no estoque atual ainda sem histórico de responsabilidade estruturado — os números de "Estoque atual"/"Atrasados" continuam corretos (usam o responsável atual direto), mas "Tempo médio" e "Assumidos no período" ficam incompletos para eles. Gere a estimativa em Configurações.
          </p>
        )}
      </div>

      {!users.length ? <div className="card"><EmptyState>Nenhum usuário cadastrado.</EmptyState></div> : (
        <div className="card">
          <div style={{ overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th className="right">Assumidos no período</th>
                  <th className="right">Sob responsabilidade no período</th>
                  <th className="right">Estoque atual</th>
                  <th className="right">Atrasados</th>
                  <th className="right">Tempo médio de responsabilidade</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {metricas.map((m) => (
                  <tr key={m.usuarioId}>
                    <td>{m.usuarioNome}</td>
                    <td className="mono right">{fmtNum(m.processosAssumidosNoPeriodo)}</td>
                    <td className="mono right">{fmtNum(m.processosSobResponsabilidadeNoPeriodo)}</td>
                    <td className="mono right">{fmtNum(m.estoqueAtual)}</td>
                    <td className="mono right">{m.atrasadosAtual > 0 ? <span className="badge red">{m.atrasadosAtual}</span> : "0"}</td>
                    <td className="mono right">{fmtDiasMedia(m.tempoMedioResponsabilidadeDias)}</td>
                    <td><button className="btn sec xs" onClick={() => verSinistrosDoUsuario(m.usuarioId)}>Ver sinistros</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            "Assumidos no período" e "Tempo médio" vêm do histórico de responsabilidade (corp_responsabilidade_historico) — só contam o tempo em que o usuário esteve de fato como responsável, mesmo que o processo já existisse antes. "Estoque atual" e "Atrasados" usam o responsável vigente agora, independente do período selecionado.
          </p>
        </div>
      )}
    </div>
  );
}

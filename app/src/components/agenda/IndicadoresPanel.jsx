import { useMemo, useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { Avatar } from "../Avatar.jsx";
import { metricasAgenda, dataLocalISO, addDias, fmtPct, fmtMin } from "../../logic/agenda";

function Stat({ label, value, danger, hint }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }} title={hint}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: danger ? "var(--danger)" : undefined }}>{value}</div>
    </div>
  );
}

// Grade de indicadores de UM usuário — também usada no perfil do módulo
// Desempenho (pages/Desempenho.jsx).
export function IndicadoresAgendaGrid({ m, cfg }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
      <Stat label="Cumprimento da agenda" value={fmtPct(m.taxaCumprimento)} danger={m.taxaCumprimento != null && m.taxaCumprimento < 0.7} hint="Ações concluídas ÷ ações cujo horário já terminou" />
      <Stat label="Pontualidade no início" value={fmtPct(m.pontualidade)} danger={m.pontualidade != null && m.pontualidade < 0.7} hint={`Iniciadas até ${cfg.toleranciaMin} min depois do horário`} />
      <Stat label="Atraso médio pra iniciar" value={fmtMin(m.atrasoMedioInicioMin)} />
      <Stat label="Ações previstas" value={m.previstas} />
      <Stat label="Concluídas" value={m.concluidas} />
      <Stat label="Não realizadas (justificadas)" value={m.naoRealizadas} danger={m.naoRealizadas > 0} />
      <Stat label="Sem registro" value={m.semRegistro} danger={m.semRegistro > 0} hint="Horário passou sem nenhum registro de início/fim" />
      <Stat label="Sonecas usadas" value={m.sonecas} />
      <Stat label="Lembretes confirmados" value={m.lembretes} />
      <Stat label="Feedbacks registrados" value={m.feedbacks} />
      <Stat label="Tempo produtivo planejado" value={fmtMin(m.minPlanejados)} hint="Sem contar pausas (almoço, café)" />
      <Stat label="Tempo produtivo executado" value={fmtMin(m.minExecutados)} hint="Do registro de início ao de fim, sem pausas" />
    </div>
  );
}

export function IndicadoresPanel({ blocos, feedbacks, agendaUsers, userIdSelecionado, podeVerTodos, cfg }) {
  const hoje = dataLocalISO();
  const [de, setDe] = useState(addDias(hoje, -6));
  const [ate, setAte] = useState(hoje);
  const [userId, setUserId] = useState(userIdSelecionado);

  const porUsuario = useMemo(
    () => agendaUsers.map((u) => ({ u, m: metricasAgenda({ blocos, feedbacks, userId: u.id, deISO: de, ateISO: ate, cfg }) })),
    [agendaUsers, blocos, feedbacks, de, ate, cfg]
  );
  const sel = porUsuario.find((x) => x.u.id === userId) || porUsuario[0];

  if (!sel) return <div className="card"><EmptyState>Nenhum Atendente/Analista com agenda.</EmptyState></div>;

  return (
    <>
      <div className="card">
        <div className="chips" style={{ alignItems: "center", marginBottom: 0 }}>
          <span className="muted" style={{ fontSize: 12 }}>Período: de</span>
          <input type="date" className="inline" value={de} onChange={(e) => setDe(e.target.value)} />
          <span className="muted" style={{ fontSize: 12 }}>até</span>
          <input type="date" className="inline" value={ate} onChange={(e) => setAte(e.target.value)} />
          <div className="chip-btn" onClick={() => { setDe(hoje); setAte(hoje); }}>Hoje</div>
          {[7, 30, 90].map((d) => (
            <div key={d} className="chip-btn" onClick={() => { setDe(addDias(hoje, -(d - 1))); setAte(hoje); }}>{d} dias</div>
          ))}
        </div>
      </div>

      {podeVerTodos && porUsuario.length > 1 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Equipe</h3>
          <div style={{ overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th></th><th>Usuário</th>
                  <th className="right">Cumprimento</th><th className="right">Pontualidade</th>
                  <th className="right">Concluídas</th><th className="right">Sem registro</th>
                  <th className="right">Sonecas</th><th></th>
                </tr>
              </thead>
              <tbody>
                {porUsuario.map(({ u, m }) => (
                  <tr key={u.id} style={sel.u.id === u.id ? { background: "rgba(var(--brand-rgb),.06)" } : undefined}>
                    <td><Avatar url={u.fotoUrl} nome={u.nome} size={28} /></td>
                    <td>{u.nome}</td>
                    <td className="mono right">{fmtPct(m.taxaCumprimento)}</td>
                    <td className="mono right">{fmtPct(m.pontualidade)}</td>
                    <td className="mono right">{m.concluidas}/{m.vencidas}</td>
                    <td className="mono right">{m.semRegistro > 0 ? <span className="badge red">{m.semRegistro}</span> : "0"}</td>
                    <td className="mono right">{m.sonecas}</td>
                    <td><button className="btn sec xs" onClick={() => setUserId(u.id)}>Detalhar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{sel.u.nome}</h3>
        <IndicadoresAgendaGrid m={sel.m} cfg={cfg} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Por tipo de ação</h3>
        {!sel.m.porCategoria.length ? <EmptyState>Nenhuma ação no período.</EmptyState> : (
          <div style={{ overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Ação</th><th className="right">Previstas</th><th className="right">Concluídas</th>
                  <th className="right">Cumprimento</th><th className="right">Planejado</th><th className="right">Executado</th>
                </tr>
              </thead>
              <tbody>
                {sel.m.porCategoria.map((c) => (
                  <tr key={c.chave}>
                    <td><span className="agenda-cor-ponto" style={{ background: c.cor }} />{c.icone} {c.titulo}</td>
                    <td className="mono right">{c.previstas}</td>
                    <td className="mono right">{c.concluidas}</td>
                    <td className="mono right">{fmtPct(c.vencidas ? c.concluidas / c.vencidas : null)}</td>
                    <td className="mono right">{fmtMin(c.minPlanejados)}</td>
                    <td className="mono right">{fmtMin(c.minExecutados)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

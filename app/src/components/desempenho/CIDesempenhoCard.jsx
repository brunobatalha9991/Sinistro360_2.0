import { fmtNum } from "../../logic/format";
import { fmtPct } from "../../logic/agenda";
import { fmtMinutos } from "../../logic/conduta";

function Stat({ label, value, danger, title }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }} title={title}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: danger ? "var(--danger)" : undefined }}>{value}</div>
    </div>
  );
}

function Grupo({ titulo, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)", marginBottom: 8 }}>{titulo}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>{children}</div>
    </div>
  );
}

// Atuação do operador na Comunicação Interna (ver logic/desempenhoCI.js).
export function CIDesempenhoCard({ m, periodoLabel, onVerCIs }) {
  const tipos = Object.entries(m.porTipo).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Comunicação Interna ({periodoLabel})</h3>
        {onVerCIs && <button className="btn ghost xs" onClick={onVerCIs}>Abrir Comunicação</button>}
      </div>
      <p className="muted" style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>
        CIs criadas no período em que este usuário é destinatário (as que ele mesmo criou ficam em "Como origem"). "Situação agora" independe do período. Prazo e tempo até a 1ª interação contam só o horário comercial, como o alerta de CI sem interação (Configurações).
      </p>

      <Grupo titulo="Volume">
        <Stat label="Recebidas como destinatário" value={fmtNum(m.recebidas)} />
        <Stat label="Urgentes recebidas" value={fmtNum(m.urgentes)} />
        <Stat label="Mesa de Atendimento" value={fmtNum(m.assistencias)} />
        <Stat label="Comentários feitos" value={fmtNum(m.comentarios)} />
        <Stat label="CIs em que comentou" value={fmtNum(m.cisComentadas)} />
        <Stat label="Comentários por CI" value={m.comentariosPorCI == null ? "—" : m.comentariosPorCI.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} />
      </Grupo>

      <Grupo titulo="Situação das recebidas no período">
        <Stat label="Pendentes" value={fmtNum(m.pendentes)} danger={m.pendentes > 0} />
        <Stat label="Em andamento" value={fmtNum(m.emAndamento)} />
        <Stat label="Concluídas" value={fmtNum(m.concluidas)} />
        <Stat label="Taxa de conclusão" value={fmtPct(m.taxaConclusao)} />
        <Stat label="Urgentes concluídas" value={`${m.urgentesConcluidas}/${m.urgentes}`} />
        <Stat label="Arquivadas" value={fmtNum(m.arquivadas)} title="Arquivadas manualmente + concluídas há mais de 4 dias" />
        <Stat label="Arquivadas manualmente" value={fmtNum(m.arquivadasManual)} />
        <Stat label="Concluídas por ele" value={fmtNum(m.concluidasPorEle)} title="CIs em que foi ele quem mudou o status para Concluído (no período)" />
      </Grupo>

      <Grupo titulo="Tempo e resposta">
        <Stat label="Tempo médio de encerramento" value={fmtMinutos(m.tempoMedioEncerramentoMin)} title="Da criação até a conclusão, nas recebidas já concluídas" />
        <Stat label="Tempo mediano de encerramento" value={fmtMinutos(m.tempoMedianoEncerramentoMin)} />
        <Stat label="Tempo médio até a 1ª interação" value={fmtMinutos(m.tempoMedioPrimeiraInteracaoMin)} title="Da criação até o primeiro ciente, comentário ou alteração dele" />
        <Stat label="Tempo mediano até a 1ª interação" value={fmtMinutos(m.tempoMedianoPrimeiraInteracaoMin)} />
        <Stat label="1ª interação no prazo" value={fmtPct(m.pctNoPrazo)} danger={m.pctNoPrazo != null && m.pctNoPrazo < 0.7} />
        <Stat label="Em atraso por falta de interação" value={fmtNum(m.foraPrazo)} danger={m.foraPrazo > 0} title="Primeira interação depois do prazo (10 min, ou 5 se Urgente), ou nenhuma interação com o prazo vencido" />
        <Stat label="Sem nenhuma interação" value={fmtNum(m.semInteracao)} danger={m.semInteracao > 0} />
        <Stat label="Deu ciente" value={`${fmtNum(m.cientes)} (${fmtPct(m.taxaCiente)})`} />
      </Grupo>

      <Grupo titulo="Situação agora">
        <Stat label="Abertas como destinatário" value={fmtNum(m.abertasAgora)} />
        <Stat label="Idade média das abertas" value={fmtMinutos(m.idadeMediaAbertasMin)} />
        <Stat label="Abertas paradas há +24h" value={fmtNum(m.paradas24h)} danger={m.paradas24h > 0} title="Sem ciente ou comentário dele nas últimas 24h" />
        <Stat label="Abertas com notificação não lida" value={fmtNum(m.naoLidas)} danger={m.naoLidas > 0} />
      </Grupo>

      <Grupo titulo="Intervenções e ausência">
        <Stat label="Intervenções recebidas" value={fmtNum(m.intervRecebidas)} />
        <Stat label="Intervenções respondidas" value={fmtNum(m.intervRespondidas)} />
        <Stat label="Sem resposta" value={fmtNum(m.intervPendentes)} danger={m.intervPendentes > 0} />
        <Stat label="Tempo médio de resposta" value={fmtMinutos(m.tempoMedioRespostaIntervencaoMin)} />
        <Stat label="Generalizadas por ausência" value={fmtNum(m.generalizadas)} danger={m.generalizadas > 0} />
      </Grupo>

      <Grupo titulo="Como origem (CIs que criou)">
        <Stat label="Criadas" value={fmtNum(m.criadas)} />
        <Stat label="Concluídas" value={fmtNum(m.criadasConcluidas)} />
        <Stat label="Tempo médio de encerramento" value={fmtMinutos(m.tempoMedioEncerramentoCriadasMin)} />
      </Grupo>

      {tipos.length > 0 && (
        <div className="chips" style={{ marginTop: 14 }}>
          <span className="muted" style={{ fontSize: 12 }}>Recebidas por tipo:</span>
          {tipos.map(([t, n]) => <span key={t} className="badge blue">{t}: {n}</span>)}
        </div>
      )}
    </div>
  );
}

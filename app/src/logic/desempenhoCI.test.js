import { describe, it, expect } from "vitest";
import { normalizarCI, todasCIsNormalizadas, metricasCIUsuario, resumoHistoricoCI } from "./desempenhoCI";

const T0 = "2026-10-20T12:00:00.000Z";
const mais = (min) => new Date(Date.parse(T0) + min * 60000).toISOString();
const agora = new Date("2026-10-28T12:00:00.000Z");

function ci(extra) {
  return { id: "t", ci: "CI-1", tipo: "Comunicação", urgencia: "Leve", origem: "adm", destinatarios: ["joao"], status: "Pendente", createdAt: T0, comments: [], ciente: {}, log: [{ at: T0, who: "adm", acao: "Tarefa criada por Admin" }], ...extra };
}

describe("métricas de CI por operador", () => {
  const tasks = [
    // respondida em 4 min com comentário, concluída por ele em 2h
    ci({ id: "a", status: "Concluído", concludedAt: mais(120),
      comments: [{ userId: "joao", at: mais(4) }, { userId: "joao", at: mais(110) }],
      log: [{ at: T0, who: "adm", acao: "Tarefa criada" }, { at: mais(120), who: "joao", acao: 'Status alterado de "Pendente" para "Concluído"' }] }),
    // urgente, primeiro ciente só em 30 min (fora do prazo de 5)
    ci({ id: "b", urgencia: "Urgente", status: "Em andamento", ciente: { joao: mais(30) } }),
    // nunca interagiu
    ci({ id: "c" }),
    // fora do período
    ci({ id: "d", createdAt: "2026-09-01T12:00:00.000Z" }),
    // criada por ele
    ci({ id: "e", origem: "joao", destinatarios: ["adm"] }),
    // intervenção respondida em 3 min
    ci({ id: "f", status: "Concluído", concludedAt: mais(60), intervencoes: [{ id: "i", autorId: "adm", at: mais(10), alvos: ["joao"], respostas: { joao: { texto: "ok", at: mais(13) } } }],
      comments: [{ userId: "joao", at: mais(13) }] }),
  ];
  const cis = todasCIsNormalizadas(tasks, []);
  const m = metricasCIUsuario({ cis, notifs: [], userId: "joao", deISO: "2026-10-01", ateISO: "2026-10-31", config: {}, agora });

  it("volume e situação", () => {
    expect(m.recebidas).toBe(4);
    expect(m.concluidas).toBe(2);
    expect(m.emAndamento).toBe(1);
    expect(m.pendentes).toBe(1);
    expect(m.urgentes).toBe(1);
    expect(m.concluidasPorEle).toBe(1);
    expect(m.criadas).toBe(1);
    expect(m.comentarios).toBe(3);
    expect(m.cisComentadas).toBe(2);
  });
  it("tempos e prazo", () => {
    expect(m.tempoMedioEncerramentoMin).toBe(90);
    expect(m.tempoMedioPrimeiraInteracaoMin).toBeCloseTo((4 + 30 + 13) / 3);
    expect(m.noPrazo).toBe(1);          // a (4 min)
    expect(m.foraPrazo).toBe(3);        // b (30 > 5), f (13 > 10), c (nunca, prazo vencido)
    expect(m.semInteracao).toBe(1);
    expect(m.intervRecebidas).toBe(1);
    expect(m.tempoMedioRespostaIntervencaoMin).toBe(3);
  });
  it("abertas agora e paradas", () => {
    expect(m.abertasAgora).toBe(3); // b, c, d (d é de outro período mas está aberta)
    expect(m.paradas24h).toBe(3);
  });
  it("histórico substitui CI apagada e não duplica a viva", () => {
    const h = resumoHistoricoCI(tasks[0]);
    expect(h.historico).toBe(true);
    expect(todasCIsNormalizadas([], [h])).toHaveLength(1);
    expect(todasCIsNormalizadas([tasks[0]], [h])).toHaveLength(1);
    expect(normalizarCI(h)).toBe(h);
  });
});

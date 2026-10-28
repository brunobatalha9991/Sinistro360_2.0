import { describe, it, expect } from "vitest";
import { condutaPendentes, metricasConduta, comConduta, ehOperacional } from "./conduta";

const base = { userId: "u1", autorId: "adm", titulo: "X", texto: "", exigeFeedback: false, cienteAt: null, feedback: "", sonecaAte: null, sonecas: 0 };

describe("conduta", () => {
  it("operacional = atendente/analista, mesmo com VIP", () => {
    expect(ehOperacional({ role: "atendente" })).toBe(true);
    expect(ehOperacional({ role: "analista", vip: true })).toBe(true);
    expect(ehOperacional({ role: "admin" })).toBe(false);
    expect(ehOperacional({ role: "consulta" })).toBe(false);
  });

  it("pendentes: sem ciente e fora da soneca, mais antigo primeiro", () => {
    const agora = new Date("2026-10-28T12:00:00Z");
    const regs = [
      { ...base, id: "b", at: "2026-10-28T11:00:00Z" },
      { ...base, id: "a", at: "2026-10-28T10:00:00Z" },
      { ...base, id: "c", at: "2026-10-28T09:00:00Z", cienteAt: "2026-10-28T09:05:00Z" },
      { ...base, id: "d", at: "2026-10-28T09:00:00Z", sonecaAte: "2026-10-28T12:02:00Z" },
      { ...base, id: "e", at: "2026-10-28T09:00:00Z", sonecaAte: "2026-10-28T11:59:00Z" },
      { ...base, id: "f", userId: "u2", at: "2026-10-28T09:00:00Z" },
    ];
    expect(condutaPendentes(regs, "u1", agora).map((r) => r.id)).toEqual(["e", "a", "b"]);
  });

  it("métricas por período", () => {
    const regs = [
      { ...base, id: "1", tipo: "advertencia", at: "2026-10-20T10:00:00Z", cienteAt: "2026-10-20T10:30:00Z" },
      { ...base, id: "2", tipo: "comunicado", at: "2026-10-21T10:00:00Z", cienteAt: "2026-10-21T10:10:00Z" },
      { ...base, id: "3", tipo: "feedback", at: "2026-10-22T10:00:00Z", exigeFeedback: true, sonecas: 2 },
      { ...base, id: "4", tipo: "falha", at: "2026-09-01T10:00:00Z" },
    ];
    const m = metricasConduta({ registros: regs, userId: "u1", deISO: "2026-10-01", ateISO: "2026-10-31" });
    expect(m.total).toBe(3);
    expect(m.negativos).toBe(1);
    expect(m.pendentesCiente).toBe(1);
    expect(m.tempoMedioCienteMin).toBe(20);
    expect(m.feedbacksSolicitados).toBe(1);
    expect(m.feedbacksRespondidos).toBe(0);
    expect(m.sonecas).toBe(2);
    const a = comConduta({ pontosFortes: [], pontosAtencao: [] }, m);
    expect(a.pontosAtencao.join(" ")).toContain("1 advertência(s)");
  });
});

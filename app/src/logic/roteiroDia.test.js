import { describe, it, expect } from "vitest";
import { resumoRoteiro, fmtCronometro } from "./roteiroDia";

const D = "2026-10-28";
const bloco = (id, inicio, fim, extra) => ({ id, userId: "u", data: D, inicio, fim, titulo: id, tipo: "acao", recorrencia: { tipo: "nenhuma" }, ...extra });
const blocos = [
  bloco("emails", "08:30", "09:00"),
  bloco("whats", "09:00", "09:30", { lembreteMin: 10 }),
  bloco("almoco", "12:00", "12:00", { tipo: "marco" }),
  bloco("retornos", "14:00", "15:00"),
];
const fb = (blocoId, tipo, hhmm) => ({ blocoId, data: D, tipo, at: new Date(2026, 9, 28, ...hhmm.split(":").map(Number)).toISOString() });
const em = (hhmm) => new Date(2026, 9, 28, ...hhmm.split(":").map(Number));

describe("roteiro do dia", () => {
  it("em andamento com contagem até o fim previsto", () => {
    const r = resumoRoteiro({ blocos, feedbacks: [fb("emails", "inicio", "08:31")], userId: "u", agora: em("08:45") });
    expect(r.estado).toBe("em_andamento");
    expect(r.atual.oc.titulo).toBe("emails");
    expect(r.atual.fimMs - em("08:45").getTime()).toBe(15 * 60000);
    expect(r.proxima.oc.titulo).toBe("whats");
  });
  it("encerrando nos 2 últimos minutos e estourada depois do fim", () => {
    const f = [fb("emails", "inicio", "08:31")];
    expect(resumoRoteiro({ blocos, feedbacks: f, userId: "u", agora: em("08:59") }).estado).toBe("encerrando");
    const r = resumoRoteiro({ blocos, feedbacks: f, userId: "u", agora: em("09:05") });
    expect(r.estado).toBe("estourada");
    expect(r.estouradas).toHaveLength(1);
  });
  it("atrasada quando o horário começou sem iniciar; sem registro quando passou", () => {
    const r = resumoRoteiro({ blocos, feedbacks: [fb("emails", "inicio", "08:30"), fb("emails", "fim", "09:00")], userId: "u", agora: em("09:10") });
    expect(r.estado).toBe("atrasada");
    expect(r.atual.oc.titulo).toBe("whats");
    const r2 = resumoRoteiro({ blocos, feedbacks: [], userId: "u", agora: em("09:40") });
    expect(r2.semRegistro.map((x) => x.oc.titulo)).toEqual(["emails", "whats"]);
    expect(r2.alertas).toBe(2);
  });
  it("em breve dentro do lembrete, livre fora, fim do dia e progresso", () => {
    const feitos = [fb("emails", "inicio", "08:30"), fb("emails", "fim", "09:00"), fb("whats", "inicio", "09:00"), fb("whats", "fim", "09:30"), fb("almoco", "fim", "12:00")];
    expect(resumoRoteiro({ blocos, feedbacks: feitos, userId: "u", agora: em("13:56") }).estado).toBe("em_breve");
    expect(resumoRoteiro({ blocos, feedbacks: feitos, userId: "u", agora: em("13:00") }).estado).toBe("livre");
    const r = resumoRoteiro({ blocos, feedbacks: [...feitos, fb("retornos", "inicio", "14:00"), fb("retornos", "fim", "15:00")], userId: "u", agora: em("16:00") });
    expect(r.estado).toBe("fim");
    expect(r.progresso.concluidas).toBe(3);
    expect(r.progresso.total).toBe(3);
    expect(r.progresso.minExecutados).toBe(120);
    expect(r.progresso.pontualidade).toBe(1);
  });
  it("sem agenda", () => {
    expect(resumoRoteiro({ blocos: [], feedbacks: [], userId: "u", agora: em("10:00") }).estado).toBe("sem_agenda");
  });
  it("formata cronômetro", () => {
    expect(fmtCronometro(754000)).toBe("12:34");
    expect(fmtCronometro(3754000)).toBe("1:02:34");
    expect(fmtCronometro(-65000)).toBe("+01:05");
  });
});

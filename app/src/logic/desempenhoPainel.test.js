import { describe, it, expect } from "vitest";
import { calcularIndice, nivelDoScore, assiduidade, filaDoDia, semanasRecentes, PESOS_DEFAULT } from "./desempenhoPainel";

describe("índice de desempenho", () => {
  const m = { estoqueAtual: 10, atrasadosAtual: 2, semAtualizacaoAtual: 1 };
  const ex = { pctComProximaAcao: 0.9, semProximaAcao: 1, etapasForaPrazo: 0, reclamacoes: 0 };
  const ci = { pctNoPrazo: 0.8, recebidas: 10, semInteracao: 0, foraPrazo: 2, intervRecebidas: 0, intervRespondidas: 0 };
  const agenda = { taxaCumprimento: 0.9, pontualidade: 0.7, concluidas: 9, vencidas: 10 };
  const conduta = { negativos: 0, total: 0, pendentesCiente: 0 };
  const assid = { pctPresenca: 1, pctNoHorario: 0.5, faltas: 0, diasUteis: 4, diasNoHorario: 2, diasComAcesso: 4 };

  it("média ponderada dos pilares com dado", () => {
    const r = calcularIndice({ m, ex, ci, agenda, conduta, assid, pesos: PESOS_DEFAULT });
    // Carteira (v4): próximas ações em dia e histórico atualizado pesam 2.
    const proc = (0.8 * 2 + 0.9 * 2 + 0.9 + 1) / 6;
    const ciV = (0.8 + 1) / 2;
    const ag = 0.8;
    const as = 0.75;
    const cd = 1;
    // Sem `en` (Entrega/Produção) esses pilares ficam de fora.
    const esperado = Math.round(((proc * 20 + ciV * 15 + ag * 10 + as * 5 + cd * 5) / 55) * 100);
    expect(r.score).toBe(esperado);
    expect(r.pilares.find((p) => p.key === "ci").componentes[2].valor).toBeNull();
  });
  it("pilar sem dados sai do cálculo (sem agenda)", () => {
    const r = calcularIndice({ m, ex, ci, agenda: null, conduta, assid, pesos: PESOS_DEFAULT });
    expect(r.pilares.find((p) => p.key === "agenda").valor).toBeNull();
    expect(r.score).toBeGreaterThan(0);
  });
  it("conduta negativa derruba o pilar", () => {
    const r = calcularIndice({ m, ex, ci, agenda, conduta: { negativos: 2, total: 2, pendentesCiente: 1 }, assid, pesos: PESOS_DEFAULT });
    expect(r.pilares.find((p) => p.key === "conduta").valor).toBeCloseTo((0.5 + 0.5 + 1) / 3);
  });
  it("níveis", () => {
    expect(nivelDoScore(90).key).toBe("excelente");
    expect(nivelDoScore(70).key).toBe("bom");
    expect(nivelDoScore(55).key).toBe("atencao");
    expect(nivelDoScore(10).key).toBe("critico");
    expect(nivelDoScore(null).key).toBe("sem_dados");
  });
});

describe("assiduidade", () => {
  const ac = (u, d, hh, mm) => ({ [`${u}_${d}`]: { userId: u, data: d, primeiroAcesso: new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), hh, mm).toISOString() } });
  it("conta dias úteis desde o primeiro registro, presença e chegada", () => {
    const acessos = { ...ac("x", "2026-10-26", 8, 20), ...ac("u", "2026-10-26", 8, 40), ...ac("u", "2026-10-27", 9, 30), ...ac("u", "2026-10-29", 8, 31) };
    const r = assiduidade({ acessos, userId: "u", deISO: "2026-10-01", ateISO: "2026-10-31", agora: new Date(2026, 9, 30, 12, 0) });
    // 26 (seg), 27, 28, 29, 30 (sex) = 5 dias úteis; 28 e 30 sem acesso
    expect(r.diasUteis).toBe(5);
    expect(r.diasComAcesso).toBe(3);
    expect(r.faltas).toBe(2);
    expect(r.diasNoHorario).toBe(2);
  });
  it("hoje antes do limite não conta como falta", () => {
    const acessos = { ...ac("u", "2026-10-29", 8, 31) };
    // Limite padrão v4: 08:30 + 10 min = 08:40.
    const r = assiduidade({ acessos, userId: "u", agora: new Date(2026, 9, 30, 8, 39) });
    expect(r.diasUteis).toBe(1);
  });
});

describe("fila do dia", () => {
  it("prioriza intervenção, CI urgente, ação vencida, depois ação de hoje", () => {
    const hoje = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
    const claims = [{ id: "c1", segurado: "A" }, { id: "c2", segurado: "B" }];
    const overrides = {
      c1: { responsavelUser: { id: "u" }, nextAction: { title: "Ligar", date: iso(hoje) } },
      c2: { responsavelUser: { id: "u" }, nextAction: { title: "Cobrar", date: iso(ontem) } },
    };
    const tasks = [
      { id: "t1", titulo: "Urgente", origem: "adm", destinatarios: ["u"], status: "Pendente", urgencia: "Urgente" },
      { id: "t2", titulo: "Normal", origem: "adm", destinatarios: ["u"], status: "Pendente", urgencia: "Leve", ciente: { u: "x" } },
      { id: "t3", titulo: "Com intervenção", origem: "adm", destinatarios: ["u"], status: "Pendente", urgencia: "Leve", ciente: { u: "x" }, intervencoes: [{ id: "i", alvos: ["u"], respostas: {} }] },
    ];
    const fila = filaDoDia({ claims, overrides, tasks, userId: "u", atendTemplateCfg: null, templates: {}, roteiro: null });
    expect(fila.map((x) => x.tipo)).toEqual(["intervencao", "ci", "vencida", "hoje"]);
  });
});

describe("semanas", () => {
  it("8 semanas começando na segunda", () => {
    const s = semanasRecentes(8, new Date(2026, 9, 28));
    expect(s).toHaveLength(8);
    expect(s[7].de).toBe("2026-10-26");
    expect(s[7].ate).toBe("2026-11-01");
  });
});

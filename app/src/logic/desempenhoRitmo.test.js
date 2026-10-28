import { describe, it, expect } from "vitest";
import {
  pontosPorAtraso, impactoPendencias, compararFotos, registrarFoto, resumoRitmo, montarFoto, textoFechamento,
  IMPACTO_MAX, PONTOS_PENDENTE, dentroDoExpediente, ganhosDoDia, sequenciaSemAtraso,
} from "./desempenhoRitmo";
import { todasCIsNormalizadas } from "./desempenhoCI";
import { calcularIndice, PESOS_DEFAULT } from "./desempenhoPainel";

const luiz = { id: "luiz", nome: "Luiz", role: "atendente" };

describe("impacto progressivo", () => {
  it("faixas por idade do atraso", () => {
    expect(pontosPorAtraso(0)).toBe(1);
    expect(pontosPorAtraso(1)).toBe(1);
    expect(pontosPorAtraso(3)).toBe(2);
    expect(pontosPorAtraso(7)).toBe(3);
    expect(pontosPorAtraso(20)).toBe(5);
  });

  const cfgCI = { horarioInicio: "08:30", horarioFim: "18:00", soDiasUteis: true, minutos: 10, minutosUrgente: 5 };
  const qua = (h, m) => new Date(2026, 9, 28, h, m);
  const ci = (extra) => ({ id: "t1", ci: "CI-1", titulo: "Ver vistoria", origem: "ana", destinatarios: ["luiz"], status: "Pendente", urgencia: "Leve", createdAt: qua(9, 0).toISOString(), comments: [], log: [], ciente: {}, ...extra });

  it("CI sem interação: pendente dentro do prazo, atrasada depois; interação zera", () => {
    const base = { claims: [], overrides: {}, blocos: [], feedbacks: [], user: luiz, cfgCI };
    let r = impactoPendencias({ ...base, tasks: [ci()], agora: qua(9, 5) });
    expect(r.itens[0].status).toBe("pendente");
    expect(r.pontos).toBe(PONTOS_PENDENTE);
    r = impactoPendencias({ ...base, tasks: [ci()], agora: qua(9, 30) });
    expect(r.itens[0].status).toBe("atrasada");
    expect(r.pontos).toBe(1);
    r = impactoPendencias({ ...base, tasks: [ci({ urgencia: "Urgente" })], agora: qua(9, 30) });
    expect(r.pontos).toBe(2);
    r = impactoPendencias({ ...base, tasks: [ci({ ciente: { luiz: qua(9, 2).toISOString() } })], agora: qua(9, 30) });
    expect(r.itens).toHaveLength(0);
  });
  it("intervenção sem resposta pesa 3 e o desconto tem teto", () => {
    const ivs = Array.from({ length: 20 }, (_, i) => ({ id: "iv" + i, alvos: ["luiz"], respostas: {} }));
    const r = impactoPendencias({ claims: [], overrides: {}, blocos: [], feedbacks: [], user: luiz, cfgCI, tasks: [ci({ status: "Concluído", intervencoes: ivs })], agora: qua(10, 0) });
    expect(r.pontosBrutos).toBe(60);
    expect(r.pontos).toBe(IMPACTO_MAX);
  });
  it("o índice final desconta o impacto do índice dos pilares", () => {
    const m = { estoqueAtual: 10, atrasadosAtual: 0, semAtualizacaoAtual: 0 };
    const ex = { pctComProximaAcao: 1, semProximaAcao: 0, etapasForaPrazo: 0, reclamacoes: 0 };
    const r = calcularIndice({ m, ex, ci: null, agenda: null, conduta: null, assid: null, pesos: PESOS_DEFAULT, impacto: { pontos: 7, itens: [] } });
    expect(r.scoreBase).toBe(100);
    expect(r.score).toBe(93);
  });
  it("só tira fotos no expediente", () => {
    expect(dentroDoExpediente(qua(8, 0), cfgCI)).toBe(false);
    expect(dentroDoExpediente(qua(12, 0), cfgCI)).toBe(true);
    expect(dentroDoExpediente(qua(18, 20), cfgCI)).toBe(true);
    expect(dentroDoExpediente(new Date(2026, 9, 31, 12, 0), cfgCI)).toBe(false);
  });
});

describe("fotos e ritmo do dia", () => {
  const foto = (at, score, atrasos = [], extra = {}) => ({ at, score, base: score, nivel: score >= 85 ? "excelente" : score >= 70 ? "bom" : score >= 50 ? "atencao" : "critico", pilares: { processos: score }, impacto: atrasos.reduce((s, a) => s + a.p, 0), atrasos, pendentes: 0, ...extra });
  const a1 = { k: "pa:1", t: "Ligar cliente — João", d: 2, p: 2 };

  it("mudança relevante: ±5 pontos, troca de nível ou atraso novo", () => {
    expect(compararFotos(foto("t0", 80), foto("t1", 78)).relevante).toBe(false);
    const c = compararFotos(foto("t0", 80), foto("t1", 72, [a1]));
    expect(c.relevante).toBe(true);
    expect(c.mudancas[0]).toBe("Índice 80 → 72 (-8)");
    expect(c.mudancas.some((x) => x.includes("novo(s) atraso(s)"))).toBe(true);
    expect(compararFotos(foto("t0", 71), foto("t1", 69)).relevante).toBe(true); // Bom → Atenção
  });
  it("registra fotos com intervalo mínimo e monta o resumo do dia", () => {
    const at = (min) => new Date(Date.UTC(2026, 9, 28, 12, min)).toISOString();
    let r = registrarFoto(null, { userId: "luiz", data: "2026-10-28", foto: foto(at(0), 80) });
    expect(r.registro.eventos[0].tipo).toBe("abertura");
    expect(registrarFoto(r.registro, { userId: "luiz", data: "2026-10-28", foto: foto(at(5), 70) })).toBeNull();
    r = registrarFoto(r.registro, { userId: "luiz", data: "2026-10-28", foto: foto(at(15), 70, [a1]) });
    expect(r.comparacao.relevante).toBe(true);
    r = registrarFoto(r.registro, { userId: "luiz", data: "2026-10-28", foto: foto(at(30), 84) });
    const s = resumoRitmo(r.registro);
    expect(s).toMatchObject({ abertura: 80, atual: 84, variacao: 4, minimo: 70, maximo: 84, atrasosNovos: 1, atrasosResolvidos: 1, atrasosAgora: 0, fotos: 3 });
    const txt = textoFechamento("2026-10-28", [{ u: { nome: "Luiz" }, resumo: s }]);
    expect(txt).toContain("Fechamento do dia 28/10");
    expect(txt).toContain("1 atraso(s) criado(s), 1 resolvido(s)");
  });
  it("montarFoto guarda só os atrasos (não as pendências) como itens", () => {
    const f = montarFoto({ score: 70, scoreBase: 75, nivel: { key: "bom" }, pilares: [{ key: "ci", valor: 0.5 }] },
      { pontos: 5, pendentes: 1, itens: [{ key: "a", titulo: "A", dias: 3, pontos: 2, status: "atrasada" }, { key: "b", titulo: "B", dias: 0, pontos: 0.5, status: "pendente" }] });
    expect(f.atrasos).toEqual([{ k: "a", t: "A", d: 3, p: 2 }]);
    expect(f.pilares.ci).toBe(50);
  });
});

describe("ganhos do dia", () => {
  const cfgCI = { horarioInicio: "08:30", horarioFim: "18:00", soDiasUteis: true, minutos: 10, minutosUrgente: 5 };
  const agora = new Date(2026, 9, 28, 15, 0);
  const ctxBase = (extra = {}) => ({
    claims: [], overrides: {}, historico: [], tasks: [], cis: [], notifs: [], blocos: [], feedbacks: [], acessos: {}, ritmo: {}, ocorrencias: [],
    templates: {}, atendTemplateCfg: null, config: {}, cfgAgenda: {}, cfgCI, ...extra,
  });

  it("CI respondida no prazo, intervenção respondida e chegada no horário somam", () => {
    const criada = new Date(2026, 9, 28, 9, 0).toISOString();
    const cis = [{ id: "t1", origem: "ana", destinatarios: ["luiz"], status: "Pendente", urgencia: "Leve", createdAt: criada, comments: [{ userId: "luiz", at: new Date(2026, 9, 28, 9, 3).toISOString() }], log: [], ciente: {}, intervencoes: [] }];
    const acessos = { "luiz_2026-10-28": { userId: "luiz", data: "2026-10-28", primeiroAcesso: new Date(2026, 9, 28, 8, 35).toISOString() } };
    const ctx = ctxBase({ cis: todasCIsNormalizadas(cis, []), tasks: cis, acessos });
    const g = ganhosDoDia({ ctx, user: luiz, impacto: { atrasadas: 0, itens: [] }, agora });
    const chaves = g.itens.map((i) => i.key);
    expect(chaves).toContain("ci_prazo");
    expect(chaves).toContain("pontualidade");
    expect(g.pontos).toBeGreaterThan(0);
  });

  it("atraso resolvido só dá bônus de recuperação com histórico registrado hoje", () => {
    const ev = [{ at: agora.toISOString(), tipo: "atraso_resolvido", k: "pa:c1:2026-10-20", p: 3 }, { at: agora.toISOString(), tipo: "atraso_resolvido", k: "ci:t9", p: 1 }];
    const ritmo = { "luiz_2026-10-28": { eventos: ev } };
    let g = ganhosDoDia({ ctx: ctxBase({ ritmo }), user: luiz, impacto: { atrasadas: 0, itens: [] }, agora });
    expect(g.itens.find((i) => i.key === "recuperacao").pontos).toBe(0.5); // só a CI
    const overrides = { c1: { comms: [{ at: new Date(2026, 9, 28, 14, 0).toISOString(), text: "liguei" }] } };
    g = ganhosDoDia({ ctx: ctxBase({ ritmo, overrides }), user: luiz, impacto: { atrasadas: 0, itens: [] }, agora });
    expect(g.itens.find((i) => i.key === "recuperacao").pontos).toBe(2); // 3×0,5 + 1×0,5
  });

  it("sequência de dias fechando sem atraso", () => {
    const fech = (d, n) => ({ ["__fechamento_" + d]: { linhas: [{ userId: "luiz", atrasosAgora: n }] } });
    const ritmo = { ...fech("2026-10-27", 0), ...fech("2026-10-26", 0), ...fech("2026-10-23", 2) };
    expect(sequenciaSemAtraso(ritmo, "luiz", "2026-10-28")).toBe(2);
  });

  it("índice final = pilares − impacto + ganhos, limitado a 0–100", () => {
    const m = { estoqueAtual: 10, atrasadosAtual: 0, semAtualizacaoAtual: 0 };
    const ex = { pctComProximaAcao: 0.8, semProximaAcao: 2, etapasForaPrazo: 0, reclamacoes: 0 };
    const r = calcularIndice({ m, ex, ci: null, agenda: null, conduta: null, assid: null, pesos: PESOS_DEFAULT, impacto: { pontos: 2, itens: [] }, ganhos: { pontos: 6, itens: [] } });
    expect(r.score).toBe(r.scoreBase - 2 + 6);
    const teto = calcularIndice({ m, ex, ci: null, agenda: null, conduta: null, assid: null, pesos: PESOS_DEFAULT, ganhos: { pontos: 20, itens: [] } });
    expect(teto.score).toBe(100);
  });

  it("ganho novo entre fotos vira evento do ritmo", () => {
    const a = { at: "t0", score: 70, nivel: "bom", pilares: {}, atrasos: [], ganhos: [{ k: "historico", t: "Histórico", p: 0.5 }] };
    const b = { ...a, at: "t1", ganhos: [{ k: "historico", t: "Histórico", p: 1.5 }] };
    const c = compararFotos(a, b);
    expect(c.eventos.find((e) => e.tipo === "ganho").texto).toBe("Histórico: +1 pts");
    expect(c.relevante).toBe(false);
  });
});

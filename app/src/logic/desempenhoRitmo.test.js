import { describe, it, expect } from "vitest";
import {
  pontosPorAtraso, impactoPendencias, compararFotos, registrarFoto, resumoRitmo, montarFoto, textoFechamento,
  IMPACTO_MAX, PONTOS_PENDENTE, dentroDoExpediente,
} from "./desempenhoRitmo";
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

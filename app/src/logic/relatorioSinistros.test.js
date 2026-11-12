import { describe, it, expect } from "vitest";
import {
  montarRelatorioSinistros, grupoSeguradora, termometroKey, proximoDiaUtil, gravarLeitura, leituraAnterior, ordenarDemanda,
} from "./relatorioSinistros";

// Quinta, 12/11/2026, 18h.
const agora = new Date(2026, 10, 12, 18, 0);
const claim = (id, extra) => ({ id, numsin: "N" + id, segurado: "Seg " + id, cia: "BAN", situacao: "EM ANDAMENTO", partyType: "Segurado", datavi: "2026-11-01", ...extra });
const ov = (resp, date, temp, comms) => ({ responsavelUser: resp ? { id: resp, nome: resp } : undefined, nextAction: date ? { date, title: "Ação " + date } : undefined, temperatura: temp, comms: comms || [] });

describe("relatorioSinistros", () => {
  it("agrupa seguradoras e normaliza termômetro", () => {
    expect(grupoSeguradora("azul")).toBe("PORTO");
    expect(grupoSeguradora("ALLI")).toBe("ALLIANZ");
    expect(grupoSeguradora("TOKI")).toBe("TOKI");
    expect(termometroKey("Em atenção")).toBe("atencao");
    expect(termometroKey("")).toBe("sem");
  });

  it("próximo dia útil pula o fim de semana", () => {
    expect(proximoDiaUtil("2026-11-12")).toBe("2026-11-13");
    expect(proximoDiaUtil("2026-11-13")).toBe("2026-11-16");
  });

  it("conta prazos, operadores, alertas e previsto", () => {
    const claims = [
      claim("a", { partyType: "Terceiro" }), claim("b"), claim("c", { cia: "AZUL" }), claim("d", { partyType: "Aviso" }),
      claim("e", { situacao: "INDENIZADO" }), // encerrado: fora do relatório
    ];
    const overrides = {
      a: ov("Maria", "2026-10-01", "Grave"), // atrasado 42 d
      b: ov("Maria", "2026-11-12", "Tranquilo", [{ date: "2026-11-10", text: "ok" }]), // vence hoje
      c: ov("George", "2026-11-13", "Em atenção"), // no prazo, previsto amanhã
      d: ov(null, null, ""), // sem responsável, sem prazo, sem termômetro
      e: ov("Maria", "2026-10-01", "Grave"),
    };
    const tasks = [
      { id: "t1", ci: "CI-1", titulo: "X", destinatarios: ["u1"], status: "Pendente", createdAt: "2026-11-12T10:00:00.000Z" },
      { id: "t2", ci: "CI-2", titulo: "Y", destinatarios: ["u1"], status: "Concluído", createdAt: "2026-11-12T10:00:00.000Z" },
    ];
    const rel = montarRelatorioSinistros({ claims, overrides, tasks, users: [{ id: "u1", nome: "Luiz" }], agora });
    expect(rel.total.processos).toBe(4);
    expect(rel.total.atrasados).toBe(1);
    expect(rel.total.hoje).toBe(1);
    expect(rel.total.noprazo).toBe(1);
    expect(rel.total.semprazo).toBe(1);
    expect(rel.indicadores.maiorAtraso).toBe(42);
    expect(rel.indicadores.atrasados30).toBe(1);
    expect(rel.indicadores.semHistorico).toBe(3);
    expect(rel.indicadores.terceiros).toBe(1);
    expect(rel.indicadores.atendimentos).toBe(1);
    expect(rel.operadores.map((o) => o.nome)).toEqual(["Maria", "George", "Sem responsável"]);
    expect(rel.alertas.graves.map((l) => l.id)).toEqual(["a"]);
    expect(rel.porSeguradora).toEqual([["BAN", 3], ["PORTO", 1]]);
    expect(rel.previsto.data).toBe("2026-11-13");
    expect(rel.previsto.linhas.map((l) => l.id)).toEqual(["c"]);
    expect(rel.cis.map((c) => c.ci)).toEqual(["CI-1"]);
    expect(rel.cisPorResponsavel).toEqual([["Luiz", 1]]);
    expect(rel.comparativo).toBeNull();
  });

  it("ordena a demanda: atrasados mais antigos, hoje, no prazo, sem prazo", () => {
    const l = (id, prazo, diasAtraso, termometro) => ({ id, prazo, diasAtraso, termometro, prazoData: "", segurado: id });
    const out = ordenarDemanda([l("s", "semprazo", null, "grave"), l("p", "noprazo", null, "tranquilo"), l("p2", "noprazo", null, "grave"), l("a1", "atrasado", 2, "grave"), l("a9", "atrasado", 9, "tranquilo"), l("h", "hoje", null, "sem")]);
    expect(out.map((x) => x.id)).toEqual(["a9", "a1", "h", "p2", "p", "s"]);
  });

  it("grava a leitura do dia e compara com a anterior", () => {
    const claims = [claim("a")];
    const overrides = { a: ov("Maria", "2026-10-01", "Grave") };
    const ontem = new Date(2026, 10, 11, 18, 0);
    const relOntem = montarRelatorioSinistros({ claims, overrides, tasks: [], users: [], agora: ontem });
    let leituras = gravarLeitura([], relOntem, ontem);
    leituras = gravarLeitura(leituras, relOntem, new Date(2026, 10, 11, 19, 0)); // mesmo dia: substitui
    expect(leituras).toHaveLength(1);
    expect(leituraAnterior(leituras, "2026-11-11")).toBeNull();
    const rel = montarRelatorioSinistros({ claims: [...claims, claim("b")], overrides: { ...overrides, b: ov("Maria", "2026-11-01", "") }, tasks: [], users: [], agora, leituras });
    expect(rel.comparativo.data).toBe("2026-11-11");
    const emAberto = rel.comparativo.linhas.find((x) => x.label === "Processos em aberto");
    expect(emAberto).toEqual({ label: "Processos em aberto", antes: 1, agora: 2, variacao: 1 });
    expect(rel.comparativo.linhas.find((x) => x.label === "Atrasados de Maria").variacao).toBe(1);
  });
});

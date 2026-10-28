import { describe, it, expect } from "vitest";
import { versoesEfetivas, versaoAtual, sugerirProximaVersao, ordenarVersoes, contarPorTipo, montarHtmlRelatorioVersoes, VERSOES_INICIAIS } from "./versoesSistema";

describe("versões do sistema", () => {
  it("sem nada salvo usa o histórico inicial; lista salva (mesmo vazia) prevalece", () => {
    expect(versoesEfetivas({})).toBe(VERSOES_INICIAIS);
    expect(versoesEfetivas({ corp_versoes_sistema: [] })).toEqual([]);
    expect(versaoAtual({})).toBe("3.4.1");
  });
  it("sugere o próximo número: novidade sobe o meio, melhoria/correção sobe o final", () => {
    expect(sugerirProximaVersao(VERSOES_INICIAIS, true)).toBe("3.5.0");
    expect(sugerirProximaVersao(VERSOES_INICIAIS, false)).toBe("3.4.2");
  });
  it("ordena da mais nova pra mais antiga e conta por tipo", () => {
    const l = ordenarVersoes([{ versao: "1.0.0", data: "2026-10-01" }, { versao: "1.1.0", data: "2026-10-02" }]);
    expect(l[0].versao).toBe("1.1.0");
    expect(contarPorTipo([{ itens: [{ tipo: "novidade" }, { tipo: "correcao" }, { tipo: "correcao" }] }])).toEqual({ novidade: 1, melhoria: 0, correcao: 2 });
  });
  it("relatório traz capa, indicadores, linha do tempo e escapa HTML", () => {
    const html = montarHtmlRelatorioVersoes([{ id: "x", versao: "9.9.9", data: "2026-10-28", titulo: "<b>Teste</b>", itens: [{ id: "i", tipo: "melhoria", modulo: "Agenda", texto: "Algo & mais" }] }], { titulo: "Relatório" });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("v9.9.9");
    expect(html).toContain("&lt;b&gt;Teste&lt;/b&gt;");
    expect(html).toContain("Algo &amp; mais");
    expect(html).toContain("MAIS RECENTE");
  });
});

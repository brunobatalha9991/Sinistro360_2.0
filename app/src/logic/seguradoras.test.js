import { describe, it, expect } from "vitest";
import {
  seguradoraIdFromNome, listaSeguradoras, seguradoraNomeFromId, seguradoraClaims,
  seguradoraComsSeguradora, seguradoraAvaliacaoMedia, seguradoraAguardandoLimitacaoCounts,
  seguradoraReferenciadaLivreEscolhaPorOficina, seguradoraSatisfacaoMedia,
} from "./seguradoras";

describe("seguradoraIdFromNome", () => {
  it("remove acentos, maiusculiza e troca separadores por _", () => {
    expect(seguradoraIdFromNome("Porto Seguro")).toBe("PORTO_SEGURO");
    expect(seguradoraIdFromNome("Tóquio Marine & Cia.")).toBe("TOQUIO_MARINE_CIA");
  });
  it("nome vazio vira SEM_NOME", () => {
    expect(seguradoraIdFromNome("")).toBe("SEM_NOME");
  });
});

const claims = [
  { id: "c1", cia: "Porto Seguro", oficina: "Oficina Central" },
  { id: "c2", cia: "Porto Seguro", oficina: "Oficina Central" },
  { id: "c3", cia: "Porto Seguro", oficina: "Outra Oficina" },
  { id: "c4", cia: "Tokio Marine", oficina: "Oficina Central" },
];

describe("listaSeguradoras + seguradoraNomeFromId", () => {
  it("lista seguradoras distintas ordenadas por nome", () => {
    expect(listaSeguradoras(claims, {})).toEqual([
      { id: seguradoraIdFromNome("Porto Seguro"), nome: "Porto Seguro" },
      { id: seguradoraIdFromNome("Tokio Marine"), nome: "Tokio Marine" },
    ]);
  });
  it("acha o nome a partir do id", () => {
    expect(seguradoraNomeFromId(claims, {}, seguradoraIdFromNome("Tokio Marine"))).toBe("Tokio Marine");
  });
});

describe("seguradoraClaims", () => {
  it("filtra pelo nome exato (considerando override)", () => {
    expect(seguradoraClaims(claims, {}, "Porto Seguro").map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });
});

describe("seguradoraComsSeguradora + seguradoraAvaliacaoMedia", () => {
  const overrides = {
    c1: { comms: [{ canal: "Seguradora", avaliacao: 5 }, { canal: "Cliente", avaliacao: 1 }] },
    c2: { comms: [{ canal: "Seguradora", avaliacao: 3 }] },
  };
  it("só pega comentários canal Seguradora", () => {
    expect(seguradoraComsSeguradora(claims, overrides, "Porto Seguro")).toHaveLength(2);
  });
  it("calcula a média corretamente", () => {
    const coms = seguradoraComsSeguradora(claims, overrides, "Porto Seguro");
    expect(seguradoraAvaliacaoMedia(coms)).toBe(4); // (5+3)/2
  });
});

describe("seguradoraAguardandoLimitacaoCounts", () => {
  it("conta as duas flags", () => {
    const coms = [{ aguardandoRetorno: true }, { limitacaoComunicacao: true, aguardandoRetorno: true }];
    expect(seguradoraAguardandoLimitacaoCounts(coms)).toEqual({ aguardandoRetorno: 2, limitacaoComunicacao: 1 });
  });
});

describe("seguradoraSatisfacaoMedia", () => {
  it("média das notas do alvo seguradora, ignorando não se aplica e sem pesquisa", () => {
    const overrides = {
      c1: { pesquisaSatisfacao: { seguradora: { nota: 2 } } },
      c2: { pesquisaSatisfacao: { seguradora: { nota: 4 } } },
      c3: { pesquisaSatisfacao: { seguradora: { naoAplica: true } } },
    };
    expect(seguradoraSatisfacaoMedia(claims, overrides, "Porto Seguro")).toBe(3);
  });
  it("sem nenhuma nota válida, retorna null", () => {
    expect(seguradoraSatisfacaoMedia(claims, {}, "Porto Seguro")).toBeNull();
  });
});

describe("seguradoraReferenciadaLivreEscolhaPorOficina", () => {
  it("agrupa por oficina (visão inversa da tabela de Oficinas)", () => {
    const overrides = {
      c1: { campos: { vinculoOficina: "Referenciada" } },
      c2: { campos: { vinculoOficina: "Livre Escolha" } },
    };
    const map = seguradoraReferenciadaLivreEscolhaPorOficina(claims, overrides, "Porto Seguro");
    expect(map["Oficina Central"]).toEqual({ referenciada: 1, livreEscolha: 1, semVinculo: 0 });
    expect(map["Outra Oficina"]).toEqual({ referenciada: 0, livreEscolha: 0, semVinculo: 1 });
  });
});

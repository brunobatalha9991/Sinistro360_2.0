import { describe, it, expect } from "vitest";
import {
  oficinaIdFromNome, oficinaClaims, oficinaComsOficina, oficinaAvaliacaoMedia,
  oficinaAguardandoLimitacaoCounts, oficinaTempoMedioReparo, oficinaReferenciadaLivreEscolhaPorSeguradora,
  listaOficinas, oficinaNomeFromId,
} from "./oficinas";

describe("oficinaIdFromNome", () => {
  it("remove acentos, maiusculiza e troca separadores por _", () => {
    expect(oficinaIdFromNome("Oficina São José Ltda.")).toBe("OFICINA_SAO_JOSE_LTDA");
    expect(oficinaIdFromNome("Café & Cia - Auto Peças")).toBe("CAFE_CIA_AUTO_PECAS");
  });
  it("nome vazio vira SEM_NOME", () => {
    expect(oficinaIdFromNome("")).toBe("SEM_NOME");
    expect(oficinaIdFromNome("   ")).toBe("SEM_NOME");
    expect(oficinaIdFromNome(null)).toBe("SEM_NOME");
  });
});

const claims = [
  { id: "c1", oficina: "Oficina Central", cia: "Porto Seguro" },
  { id: "c2", oficina: "Oficina Central", cia: "Porto Seguro" },
  { id: "c3", oficina: "Oficina Central", cia: "Tokio Marine" },
  { id: "c4", oficina: "Outra Oficina", cia: "Porto Seguro" },
];

describe("oficinaClaims", () => {
  it("filtra pelo nome exato (considerando override)", () => {
    const overrides = {};
    const cs = oficinaClaims(claims, overrides, "Oficina Central");
    expect(cs.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });
  it("respeita override manual do campo oficina", () => {
    const overrides = { c4: { campos: { oficina: "Oficina Central" } } };
    const cs = oficinaClaims(claims, overrides, "Oficina Central");
    expect(cs.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4"]);
  });
  it("nome vazio não retorna nada", () => {
    expect(oficinaClaims(claims, {}, "")).toEqual([]);
  });
});

describe("oficinaComsOficina + oficinaAvaliacaoMedia", () => {
  const overrides = {
    c1: { comms: [{ canal: "Oficina", avaliacao: 4 }, { canal: "Cliente", avaliacao: 5 }] },
    c2: { comms: [{ canal: "Oficina", avaliacao: 2 }] },
    c3: { comms: [{ canal: "Oficina", avaliacao: 0 }] },
  };
  it("só pega comentários canal Oficina dos sinistros da oficina", () => {
    const coms = oficinaComsOficina(claims, overrides, "Oficina Central");
    expect(coms).toHaveLength(3);
  });
  it("média ignora notas zero/ausentes", () => {
    const coms = oficinaComsOficina(claims, overrides, "Oficina Central");
    expect(oficinaAvaliacaoMedia(coms)).toBe(3); // (4+2)/2
  });
  it("sem nenhuma nota válida, média é null", () => {
    expect(oficinaAvaliacaoMedia([{ canal: "Oficina", avaliacao: 0 }])).toBeNull();
    expect(oficinaAvaliacaoMedia([])).toBeNull();
  });
});

describe("oficinaAguardandoLimitacaoCounts", () => {
  it("conta as duas flags independentemente", () => {
    const coms = [
      { aguardandoRetorno: true },
      { aguardandoRetorno: true, limitacaoComunicacao: true },
      { limitacaoComunicacao: true },
      {},
    ];
    expect(oficinaAguardandoLimitacaoCounts(coms)).toEqual({ aguardandoRetorno: 2, limitacaoComunicacao: 2 });
  });
});

describe("oficinaTempoMedioReparo", () => {
  it("calcula a média de dias entre firstSetAt e concludedAt da etapa reparo", () => {
    const overrides = {
      c1: { journeyUser: { steps: { reparo: { firstSetAt: "2026-08-01T10:00:00.000Z", concludedAt: "2026-08-06T10:00:00.000Z" } } } },
      c2: { journeyUser: { steps: { reparo: { firstSetAt: "2026-08-01T10:00:00.000Z", concludedAt: "2026-08-11T10:00:00.000Z" } } } },
      c3: { journeyUser: { steps: {} } }, // sem etapa reparo ainda — não conta
    };
    expect(oficinaTempoMedioReparo(claims, overrides, "Oficina Central")).toBe(7.5); // (5+10)/2
  });
  it("sem nenhum sinistro com reparo concluído, retorna null", () => {
    expect(oficinaTempoMedioReparo(claims, {}, "Oficina Central")).toBeNull();
  });
});

describe("listaOficinas + oficinaNomeFromId", () => {
  it("lista oficinas distintas ordenadas por nome, com id derivado", () => {
    const lista = listaOficinas(claims, {});
    expect(lista).toEqual([
      { id: oficinaIdFromNome("Oficina Central"), nome: "Oficina Central" },
      { id: oficinaIdFromNome("Outra Oficina"), nome: "Outra Oficina" },
    ]);
  });
  it("acha o nome a partir do id sem precisar de cadastro", () => {
    const id = oficinaIdFromNome("Oficina Central");
    expect(oficinaNomeFromId(claims, {}, id)).toBe("Oficina Central");
  });
  it("id desconhecido retorna string vazia", () => {
    expect(oficinaNomeFromId(claims, {}, "NAO_EXISTE")).toBe("");
  });
});

describe("oficinaReferenciadaLivreEscolhaPorSeguradora", () => {
  it("agrupa por seguradora e conta Referenciada/Livre Escolha/sem vínculo", () => {
    const overrides = {
      c1: { campos: { vinculoOficina: "Referenciada" } },
      c2: { campos: { vinculoOficina: "Livre Escolha" } },
      // c3 sem vinculoOficina definido
    };
    const map = oficinaReferenciadaLivreEscolhaPorSeguradora(claims, overrides, "Oficina Central");
    expect(map["Porto Seguro"]).toEqual({ referenciada: 1, livreEscolha: 1, semVinculo: 0 });
    expect(map["Tokio Marine"]).toEqual({ referenciada: 0, livreEscolha: 0, semVinculo: 1 });
  });
});

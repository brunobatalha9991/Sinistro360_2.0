import { describe, it, expect } from "vitest";
import {
  clienteIdFromNome, listaClientes, clienteNomeFromId, clienteClaims,
  clienteComsCliente, clienteAvaliacaoMedia, clienteAgentesProdutores,
} from "./clientes";

describe("clienteIdFromNome", () => {
  it("remove acentos, maiusculiza e troca separadores por _", () => {
    expect(clienteIdFromNome("João da Silva Ltda.")).toBe("JOAO_DA_SILVA_LTDA");
  });
  it("nome vazio vira SEM_NOME", () => {
    expect(clienteIdFromNome("")).toBe("SEM_NOME");
  });
});

const claims = [
  { id: "c1", segurado: "Carlos Andrade" },
  { id: "c2", segurado: "Carlos Andrade" },
  { id: "c3", segurado: "Patrícia Gomes" },
];

describe("listaClientes + clienteNomeFromId", () => {
  it("lista clientes distintos ordenados por nome", () => {
    expect(listaClientes(claims, {})).toEqual([
      { id: clienteIdFromNome("Carlos Andrade"), nome: "Carlos Andrade" },
      { id: clienteIdFromNome("Patrícia Gomes"), nome: "Patrícia Gomes" },
    ]);
  });
  it("acha o nome a partir do id", () => {
    expect(clienteNomeFromId(claims, {}, clienteIdFromNome("Carlos Andrade"))).toBe("Carlos Andrade");
  });
});

describe("clienteClaims", () => {
  it("filtra pelo nome exato", () => {
    expect(clienteClaims(claims, {}, "Carlos Andrade").map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});

describe("clienteComsCliente + clienteAvaliacaoMedia", () => {
  const overrides = {
    c1: { comms: [{ canal: "Cliente", avaliacao: 5 }, { canal: "Oficina", avaliacao: 1 }] },
    c2: { comms: [{ canal: "Cliente", avaliacao: 3 }] },
  };
  it("só pega comentários canal Cliente", () => {
    expect(clienteComsCliente(claims, overrides, "Carlos Andrade")).toHaveLength(2);
  });
  it("calcula a média corretamente", () => {
    const coms = clienteComsCliente(claims, overrides, "Carlos Andrade");
    expect(clienteAvaliacaoMedia(coms)).toBe(4); // (5+3)/2
  });
});

describe("clienteAgentesProdutores", () => {
  it("resume agentes/produtores já cacheados nos sinistros do cliente", () => {
    const overrides = {
      c1: { agenteProdutor: { agentes: ["Agente A"], produtores: ["Produtor X"] } },
      c2: { agenteProdutor: { agentes: ["Agente B"], produtores: ["Produtor X"] } },
    };
    expect(clienteAgentesProdutores(claims, overrides, "Carlos Andrade")).toEqual({
      agentes: ["Agente A", "Agente B"],
      produtores: ["Produtor X"],
    });
  });
  it("sem cache ainda, retorna listas vazias", () => {
    expect(clienteAgentesProdutores(claims, {}, "Carlos Andrade")).toEqual({ agentes: [], produtores: [] });
  });
});

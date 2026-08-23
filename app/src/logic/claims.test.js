import { describe, it, expect } from "vitest";
import {
  usuarioTemVinculoRestrito, claimVisivelParaUsuario, visibleClaims,
  distinctAgentes, distinctProdutores, getAgentesEfetivo,
} from "./claims";

const overrides = {
  c1: { agenteProdutor: { agentes: ["AGENTE A"], produtores: ["PRODUTOR X"] } },
  c2: { agenteProdutor: { agentes: ["AGENTE B"], produtores: ["PRODUTOR Y"] } },
  // c3 sem agenteProdutor (nunca buscado)
};
const claims = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];

describe("usuarioTemVinculoRestrito", () => {
  it("admin nunca é restrito", () => {
    expect(usuarioTemVinculoRestrito({ role: "admin", agentesVinculados: ["X"] })).toBe(false);
  });
  it("consulta sem vínculo não é restrito", () => {
    expect(usuarioTemVinculoRestrito({ role: "consulta" })).toBe(false);
    expect(usuarioTemVinculoRestrito({ role: "consulta", agentesVinculados: [], produtoresVinculados: [] })).toBe(false);
  });
  it("consulta com agente ou produtor vinculado é restrito", () => {
    expect(usuarioTemVinculoRestrito({ role: "consulta", agentesVinculados: ["AGENTE A"] })).toBe(true);
    expect(usuarioTemVinculoRestrito({ role: "consulta", produtoresVinculados: ["PRODUTOR X"] })).toBe(true);
  });
});

describe("claimVisivelParaUsuario", () => {
  it("sem restrição, tudo é visível", () => {
    expect(claimVisivelParaUsuario(overrides, { id: "c3" }, { role: "consulta" })).toBe(true);
    expect(claimVisivelParaUsuario(overrides, { id: "c1" }, { role: "admin" })).toBe(true);
  });
  it("consulta restrito só vê processo do agente vinculado", () => {
    const u = { role: "consulta", agentesVinculados: ["AGENTE A"] };
    expect(claimVisivelParaUsuario(overrides, { id: "c1" }, u)).toBe(true);
    expect(claimVisivelParaUsuario(overrides, { id: "c2" }, u)).toBe(false);
  });
  it("consulta restrito só vê processo do produtor vinculado", () => {
    const u = { role: "consulta", produtoresVinculados: ["PRODUTOR Y"] };
    expect(claimVisivelParaUsuario(overrides, { id: "c2" }, u)).toBe(true);
    expect(claimVisivelParaUsuario(overrides, { id: "c1" }, u)).toBe(false);
  });
  it("consulta restrito não vê processo sem agenteProdutor buscado ainda", () => {
    const u = { role: "consulta", agentesVinculados: ["AGENTE A"] };
    expect(claimVisivelParaUsuario(overrides, { id: "c3" }, u)).toBe(false);
  });
});

describe("visibleClaims", () => {
  it("sem currentUser, retrocompatível (não filtra por vínculo)", () => {
    expect(visibleClaims(claims).map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });
  it("com consulta restrito, filtra pelos processos vinculados", () => {
    const u = { role: "consulta", agentesVinculados: ["AGENTE B"] };
    expect(visibleClaims(claims, overrides, u).map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("distinctAgentes / distinctProdutores", () => {
  it("lista agentes/produtores distintos vistos nos processos", () => {
    expect(distinctAgentes(overrides, claims)).toEqual(["AGENTE A", "AGENTE B"]);
    expect(distinctProdutores(overrides, claims)).toEqual(["PRODUTOR X", "PRODUTOR Y"]);
  });
});

describe("getAgentesEfetivo", () => {
  it("une catálogo manual com agentes descobertos, sem duplicar", () => {
    const config = { corp_agentes_catalogo: ["AGENTE A", "AGENTE MANUAL"] };
    expect(getAgentesEfetivo(config, overrides, claims)).toEqual(["AGENTE A", "AGENTE B", "AGENTE MANUAL"]);
  });
});

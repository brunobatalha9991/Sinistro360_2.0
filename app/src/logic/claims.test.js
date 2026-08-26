import { describe, it, expect } from "vitest";
import {
  usuarioTemVinculoRestrito, claimVisivelParaUsuario, visibleClaims,
  distinctAgentes, distinctProdutores, getAgentesEfetivo,
  grupoProdutor, distinctGruposProdutores, emailAlertaDispensado,
  getPesquisaSatisfacao, pesquisaSatisfacaoCompleta,
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
  it("consulta restrito só vê processo do grupo de produtores vinculado", () => {
    const ovr = { c5: { agenteProdutor: { agentes: ["AGENTE C"], produtores: ["LORENA / DANIELA DE SÁ - GRAND ROSA"] } } };
    const u = { role: "consulta", gruposProdutoresVinculados: ["LORENA / DANIELA DE SÁ"] };
    expect(claimVisivelParaUsuario(ovr, { id: "c5" }, u)).toBe(true);
    expect(claimVisivelParaUsuario(overrides, { id: "c1" }, u)).toBe(false);
  });
  // Bug relatado 2026-08-26: c1 e c2 são do mesmo agente ("AGENTE A"), mas
  // com produtores diferentes ("PRODUTOR X" e "PRODUTOR Z"). Um usuário com
  // Agente E Produtor marcados ao mesmo tempo só pode ver o processo do
  // produtor específico — o Agente marcado junto não pode "vazar" acesso
  // aos demais produtores do mesmo agente.
  it("agente E produtor marcados juntos: produtor restringe, agente não amplia", () => {
    const ovr = {
      c1: { agenteProdutor: { agentes: ["AGENTE A"], produtores: ["PRODUTOR X"] } },
      c2: { agenteProdutor: { agentes: ["AGENTE A"], produtores: ["PRODUTOR Z"] } },
    };
    const u = { role: "consulta", agentesVinculados: ["AGENTE A"], produtoresVinculados: ["PRODUTOR X"] };
    expect(claimVisivelParaUsuario(ovr, { id: "c1" }, u)).toBe(true);
    expect(claimVisivelParaUsuario(ovr, { id: "c2" }, u)).toBe(false);
  });
  it("agente E grupo marcados juntos: grupo restringe, agente não amplia", () => {
    const ovr = {
      c1: { agenteProdutor: { agentes: ["AGENTE C"], produtores: ["LORENA / DANIELA DE SÁ - GRAND ROSA"] } },
      c2: { agenteProdutor: { agentes: ["AGENTE C"], produtores: ["OUTRO PRODUTOR - BATALHA"] } },
    };
    const u = { role: "consulta", agentesVinculados: ["AGENTE C"], gruposProdutoresVinculados: ["LORENA / DANIELA DE SÁ"] };
    expect(claimVisivelParaUsuario(ovr, { id: "c1" }, u)).toBe(true);
    expect(claimVisivelParaUsuario(ovr, { id: "c2" }, u)).toBe(false);
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

describe("grupoProdutor", () => {
  it("remove o sufixo de unidade (tudo depois do último ' - ')", () => {
    expect(grupoProdutor("LORENA / DANIELA DE SÁ - BATALHA")).toBe("LORENA / DANIELA DE SÁ");
    expect(grupoProdutor("LORENA / DANIELA DE SÁ - GRAND ROSA")).toBe("LORENA / DANIELA DE SÁ");
  });
  it("mantém o nome intacto quando ele mesmo contém a palavra da unidade", () => {
    expect(grupoProdutor("LORENA BATALHA - BATALHA")).toBe("LORENA BATALHA");
    expect(grupoProdutor("LORENA BATALHA - GRAND ROSA")).toBe("LORENA BATALHA");
  });
  it("sem separador, o grupo é o próprio nome", () => {
    expect(grupoProdutor("JESSICA SILVA DOS SANTOS")).toBe("JESSICA SILVA DOS SANTOS");
    expect(grupoProdutor("MAGNO SUED")).toBe("MAGNO SUED");
  });
  it("nome vazio/indefinido não quebra", () => {
    expect(grupoProdutor("")).toBe("");
    expect(grupoProdutor(null)).toBe("");
    expect(grupoProdutor(undefined)).toBe("");
  });
});

describe("distinctGruposProdutores", () => {
  it("agrupa produtores com o mesmo nome base, sem duplicar", () => {
    const ovr = {
      c1: { agenteProdutor: { produtores: ["LORENA / DANIELA DE SÁ - BATALHA"] } },
      c2: { agenteProdutor: { produtores: ["LORENA / DANIELA DE SÁ - GRAND ROSA"] } },
      c3: { agenteProdutor: { produtores: ["MAGNO SUED"] } },
    };
    const cl = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
    expect(distinctGruposProdutores(ovr, cl)).toEqual(["LORENA / DANIELA DE SÁ", "MAGNO SUED"]);
  });
});

describe("emailAlertaDispensado", () => {
  it("falso quando não há nenhum alerta pra esse e-mail", () => {
    expect(emailAlertaDispensado({}, "c1", "gmail:1")).toBe(false);
  });
  it("falso quando o alerta existe mas não foi dispensado", () => {
    const ovr = { c1: { emailAlertas: [{ emailId: "gmail:1", dismissed: false }] } };
    expect(emailAlertaDispensado(ovr, "c1", "gmail:1")).toBe(false);
  });
  it("verdadeiro quando o vínculo foi removido manualmente", () => {
    const ovr = { c1: { emailAlertas: [{ emailId: "gmail:1", dismissed: true }] } };
    expect(emailAlertaDispensado(ovr, "c1", "gmail:1")).toBe(true);
  });
});

describe("getPesquisaSatisfacao + pesquisaSatisfacaoCompleta", () => {
  it("sem pesquisa registrada, retorna null e incompleta", () => {
    expect(getPesquisaSatisfacao({}, "c1")).toBeNull();
    expect(pesquisaSatisfacaoCompleta({}, "c1")).toBe(false);
  });
  it("incompleta enquanto faltar decisão (nota ou não se aplica) em algum dos 3 alvos", () => {
    const ovr = { c1: { pesquisaSatisfacao: { corretora: { nota: 5 }, seguradora: { naoAplica: true } } } };
    expect(pesquisaSatisfacaoCompleta(ovr, "c1")).toBe(false);
  });
  it("completa quando os 3 alvos têm nota > 0 ou não se aplica", () => {
    const ovr = {
      c1: {
        pesquisaSatisfacao: {
          corretora: { nota: 5 }, seguradora: { naoAplica: true }, oficina: { nota: 3 },
        },
      },
    };
    expect(pesquisaSatisfacaoCompleta(ovr, "c1")).toBe(true);
  });
  it("nota zero sem naoAplica não conta como decisão", () => {
    const ovr = { c1: { pesquisaSatisfacao: { corretora: { nota: 0 }, seguradora: { naoAplica: true }, oficina: { nota: 3 } } } };
    expect(pesquisaSatisfacaoCompleta(ovr, "c1")).toBe(false);
  });
});

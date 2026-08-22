import { describe, it, expect } from "vitest";
import { memoriasAtivasParaUsuario, construirMemoria, grupoDoUsuario } from "./memoriaIA";

const USR_ADMIN = { id: "usr_admin", role: "admin" };
const USR_ANALISTA_A = { id: "usr_analista_a", role: "analista" };
const USR_ATENDENTE = { id: "usr_atendente", role: "atendente" };

describe("grupoDoUsuario", () => {
  it("mapeia admin/atendente para gestor e analista/consulta para equipe", () => {
    expect(grupoDoUsuario(USR_ADMIN)).toBe("gestor");
    expect(grupoDoUsuario(USR_ATENDENTE)).toBe("gestor");
    expect(grupoDoUsuario(USR_ANALISTA_A)).toBe("equipe");
    expect(grupoDoUsuario({ role: "consulta" })).toBe("equipe");
  });
});

describe("construirMemoria", () => {
  it("memória pessoal nasce já aprovada (autor = aprovador)", () => {
    const m = construirMemoria({ escopo: "pessoal", conteudo: "prefiro respostas curtas", criadoPorUserId: "usr_analista_a", agoraISO: "2026-08-22T00:00:00.000Z" });
    expect(m.status).toBe("aprovado");
    expect(m.usuarioId).toBe("usr_analista_a");
  });

  it("memória de equipe/organizacional nasce pendente de aprovação — a IA nunca aprova sozinha", () => {
    const m1 = construirMemoria({ escopo: "equipe", conteudo: "regra X", criadoPorUserId: "usr_analista_a", equipeGrupo: "equipe" });
    const m2 = construirMemoria({ escopo: "organizacional", conteudo: "política Y", criadoPorUserId: "usr_admin" });
    expect(m1.status).toBe("pendente_aprovacao");
    expect(m1.aprovadoPor).toBeNull();
    expect(m2.status).toBe("pendente_aprovacao");
  });
});

describe("memoriasAtivasParaUsuario", () => {
  const memorias = [
    { id: "m1", escopo: "pessoal", usuarioId: "usr_analista_a", status: "aprovado" },
    { id: "m2", escopo: "pessoal", usuarioId: "usr_analista_b", status: "aprovado" },
    { id: "m3", escopo: "equipe", equipeGrupo: "equipe", status: "aprovado" },
    { id: "m4", escopo: "equipe", equipeGrupo: "gestor", status: "aprovado" },
    { id: "m5", escopo: "organizacional", status: "aprovado" },
    { id: "m6", escopo: "organizacional", status: "pendente_aprovacao" },
    { id: "m7", escopo: "organizacional", status: "aprovado", dataExpiracao: "2026-01-01T00:00:00.000Z" },
  ];

  it("memória pessoal só aparece pro próprio dono", () => {
    const ativas = memoriasAtivasParaUsuario(memorias, USR_ANALISTA_A, "2026-08-22T00:00:00.000Z");
    const ids = ativas.map((m) => m.id);
    expect(ids).toContain("m1");
    expect(ids).not.toContain("m2");
  });

  it("memória de equipe só aparece pro grupo correspondente (role mapeado)", () => {
    const ativasEquipe = memoriasAtivasParaUsuario(memorias, USR_ANALISTA_A, "2026-08-22T00:00:00.000Z").map((m) => m.id);
    const ativasGestor = memoriasAtivasParaUsuario(memorias, USR_ADMIN, "2026-08-22T00:00:00.000Z").map((m) => m.id);
    expect(ativasEquipe).toContain("m3");
    expect(ativasEquipe).not.toContain("m4");
    expect(ativasGestor).toContain("m4");
    expect(ativasGestor).not.toContain("m3");
  });

  it("memória organizacional aparece pra todos, mas não se pendente ou expirada", () => {
    const ativas = memoriasAtivasParaUsuario(memorias, USR_ANALISTA_A, "2026-08-22T00:00:00.000Z").map((m) => m.id);
    expect(ativas).toContain("m5");
    expect(ativas).not.toContain("m6"); // pendente
    expect(ativas).not.toContain("m7"); // expirada
  });
});

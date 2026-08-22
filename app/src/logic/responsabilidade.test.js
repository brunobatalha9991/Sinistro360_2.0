import { describe, it, expect } from "vitest";
import {
  alterarResponsavel, responsavelVigenteEm, existeSobreposicao,
  getHistoricoDoProcesso, estimarHistoricoLegado,
} from "./responsabilidade";

const CLAIM_ID = "clm_teste_1";

describe("alterarResponsavel", () => {
  it("abre o primeiro intervalo quando não havia responsável", () => {
    const next = alterarResponsavel([], {
      claimId: CLAIM_ID, novoUsuarioId: "usr_a", agoraISO: "2026-08-01T10:00:00.000Z",
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      claimId: CLAIM_ID, usuarioResponsavelId: "usr_a",
      inicioResponsabilidadeEm: "2026-08-01T10:00:00.000Z", fimResponsabilidadeEm: null,
    });
  });

  it("ao transferir, encerra o intervalo anterior no horário efetivo e abre um novo para o novo responsável", () => {
    const t1 = alterarResponsavel([], { claimId: CLAIM_ID, novoUsuarioId: "usr_a", agoraISO: "2026-08-01T10:00:00.000Z" });
    const t2 = alterarResponsavel(t1, { claimId: CLAIM_ID, novoUsuarioId: "usr_b", agoraISO: "2026-08-05T14:30:00.000Z" });

    expect(t2).toHaveLength(2);
    const antigo = t2.find((h) => h.usuarioResponsavelId === "usr_a");
    const novo = t2.find((h) => h.usuarioResponsavelId === "usr_b");
    expect(antigo.fimResponsabilidadeEm).toBe("2026-08-05T14:30:00.000Z");
    expect(novo.inicioResponsabilidadeEm).toBe("2026-08-05T14:30:00.000Z");
    expect(novo.fimResponsabilidadeEm).toBeNull();
  });

  it("não existem intervalos sobrepostos após múltiplas transferências", () => {
    let historico = [];
    historico = alterarResponsavel(historico, { claimId: CLAIM_ID, novoUsuarioId: "usr_a", agoraISO: "2026-08-01T09:00:00.000Z" });
    historico = alterarResponsavel(historico, { claimId: CLAIM_ID, novoUsuarioId: "usr_b", agoraISO: "2026-08-02T09:00:00.000Z" });
    historico = alterarResponsavel(historico, { claimId: CLAIM_ID, novoUsuarioId: "usr_a", agoraISO: "2026-08-03T09:00:00.000Z" });
    historico = alterarResponsavel(historico, { claimId: CLAIM_ID, novoUsuarioId: null, agoraISO: "2026-08-04T09:00:00.000Z" });

    expect(existeSobreposicao(historico)).toBe(false);
    expect(historico.filter((h) => h.fimResponsabilidadeEm === null)).toHaveLength(0); // último = "sem responsável", não abre intervalo
  });

  it("histórico antigo nunca é apagado — só cresce", () => {
    let historico = [];
    historico = alterarResponsavel(historico, { claimId: CLAIM_ID, novoUsuarioId: "usr_a", agoraISO: "2026-08-01T09:00:00.000Z" });
    const tamanhoAntes = historico.length;
    historico = alterarResponsavel(historico, { claimId: CLAIM_ID, novoUsuarioId: "usr_b", agoraISO: "2026-08-02T09:00:00.000Z" });
    expect(historico.length).toBeGreaterThan(tamanhoAntes);
    expect(historico.some((h) => h.usuarioResponsavelId === "usr_a")).toBe(true);
  });

  it("é idempotente: definir o mesmo responsável já vigente não cria entrada nova", () => {
    const t1 = alterarResponsavel([], { claimId: CLAIM_ID, novoUsuarioId: "usr_a", agoraISO: "2026-08-01T09:00:00.000Z" });
    const t2 = alterarResponsavel(t1, { claimId: CLAIM_ID, novoUsuarioId: "usr_a", agoraISO: "2026-08-01T10:00:00.000Z" });
    expect(t2).toBe(t1); // mesma referência — nenhuma gravação desnecessária
  });

  it("processo recebido antes da responsabilidade de um usuário não é atribuído a ele", () => {
    // usr_a assume só a partir de 05/08 — um evento ocorrido em 03/08 não pode
    // ser resolvido como "responsabilidade de usr_a" via responsavelVigenteEm.
    const historico = alterarResponsavel([], { claimId: CLAIM_ID, novoUsuarioId: "usr_a", agoraISO: "2026-08-05T00:00:00.000Z" });
    const vigenteAntes = responsavelVigenteEm(historico, CLAIM_ID, "2026-08-03T00:00:00.000Z");
    expect(vigenteAntes).toBeNull();
  });
});

describe("responsavelVigenteEm", () => {
  it("resolve o responsável correto dentro do intervalo e null fora dele", () => {
    let historico = [];
    historico = alterarResponsavel(historico, { claimId: CLAIM_ID, novoUsuarioId: "usr_a", agoraISO: "2026-08-01T00:00:00.000Z" });
    historico = alterarResponsavel(historico, { claimId: CLAIM_ID, novoUsuarioId: "usr_b", agoraISO: "2026-08-10T00:00:00.000Z" });

    expect(responsavelVigenteEm(historico, CLAIM_ID, "2026-08-05T00:00:00.000Z").usuarioResponsavelId).toBe("usr_a");
    expect(responsavelVigenteEm(historico, CLAIM_ID, "2026-08-15T00:00:00.000Z").usuarioResponsavelId).toBe("usr_b");
    expect(responsavelVigenteEm(historico, "clm_outro", "2026-08-05T00:00:00.000Z")).toBeNull();
  });
});

describe("getHistoricoDoProcesso", () => {
  it("filtra só o processo pedido e ordena por início", () => {
    const historico = [
      { id: "1", claimId: "outro", inicioResponsabilidadeEm: "2026-08-01T00:00:00.000Z" },
      { id: "2", claimId: CLAIM_ID, inicioResponsabilidadeEm: "2026-08-05T00:00:00.000Z" },
      { id: "3", claimId: CLAIM_ID, inicioResponsabilidadeEm: "2026-08-01T00:00:00.000Z" },
    ];
    const filtrado = getHistoricoDoProcesso(historico, CLAIM_ID);
    expect(filtrado.map((h) => h.id)).toEqual(["3", "2"]);
  });
});

describe("estimarHistoricoLegado", () => {
  const claim = { id: CLAIM_ID };
  const users = [{ id: "usr_a", nome: "Marina Costa" }, { id: "usr_b", nome: "João Pereira" }];

  it("reconstrói intervalos a partir do audit log e marca como estimado_legado", () => {
    const overrides = {
      [CLAIM_ID]: {
        responsavelUser: { id: "usr_b", nome: "João Pereira" },
        audit: [
          { at: "2026-08-01T10:00:00.000Z", acao: "Responsável definido", detalhe: "Marina Costa" },
          { at: "2026-08-10T10:00:00.000Z", acao: "Responsável definido", detalhe: "João Pereira" },
        ],
      },
    };
    const estimado = estimarHistoricoLegado(claim, overrides, users, "2026-08-22T00:00:00.000Z");

    expect(estimado.every((h) => h.origemAlteracao === "estimado_legado")).toBe(true);
    expect(estimado[0]).toMatchObject({ usuarioResponsavelId: "usr_a", inicioResponsabilidadeEm: "2026-08-01T10:00:00.000Z", fimResponsabilidadeEm: "2026-08-10T10:00:00.000Z" });
    expect(estimado[1]).toMatchObject({ usuarioResponsavelId: "usr_b", inicioResponsabilidadeEm: "2026-08-10T10:00:00.000Z", fimResponsabilidadeEm: null });
    expect(existeSobreposicao(estimado)).toBe(false);
  });

  it("sem nenhuma auditoria, mas com responsável atual, gera 1 intervalo sinalizado como impreciso", () => {
    const overrides = { [CLAIM_ID]: { responsavelUser: { id: "usr_a", nome: "Marina Costa" }, audit: [] } };
    const estimado = estimarHistoricoLegado(claim, overrides, users, "2026-08-22T00:00:00.000Z");
    expect(estimado).toHaveLength(1);
    expect(estimado[0].origemAlteracao).toBe("estimado_legado");
    expect(estimado[0].motivoAlteracao).toMatch(/sem data de início confiável/);
  });

  it("sem auditoria e sem responsável atual, não inventa nada", () => {
    const overrides = { [CLAIM_ID]: { audit: [] } };
    const estimado = estimarHistoricoLegado(claim, overrides, users, "2026-08-22T00:00:00.000Z");
    expect(estimado).toHaveLength(0);
  });
});

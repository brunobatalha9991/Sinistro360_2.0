import { describe, it, expect } from "vitest";
import { indiceProcessos, entregaDoDia, entregaNoPeriodo, progressoExpediente } from "./desempenhoEntrega";
import { atividadesDoUsuario } from "./desempenhoAtividades";

// Dia 29/10/2026 (quinta), visto às 20h — expediente já encerrado.
const DIA = "2026-10-29";
const agora = new Date(2026, 9, 29, 20, 0);
const hojeAs = (h) => new Date(2026, 9, 29, h, 0).toISOString();
const diasAtras = (n) => new Date(2026, 9, 29 - n, 10, 0).toISOString();
const u = { id: "usr_u", nome: "Usuária U" };
const desde = { inicioResponsabilidadeEm: "2026-10-01T00:00:00.000Z", fimResponsabilidadeEm: null };
const claims = ["c1", "c2", "c3", "c4", "c5", "c6"].map((id) => ({ id, segurado: "Seg " + id, numsin: "N" + id, situacao: "Em andamento" }));
const historico = [
  ...["c1", "c2", "c3", "c4", "c5"].map((claimId) => ({ claimId, usuarioResponsavelId: "usr_u", ...desde })),
  { claimId: "c6", usuarioResponsavelId: "usr_x", ...desde },
];
const comm = (at, who, whoId, extra = {}) => ({ at, date: at.slice(0, 10), who, whoId, canal: "Cliente", text: "contato", ...extra });
const overrides = {
  // Próxima ação venceu ontem; registrou histórico hoje → feito.
  c1: {
    comms: [comm(diasAtras(1), "Usuária U", "usr_u"), comm(hojeAs(10), "Usuária U", "usr_u")],
    audit: [{ at: diasAtras(2), who: "Usuária U", whoId: "usr_u", acao: "Próxima ação definida", detalhe: "Ligar — prazo 28/10/2026" }],
  },
  // Sem atualização há 5 dias; só mexeu na jornada → parcial.
  c2: {
    comms: [comm(diasAtras(5), "Usuária U", "usr_u")],
    audit: [{ at: hojeAs(11), who: "Usuária U", whoId: "usr_u", acao: "Jornada: status alterado", detalhe: "Vistoria: Agendada" }],
  },
  // Sem atualização; outro usuário registrou hoje → fora da conta.
  c3: { comms: [comm(diasAtras(6), "Usuária U", "usr_u"), comm(hojeAs(9), "Outro", "usr_x")] },
  // Em dia: histórico ontem e próxima ação futura → não entra.
  c4: {
    comms: [comm(diasAtras(1), "Usuária U", "usr_u")],
    audit: [{ at: diasAtras(1), who: "Usuária U", whoId: "usr_u", acao: "Próxima ação definida", detalhe: "Cobrar — prazo 05/11/2026" }],
  },
  // Sem atualização e nada feito → pendente.
  c5: { comms: [comm(diasAtras(8), "Usuária U", "usr_u")] },
  // Carteira de outro: atuou hoje → conta na produção, não na demanda.
  c6: { comms: [comm(hojeAs(15), "Usuária U", "usr_u")] },
};

describe("entrega do dia", () => {
  const indice = indiceProcessos({ claims, overrides, historico, templates: {}, atendTemplateCfg: null });

  it("reconstrói a demanda do início do dia e classifica o que foi feito", () => {
    const d = entregaDoDia({ indice, usuario: u, data: DIA, agora });
    const st = Object.fromEntries(d.itens.map((i) => [i.claimId, i.status]));
    expect(st).toEqual({ c1: "feito", c2: "parcial", c3: "outro", c5: "pendente" });
    expect(d.carteira).toBe(5);
    expect(d.devidos).toBe(3); // c3 sai (tratado por outro)
    expect(d.pesoFeito).toBe(1.5); // 1 + ½
    expect(d.atuados).toBe(3); // c1, c2, c6
    expect(d.meta).toBe(10); // carteira ÷ 3 < mínimo
    expect(d.itens.find((i) => i.claimId === "c1").motivos[0].tipo).toBe("proxima_acao");
    expect(d.itens.find((i) => i.claimId === "c5").motivos[0].texto).toBe("Sem atualização há 8 dia(s)");
  });

  it("no período: taxa de entrega e produção", () => {
    const p = entregaNoPeriodo({ indice, usuario: u, deISO: DIA, ateISO: DIA, agora });
    expect(p.taxaEntrega).toBe(0.5);
    expect(p.taxaProducao).toBeCloseTo(0.3);
  });

  it("hoje é cobrado em proporção ao expediente passado", () => {
    expect(progressoExpediente(DIA, new Date(2026, 9, 29, 13, 15))).toBeCloseTo(0.5);
    const meioDia = entregaDoDia({ indice, usuario: u, data: DIA, agora: new Date(2026, 9, 29, 13, 15) });
    expect(meioDia.esperado).toBeCloseTo(1.5);
  });

  it("'Dentro do prazo' renovado tira o processo da demanda de sem atualização", () => {
    const ov = { ...overrides, c5: { ...overrides.c5, audit: [{ at: diasAtras(1), who: "Usuária U", acao: "Prazo do histórico renovado" }] } };
    const d = entregaDoDia({ indice: indiceProcessos({ claims, overrides: ov, historico, templates: {}, atendTemplateCfg: null }), usuario: u, data: DIA, agora });
    expect(d.itens.some((i) => i.claimId === "c5")).toBe(false);
  });
});

describe("atividades do usuário", () => {
  it("lista histórico, jornada, CI e agenda com vínculo", () => {
    const tasks = [{
      id: "t1", ci: "CI-7", titulo: "Vistoria", origem: "usr_x", destinatarios: ["usr_u"], createdAt: diasAtras(1),
      comments: [{ userId: "usr_u", text: "Já agendei", at: hojeAs(12) }],
      ciente: { usr_u: hojeAs(11) },
      log: [{ at: hojeAs(12), who: "usr_u", acao: "Usuária U comentou: Já agendei" }, { at: hojeAs(16), who: "usr_u", acao: 'Usuária U alterou o status para "Concluído"' }],
    }];
    const fb = [{ id: "f1", userId: "usr_u", autorId: "usr_u", tipo: "fim", texto: "feito", at: hojeAs(17), titulo: "Checar e-mails", previstoInicio: "16:30", previstoFim: "17:00" }];
    const a = atividadesDoUsuario({ claims, overrides, tasks, feedbacksAgenda: fb, usuario: u, deISO: DIA, ateISO: DIA });
    const grupos = a.reduce((s, x) => ({ ...s, [x.grupo]: (s[x.grupo] || 0) + 1 }), {});
    expect(grupos).toEqual({ historico: 2, jornada: 1, ci: 3, agenda: 1 });
    expect(a.find((x) => x.grupo === "ci" && x.titulo === "Comentou na CI").rota).toEqual(["tarefas", "open-t1"]);
    expect(a.find((x) => x.grupo === "historico").rota[0]).toBe("sinistro");
    expect(a[0].at >= a[a.length - 1].at).toBe(true);
  });
});

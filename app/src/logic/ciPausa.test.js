import { describe, it, expect } from "vitest";
import { pausaAtual, processarPausasCI, redirecionamentosPendentesCiente, tipoPausaDaOcorrencia } from "./ciPausa";
import { AUTOR_SISTEMA } from "./ciAutomacao";

const users = [
  { id: "adm", nome: "Administrador", role: "admin" },
  { id: "luiz", nome: "Luiz", role: "atendente" },
  { id: "ana", nome: "Ana", role: "analista" },
  { id: "bru", nome: "Bruno", role: "atendente", vip: true },
  { id: "cli", nome: "Cliente", role: "consulta" },
];
const D = "2026-10-28";
const h = (hh, mm) => new Date(2026, 9, 28, hh, mm);
const almocoLuiz = { id: "b1", userId: "luiz", titulo: "Almoço", presetId: "ap_almoco", tipo: "acao", pausa: true, inicio: "12:00", fim: "13:00", data: D, recorrencia: { tipo: "nenhuma" } };
const ci = (extra) => ({ id: "t1", ci: "CI-1", titulo: "Guincho", tipo: "Mesa de Atendimento", tipoAtendimento: "assistencia_24h", origem: "ana", destinatarios: ["luiz"], status: "Pendente", createdAt: h(11, 0).toISOString(), comments: [], log: [], ...extra });
const fb = (tipo, at) => ({ id: tipo + at.getTime(), userId: "luiz", blocoId: "b1", data: D, tipo, at: at.toISOString() });

describe("pausa da agenda (real com reserva)", () => {
  const luiz = users[1];
  it("identifica almoço e café pelo preset ou pelo nome", () => {
    expect(tipoPausaDaOcorrencia({ presetId: "ap_cafe" })).toBe("cafe");
    expect(tipoPausaDaOcorrencia({ titulo: "Horário de almoço" })).toBe("almoco");
    expect(tipoPausaDaOcorrencia({ titulo: "Abrir processos" })).toBeNull();
  });
  it("sem registro segue o horário planejado", () => {
    expect(pausaAtual([almocoLuiz], [], luiz, h(11, 59))).toBeNull();
    expect(pausaAtual([almocoLuiz], [], luiz, h(12, 10)).tipo).toBe("almoco");
    expect(pausaAtual([almocoLuiz], [], luiz, h(13, 0))).toBeNull();
  });
  it("início registrado antes vale; fim registrado encerra; esquecido encerra 30 min após o previsto", () => {
    expect(pausaAtual([almocoLuiz], [fb("inicio", h(11, 50))], luiz, h(11, 55)).tipo).toBe("almoco");
    expect(pausaAtual([almocoLuiz], [fb("inicio", h(12, 0)), fb("fim", h(12, 40))], luiz, h(12, 45))).toBeNull();
    expect(pausaAtual([almocoLuiz], [fb("inicio", h(12, 0))], luiz, h(13, 20)).tipo).toBe("almoco");
    expect(pausaAtual([almocoLuiz], [fb("inicio", h(12, 0))], luiz, h(13, 31))).toBeNull();
  });
});

describe("redirecionamento de CI emergencial", () => {
  it("redireciona a todos os operadores, comenta, pede ciente e devolve no fim", () => {
    let r = processarPausasCI([ci()], users, [almocoLuiz], [], h(12, 5));
    expect(r.eventos[0].tipo).toBe("redirecionada");
    let t = r.tasks[0];
    expect(t.destinatarios.sort()).toEqual(["ana", "bru", "luiz"]); // sem Administrador e sem Consulta
    expect(t.redirecionamentoPausa.alvosCiente.sort()).toEqual(["ana", "bru"]); // quem está no almoço não
    expect(t.comments[0].userId).toBe(AUTOR_SISTEMA);
    expect(t.comments[0].text).toContain("horário de almoço de Luiz");
    expect(redirecionamentosPendentesCiente([t], "bru")).toHaveLength(1);
    // Idempotente durante a pausa.
    expect(processarPausasCI([t], users, [almocoLuiz], [], h(12, 30)).tasks[0]).toBe(t);
    // Fim do almoço: volta pro Luiz, com comentário.
    r = processarPausasCI([t], users, [almocoLuiz], [], h(13, 1));
    expect(r.eventos[0].tipo).toBe("devolvida");
    t = r.tasks[0];
    expect(t.destinatarios).toEqual(["luiz"]);
    expect(t.redirecionamentoPausa.ativo).toBe(false);
    expect(t.comments.at(-1).text).toContain("encerramento do horário de almoço de Luiz");
    expect(redirecionamentosPendentesCiente([t], "bru")).toHaveLength(0);
  });
  it("só vale para Assistência 24h e Carro Reserva em aberto", () => {
    expect(processarPausasCI([ci({ tipoAtendimento: "sinistro" })], users, [almocoLuiz], [], h(12, 5)).eventos).toHaveLength(0);
    expect(processarPausasCI([ci({ status: "Concluído" })], users, [almocoLuiz], [], h(12, 5)).eventos).toHaveLength(0);
    expect(processarPausasCI([ci({ tipoAtendimento: "carro_reserva" })], users, [almocoLuiz], [], h(12, 5)).eventos).toHaveLength(1);
  });
  it("destinatário incluído à mão durante a pausa continua depois da devolução", () => {
    const t = processarPausasCI([ci({ destinatarios: ["luiz"] })], users, [almocoLuiz], [], h(12, 5)).tasks[0];
    const comExtra = { ...t, destinatarios: [...t.destinatarios, "novo"] };
    const volta = processarPausasCI([comExtra], users, [almocoLuiz], [], h(13, 5)).tasks[0];
    expect(volta.destinatarios.sort()).toEqual(["luiz", "novo"]);
  });
});

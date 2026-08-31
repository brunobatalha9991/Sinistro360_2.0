import { describe, it, expect } from "vitest";
import { dicaAplicaAoUsuario, dicaNotifId, dicasPendentesHoje } from "./dicasAssistente";

const DICA = { id: "d1", texto: "Verifique o WhatsApp", hora: "09:00", papeis: ["atendente", "analista"], ativo: true };

describe("dicaAplicaAoUsuario", () => {
  it("aplica quando o papel do usuário está na lista e a dica está ativa", () => {
    expect(dicaAplicaAoUsuario(DICA, { id: "u1", role: "atendente" })).toBe(true);
  });
  it("não aplica pra papel fora da lista", () => {
    expect(dicaAplicaAoUsuario(DICA, { id: "u1", role: "consulta" })).toBe(false);
  });
  it("não aplica quando a dica está pausada (ativo: false)", () => {
    expect(dicaAplicaAoUsuario({ ...DICA, ativo: false }, { id: "u1", role: "atendente" })).toBe(false);
  });
  it("sem nenhum papel marcado, não aplica a ninguém", () => {
    expect(dicaAplicaAoUsuario({ ...DICA, papeis: [] }, { id: "u1", role: "atendente" })).toBe(false);
  });
});

describe("dicasPendentesHoje", () => {
  it("dica com horário já passado e sem notif de hoje ainda: pendente", () => {
    const agora = new Date("2026-09-01T09:30:00");
    const pend = dicasPendentesHoje([DICA], [], { id: "u1", role: "atendente" }, agora);
    expect(pend.map((d) => d.id)).toEqual(["d1"]);
  });
  it("dica com horário ainda não chegado: não pendente", () => {
    const agora = new Date("2026-09-01T08:30:00");
    const pend = dicasPendentesHoje([DICA], [], { id: "u1", role: "atendente" }, agora);
    expect(pend).toHaveLength(0);
  });
  it("já entregue hoje (notif com o id determinístico já existe): não repete", () => {
    const agora = new Date("2026-09-01T09:30:00");
    const notifs = [{ id: dicaNotifId("d1", "u1", "2026-09-01") }];
    const pend = dicasPendentesHoje([DICA], notifs, { id: "u1", role: "atendente" }, agora);
    expect(pend).toHaveLength(0);
  });
  it("entregue ONTEM não impede a entrega de hoje (dedupe é por dia)", () => {
    const agora = new Date("2026-09-01T09:30:00");
    const notifs = [{ id: dicaNotifId("d1", "u1", "2026-08-31") }];
    const pend = dicasPendentesHoje([DICA], notifs, { id: "u1", role: "atendente" }, agora);
    expect(pend.map((d) => d.id)).toEqual(["d1"]);
  });
  it("papel diferente do usuário não é entregue", () => {
    const agora = new Date("2026-09-01T09:30:00");
    const pend = dicasPendentesHoje([DICA], [], { id: "u1", role: "consulta" }, agora);
    expect(pend).toHaveLength(0);
  });
  it("sem usuário logado, nunca gera pendência", () => {
    expect(dicasPendentesHoje([DICA], [], null)).toEqual([]);
  });
});

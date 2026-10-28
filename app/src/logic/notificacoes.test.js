import { describe, it, expect } from "vitest";
import { aplicarAlertaCI, resolverAlertasCI, resolverAlertasSuperados, tipoAlertaCI } from "./notificacoes";

let seq = 0;
const novoId = () => "n" + (++seq);
const at = (min) => new Date(Date.UTC(2026, 9, 28, 15, min)).toISOString();
const alerta = (notifs, tipo, min, userIds = ["bru"]) => aplicarAlertaCI(notifs, { taskId: "t1", userIds, tipo, texto: tipo, at: at(min), novoId });

describe("família de alertas de CI parada", () => {
  it("pedido de intervenção aberto bloqueia os alertas menores da mesma CI pra mesma pessoa", () => {
    let r = alerta([], "escalonamento_ci", 0);
    expect(r.enviados).toEqual(["bru"]);
    r = alerta(r.notifs, "sem_interacao", 10);
    expect(r.enviados).toEqual([]);
    r = alerta(r.notifs, "sem_interacao_criador", 20);
    expect(r.enviados).toEqual([]);
    expect(r.notifs).toHaveLength(1);
  });
  it("alerta novo substitui o anterior (fica um só aberto) e não repete em 5 min", () => {
    let r = alerta([], "sem_interacao", 0);
    expect(alerta(r.notifs, "sem_interacao", 3).enviados).toEqual([]);
    r = alerta(r.notifs, "sem_interacao", 10);
    const abertos = r.notifs.filter((n) => !n.tratadaEm);
    expect(abertos).toHaveLength(1);
    expect(r.notifs[0].resolvidaMotivo).toContain("substituída");
    // Pedido de intervenção substitui o alerta comum.
    r = alerta(r.notifs, "escalonamento_ci", 11);
    expect(r.notifs.filter((n) => !n.tratadaEm).map((n) => n.tipo)).toEqual(["escalonamento_ci"]);
  });
  it("pessoas diferentes não se bloqueiam", () => {
    const r = alerta([], "escalonamento_ci", 0, ["bru"]);
    expect(alerta(r.notifs, "sem_interacao", 1, ["bru", "ana"]).enviados).toEqual(["ana"]);
  });
  it("Considerar resolve todos os alertas abertos da CI, de todo mundo", () => {
    let r = alerta([], "escalonamento_ci", 0, ["bru"]);
    r = alerta(r.notifs, "sem_interacao", 1, ["ana"]);
    const outra = { id: "x", taskId: "t2", userId: "bru", tipo: "sem_interacao", at: at(0) };
    const res = resolverAlertasCI([...r.notifs, outra], "t1", at(5), "interação considerada por Bruno até 16:03");
    expect(res.filter((n) => n.taskId === "t1").every((n) => n.tratadaEm && n.read)).toBe(true);
    expect(res.find((n) => n.id === "x").tratadaEm).toBeUndefined();
  });
  it("interação do destinatário ou conclusão resolvem sozinhas", () => {
    const n = { id: "a", taskId: "t1", userId: "bru", tipo: "sem_interacao", at: at(0) };
    const task = { id: "t1", origem: "ana", destinatarios: ["luiz"], status: "Pendente", createdAt: at(-30), comments: [], log: [], ciente: {} };
    expect(resolverAlertasSuperados([n], [task], at(1))[0].tratadaEm).toBeUndefined();
    const interagiu = { ...task, ciente: { luiz: at(2) } };
    expect(resolverAlertasSuperados([n], [interagiu], at(3))[0].resolvidaMotivo).toContain("interagiu");
    expect(resolverAlertasSuperados([n], [{ ...task, status: "Concluído" }], at(3))[0].resolvidaMotivo).toContain("concluída");
    const lista = [n];
    expect(resolverAlertasSuperados(lista, [task], at(1))).toBe(lista);
  });
  it("reconhece o alerta antigo pelo ⏱ no texto", () => {
    expect(tipoAlertaCI({ text: "⏱ CI-1 sem interação" })).toBe("sem_interacao");
    expect(tipoAlertaCI({ tipo: "agenda_feedback" })).toBeNull();
  });
});

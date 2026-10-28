import { describe, it, expect } from "vitest";
import { destinatariosAutomaticos, generalizarPorAusencia, usuariosAusentes, idAcesso, AUSENCIA_CFG_DEFAULT, AUTOR_SISTEMA, verificarSemInteracao, referenciaInteracao, SEM_INTERACAO_CFG_DEFAULT, minutosUteisEntre, interacaoConsideradaAtiva, verificarAlertasCriador, usuarioEscalonamentoId } from "./ciAutomacao";

const users = [
  { id: "adm", nome: "Admin", role: "admin" },
  { id: "luiz", nome: "Luiz", role: "atendente" },
  { id: "ana", nome: "Ana", role: "analista" },
  { id: "cli", nome: "Cliente", role: "consulta" },
];

describe("destinatariosAutomaticos", () => {
  const regras = [
    { id: "r1", tipo: "Mesa de Atendimento", tipoAtendimento: "sinistro", modo: "usuarios", userIds: ["luiz", "sumiu"] },
    { id: "r2", tipo: "Guincho", tipoAtendimento: "", modo: "todos_exceto_consulta", userIds: [] },
    { id: "r3", tipo: "Mesa de Atendimento", tipoAtendimento: "", modo: "usuarios", userIds: ["ana"] },
  ];
  it("aplica a regra do subtipo e a de qualquer subtipo, ignorando usuário que não existe", () => {
    expect(destinatariosAutomaticos(regras, users, "Mesa de Atendimento", "sinistro").sort()).toEqual(["ana", "luiz"]);
    expect(destinatariosAutomaticos(regras, users, "Mesa de Atendimento", "assistencia_24h")).toEqual(["ana"]);
  });
  it("todos exceto consulta", () => {
    expect(destinatariosAutomaticos(regras, users, "Guincho", "").sort()).toEqual(["adm", "ana", "luiz"]);
  });
  it("tipo sem regra não marca ninguém", () => {
    expect(destinatariosAutomaticos(regras, users, "Comunicação", "")).toEqual([]);
  });
});

describe("generalização por ausência", () => {
  const cfg = AUSENCIA_CFG_DEFAULT;
  const qua0931 = new Date(2026, 9, 28, 9, 31);
  const acessos = { [idAcesso("adm", "2026-10-28")]: {}, [idAcesso("ana", "2026-10-28")]: {} };
  const tarefa = (extra) => ({ id: "t1", ci: "CI-000001", titulo: "X", origem: "ana", destinatarios: ["luiz"], status: "Pendente", createdAt: new Date(2026, 9, 28, 8, 0).toISOString(), comments: [], log: [], ...extra });

  it("antes do horário, em fim de semana ou desativada: ninguém ausente", () => {
    expect(usuariosAusentes(users, acessos, new Date(2026, 9, 28, 9, 29), cfg)).toEqual([]);
    expect(usuariosAusentes(users, {}, new Date(2026, 9, 31, 10, 0), cfg)).toEqual([]);
    expect(usuariosAusentes(users, {}, qua0931, { ...cfg, ativo: false })).toEqual([]);
  });
  it("consulta nunca conta como ausente", () => {
    expect(usuariosAusentes(users, acessos, qua0931, cfg).map((u) => u.id)).toEqual(["luiz"]);
  });
  it("administrador não conta como ausente nem entra na generalização", () => {
    const soAna = { [idAcesso("ana", "2026-10-28")]: {} };
    expect(usuariosAusentes(users, soAna, qua0931, cfg).map((u) => u.id)).toEqual(["luiz"]);
    const r = generalizarPorAusencia([tarefa()], users, soAna, qua0931, cfg);
    expect(r.mudancas[0].adicionados).toEqual(["ana"]);
    expect(r.tasks[0].destinatarios).not.toContain("adm");
  });
  it("generaliza a CI de hoje do ausente, com comentário, e não repete", () => {
    const r = generalizarPorAusencia([tarefa()], users, acessos, qua0931, cfg);
    expect(r.mudancas).toHaveLength(1);
    const t = r.tasks[0];
    expect(t.destinatarios.sort()).toEqual(["ana", "luiz"]);
    expect(t.comments[0].userId).toBe(AUTOR_SISTEMA);
    expect(t.comments[0].text).toContain("possível ausência de Luiz");
    expect(generalizarPorAusencia(r.tasks, users, acessos, qua0931, cfg).mudancas).toHaveLength(0);
  });
  it("outro ausente que entrou pela generalização não gera 2º comentário", () => {
    const soAdm = { [idAcesso("adm", "2026-10-28")]: {} };
    const r1 = generalizarPorAusencia([tarefa({ destinatarios: ["luiz"] })], users, soAdm, qua0931, cfg);
    expect(r1.tasks[0].comments).toHaveLength(1);
    expect(generalizarPorAusencia(r1.tasks, users, soAdm, qua0931, cfg).mudancas).toHaveLength(0);
  });
  it("não mexe em CI de outro dia, concluída ou de quem acessou", () => {
    const ontem = tarefa({ createdAt: new Date(2026, 9, 27, 15, 0).toISOString() });
    const concluida = tarefa({ status: "Concluído" });
    const daAna = tarefa({ destinatarios: ["ana"] });
    expect(generalizarPorAusencia([ontem, concluida, daAna], users, acessos, qua0931, cfg).mudancas).toHaveLength(0);
  });
  it("depois que o ausente acessa, novas CIs dele não são generalizadas", () => {
    const comLuiz = { ...acessos, [idAcesso("luiz", "2026-10-28")]: {} };
    expect(generalizarPorAusencia([tarefa()], users, comLuiz, new Date(2026, 9, 28, 11, 0), cfg).mudancas).toHaveLength(0);
  });
});

describe("CI sem interação dos destinatários", () => {
  const cfg = SEM_INTERACAO_CFG_DEFAULT;
  const t = (extra) => ({ id: "t", origem: "adm", destinatarios: ["luiz"], status: "Pendente", urgencia: "Leve", createdAt: "2026-10-28T12:00:00.000Z", comments: [], log: [], ciente: {}, ...extra });
  const em = (min) => new Date(Date.parse("2026-10-28T12:00:00.000Z") + min * 60000);

  it("alerta depois de 10 min (5 se urgente) e só uma vez", () => {
    expect(verificarSemInteracao([t()], em(9), cfg).alertas).toHaveLength(0);
    const r = verificarSemInteracao([t()], em(11), cfg);
    expect(r.alertas).toHaveLength(1);
    expect(verificarSemInteracao(r.tasks, em(30), cfg).alertas).toHaveLength(0);
    expect(verificarSemInteracao([t({ urgencia: "Urgente" })], em(6), cfg).alertas).toHaveLength(1);
  });
  it("interação do destinatário reinicia a contagem; a da origem não", () => {
    const comOrigem = t({ comments: [{ userId: "adm", at: "2026-10-28T12:08:00.000Z" }] });
    expect(referenciaInteracao(comOrigem)).toBe("2026-10-28T12:00:00.000Z");
    const comDest = t({ ciente: { luiz: "2026-10-28T12:08:00.000Z" } });
    expect(verificarSemInteracao([comDest], em(11), cfg).alertas).toHaveLength(0);
    expect(verificarSemInteracao([comDest], em(19), cfg).alertas).toHaveLength(1);
  });
  it("ignora concluída, sem destinatário além da origem e silêncio de mais de 24h", () => {
    expect(verificarSemInteracao([t({ status: "Concluído" })], em(60), cfg).alertas).toHaveLength(0);
    expect(verificarSemInteracao([t({ destinatarios: ["adm"] })], em(60), cfg).alertas).toHaveLength(0);
    expect(verificarSemInteracao([t()], em(5 * 24 * 60), cfg).alertas).toHaveLength(0);
  });
  it("interação considerada segura o alerta até o prazo e depois alerta de novo", () => {
    const r = verificarSemInteracao([t()], em(11), cfg);
    expect(r.alertas[0].ausentes).toEqual(["luiz"]);
    const consid = { ...r.tasks[0], interacaoConsiderada: { ate: em(60).toISOString(), por: "adm" } };
    expect(verificarSemInteracao([consid], em(30), cfg).alertas).toHaveLength(0);
    const depois = verificarSemInteracao([consid], em(61), cfg);
    expect(depois.alertas).toHaveLength(1);
    expect(depois.alertas[0].aposConsiderada).toBe(true);
    expect(verificarSemInteracao(depois.tasks, em(90), cfg).alertas).toHaveLength(0);
    expect(interacaoConsideradaAtiva(consid, em(30))).toBe(true);
    expect(interacaoConsideradaAtiva(consid, em(61))).toBe(false);
  });
  it("alerta o criador a cada intervalo, ignora admin e escalona no 3º alerta", () => {
    const us = [...users, { id: "bru", nome: "Bruno Batalha", role: "atendente" }];
    expect(usuarioEscalonamentoId(cfg, us)).toBe("bru");
    // Destinatário só admin: não alerta o criador.
    expect(verificarAlertasCriador([t({ origem: "ana", destinatarios: ["adm"] })], us, em(60), cfg).alertas).toHaveLength(0);
    let tasks = [t({ origem: "ana", destinatarios: ["luiz", "adm"] })];
    expect(verificarAlertasCriador(tasks, us, em(9), cfg).alertas).toHaveLength(0);
    let r = verificarAlertasCriador(tasks, us, em(10), cfg);
    expect(r.alertas).toHaveLength(1);
    expect(r.alertas[0].ausentes).toEqual(["luiz"]);
    expect(r.alertas[0].escalar).toBe(false);
    tasks = r.tasks;
    expect(verificarAlertasCriador(tasks, us, em(15), cfg).alertas).toHaveLength(0);
    tasks = verificarAlertasCriador(tasks, us, em(20), cfg).tasks;
    r = verificarAlertasCriador(tasks, us, em(30), cfg);
    expect(r.alertas[0].escalar).toBe(true);
    expect(r.alertas[0].adicionado).toBe(true);
    expect(r.tasks[0].destinatarios).toContain("bru");
    expect(r.tasks[0].comments.at(-1).userId).toBe(AUTOR_SISTEMA);
    // "Considerar" até em(90): nada até lá; depois volta a contar do prazo.
    tasks = [{ ...r.tasks[0], interacaoConsiderada: { ate: em(90).toISOString(), por: "bru" } }];
    expect(verificarAlertasCriador(tasks, us, em(85), cfg).alertas).toHaveLength(0);
    expect(verificarAlertasCriador(tasks, us, em(95), cfg).alertas).toHaveLength(0);
    expect(verificarAlertasCriador(tasks, us, em(100), cfg).alertas).toHaveLength(1);
  });
  it("só conta o horário comercial (08:30–18:00, seg–sex)", () => {
    const local = (d, h, m) => new Date(2026, 9, d, h, m);
    // criada quarta 28/10 às 04:00: às 04:09 e 08:35 ainda não estourou; às 08:41 sim
    const madrugada = t({ createdAt: local(28, 4, 0).toISOString() });
    expect(verificarSemInteracao([madrugada], local(28, 4, 9), cfg).alertas).toHaveLength(0);
    expect(verificarSemInteracao([madrugada], local(28, 8, 35), cfg).alertas).toHaveLength(0);
    expect(verificarSemInteracao([madrugada], local(28, 8, 41), cfg).alertas).toHaveLength(1);
    // sexta 30/10 às 17:55 -> estoura segunda 02/11 às 08:35, não no fim de semana
    const sexta = t({ createdAt: local(30, 17, 55).toISOString() });
    expect(verificarSemInteracao([sexta], new Date(2026, 9, 31, 12, 0), cfg).alertas).toHaveLength(0);
    expect(verificarSemInteracao([sexta], new Date(2026, 10, 2, 8, 34), cfg).alertas).toHaveLength(0);
    expect(verificarSemInteracao([sexta], new Date(2026, 10, 2, 8, 36), cfg).alertas).toHaveLength(1);
  });
  it("minutosUteisEntre", () => {
    expect(minutosUteisEntre(new Date(2026, 9, 28, 17, 0), new Date(2026, 9, 29, 9, 0), cfg)).toBe(60 + 30);
    expect(minutosUteisEntre(new Date(2026, 9, 31, 9, 0), new Date(2026, 10, 1, 17, 0), cfg)).toBe(0);
  });
});

describe("convivência com a versão anterior (sem loop de alertas)", () => {
  const cfg = SEM_INTERACAO_CFG_DEFAULT;
  const t = (extra) => ({ id: "t", origem: "adm", destinatarios: ["luiz"], status: "Pendente", urgencia: "Leve", createdAt: "2026-10-28T12:00:00.000Z", comments: [], log: [], ciente: {}, ...extra });
  const em = (min) => new Date(Date.parse("2026-10-28T12:00:00.000Z") + min * 60000);
  // Regra da versão antiga: só alerta se alertaSemInteracao.ref !== ref.
  const versaoAntiga = (task) => {
    const ref = referenciaInteracao(task);
    return task.alertaSemInteracao && task.alertaSemInteracao.ref === ref ? null : { ...task, alertaSemInteracao: { ref, at: "x", minutos: 10 } };
  };
  it("período considerado vencido: nova e antiga não se desmentem", () => {
    let task = t({ interacaoConsiderada: { ate: em(30).toISOString() } });
    let r = verificarSemInteracao([task], em(40), cfg);
    expect(r.alertas).toHaveLength(1);
    task = r.tasks[0];
    expect(versaoAntiga(task)).toBeNull(); // a antiga não regrava
    expect(verificarSemInteracao([task], em(41), cfg).alertas).toHaveLength(0);
    // Se a antiga gravou antes (sem consid), a nova avisa uma vez e estabiliza.
    const gravadaPelaAntiga = versaoAntiga(t({ interacaoConsiderada: { ate: em(30).toISOString() } }));
    r = verificarSemInteracao([gravadaPelaAntiga], em(40), cfg);
    expect(r.alertas).toHaveLength(1);
    expect(versaoAntiga(r.tasks[0])).toBeNull();
    expect(verificarSemInteracao(r.tasks, em(42), cfg).alertas).toHaveLength(0);
  });
});

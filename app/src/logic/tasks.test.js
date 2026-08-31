import { describe, it, expect } from "vitest";
import {
  isTarefaEmergencia, isTarefaArquivada, descreverAlteracoesTarefa,
  tarefasNoEscopo, tarefaTemPapel, compararTarefasAuto, proximoCI,
  proximaOcorrenciaRecorrencia, recorrenciaEncerrada, recorrenciaVencida, gerarOcorrenciaRecorrente, resumoRecorrencia,
} from "./tasks";

function horasAtras(h) { return new Date(Date.now() - h * 60 * 60 * 1000).toISOString(); }

describe("isTarefaEmergencia", () => {
  it("é emergência quando Mesa de Atendimento + Assistência 24h, não concluída", () => {
    expect(isTarefaEmergencia({ tipo: "Mesa de Atendimento", tipoAtendimento: "assistencia_24h", status: "Pendente" })).toBe(true);
  });
  it("não é emergência se já concluída", () => {
    expect(isTarefaEmergencia({ tipo: "Mesa de Atendimento", tipoAtendimento: "assistencia_24h", status: "Concluído" })).toBe(false);
  });
  it("não é emergência para outro tipo de atendimento", () => {
    expect(isTarefaEmergencia({ tipo: "Mesa de Atendimento", tipoAtendimento: "sinistro", status: "Pendente" })).toBe(false);
  });
  it("não é emergência para outro tipo de tarefa", () => {
    expect(isTarefaEmergencia({ tipo: "Comunicação", tipoAtendimento: "assistencia_24h", status: "Pendente" })).toBe(false);
  });
});

describe("isTarefaArquivada", () => {
  it("não arquiva tarefa não concluída", () => {
    expect(isTarefaArquivada({ status: "Pendente", concludedAt: horasAtras(200) })).toBe(false);
  });
  it("não arquiva concluída há menos de 4 dias", () => {
    expect(isTarefaArquivada({ status: "Concluído", concludedAt: horasAtras(24) })).toBe(false);
  });
  it("arquiva concluída há mais de 4 dias (96h)", () => {
    expect(isTarefaArquivada({ status: "Concluído", concludedAt: horasAtras(97) })).toBe(true);
  });
  it("não arquiva concluída sem concludedAt registrado", () => {
    expect(isTarefaArquivada({ status: "Concluído" })).toBe(false);
  });
  it("arquiva manualmente mesmo sem estar concluída", () => {
    expect(isTarefaArquivada({ status: "Pendente", arquivadoManualmente: { motivo: "Duplicada", at: horasAtras(1), userId: "u1" } })).toBe(true);
  });
});

describe("descreverAlteracoesTarefa", () => {
  const base = { tipo: "Tarefa", urgencia: "Leve", status: "Pendente", titulo: "T", descricao: "D", anexo: "", obs: "", tipoAtendimento: "", processo: "", destinatarios: ["u1"] };
  it("sem mudanças retorna lista vazia", () => {
    expect(descreverAlteracoesTarefa(base, { ...base })).toEqual([]);
  });
  it("detecta mudança de status", () => {
    const out = descreverAlteracoesTarefa(base, { ...base, status: "Em andamento" });
    expect(out).toContain('Status alterado de "Pendente" para "Em andamento"');
  });
  it("detecta destinatários adicionados e removidos, resolvendo nomes", () => {
    const users = [{ id: "u1", nome: "Ana" }, { id: "u2", nome: "Bruno" }];
    const out = descreverAlteracoesTarefa(base, { ...base, destinatarios: ["u2"] }, { users });
    expect(out).toContain("Destinatário(s) adicionado(s): Bruno");
    expect(out).toContain("Destinatário(s) removido(s): Ana");
  });
  it("detecta vínculo com processo, resolvendo número do sinistro", () => {
    const claims = [{ id: "c1", numsin: "SIN-1" }];
    const out = descreverAlteracoesTarefa(base, { ...base, processo: "c1" }, { claims });
    expect(out).toContain("Vinculada ao processo SIN-1");
  });
  it("sem versão anterior (tarefa nova) retorna lista vazia", () => {
    expect(descreverAlteracoesTarefa(null, base)).toEqual([]);
  });
  it("detecta sinalizadores marcados e desmarcados", () => {
    const out = descreverAlteracoesTarefa({ ...base, flags: ["Aguard. cliente"] }, { ...base, flags: ["Aguard. corretora"] });
    expect(out).toContain("Sinalizador(es) marcado(s): Aguard. corretora");
    expect(out).toContain("Sinalizador(es) desmarcado(s): Aguard. cliente");
  });
});

describe("tarefasNoEscopo", () => {
  const tasks = [
    { id: "t1", origem: "u1", destinatarios: ["u2"] },
    { id: "t2", origem: "u2", destinatarios: ["u3"] },
  ];
  it("null/undefined devolve todas (modo 'Todos', admin/VIP)", () => {
    expect(tarefasNoEscopo(tasks, null)).toHaveLength(2);
  });
  it("com um id, só as que ele é origem ou destinatário", () => {
    expect(tarefasNoEscopo(tasks, "u2").map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(tarefasNoEscopo(tasks, "u3").map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("tarefaTemPapel", () => {
  const t = { origem: "u1", destinatarios: ["u2", "u3"] };
  it("'ambos' sempre true", () => {
    expect(tarefaTemPapel(t, "u1", "ambos")).toBe(true);
    expect(tarefaTemPapel(t, "u9", "ambos")).toBe(true);
  });
  it("'origem' só bate com quem criou", () => {
    expect(tarefaTemPapel(t, "u1", "origem")).toBe(true);
    expect(tarefaTemPapel(t, "u2", "origem")).toBe(false);
  });
  it("'destinatario' só bate com quem está na lista de destinatários", () => {
    expect(tarefaTemPapel(t, "u2", "destinatario")).toBe(true);
    expect(tarefaTemPapel(t, "u1", "destinatario")).toBe(false);
  });
});

describe("compararTarefasAuto", () => {
  it("emergência sempre primeiro, mesmo sobre Urgente comum", () => {
    const emergencia = { tipo: "Mesa de Atendimento", tipoAtendimento: "assistencia_24h", status: "Pendente", urgencia: "Leve", createdAt: "2026-01-01" };
    const urgenteComum = { tipo: "Tarefa", urgencia: "Urgente", createdAt: "2026-06-01" };
    expect(compararTarefasAuto(emergencia, urgenteComum)).toBeLessThan(0);
  });
  it("depois, por grau de urgência: Urgente > Moderado > Leve", () => {
    const u = { urgencia: "Urgente", createdAt: "2026-01-01" };
    const m = { urgencia: "Moderado", createdAt: "2026-01-01" };
    const l = { urgencia: "Leve", createdAt: "2026-01-01" };
    expect(compararTarefasAuto(u, m)).toBeLessThan(0);
    expect(compararTarefasAuto(m, l)).toBeLessThan(0);
  });
  it("mesma urgência: mais recente primeiro", () => {
    const recente = { urgencia: "Leve", createdAt: "2026-08-20T00:00:00.000Z" };
    const antiga = { urgencia: "Leve", createdAt: "2026-08-01T00:00:00.000Z" };
    expect(compararTarefasAuto(recente, antiga)).toBeLessThan(0);
  });
  // Bug relatado 2026-08-28: uma tarefa Urgente concluída ficava acima de
  // outras ainda pendentes, porque o status nunca entrava no critério de
  // ordenação (só emergência/urgência/data) — concluída agora sempre vai
  // pro final, mesmo sendo Urgente e mais recente.
  it("concluída sempre por último, mesmo sendo Urgente e mais recente", () => {
    const concluidaUrgente = { status: "Concluído", urgencia: "Urgente", createdAt: "2026-08-28T00:00:00.000Z" };
    const pendenteLeve = { status: "Pendente", urgencia: "Leve", createdAt: "2026-08-01T00:00:00.000Z" };
    expect(compararTarefasAuto(concluidaUrgente, pendenteLeve)).toBeGreaterThan(0);
  });
  it("Pendente antes de Em andamento, na mesma urgência", () => {
    const pendente = { status: "Pendente", urgencia: "Leve", createdAt: "2026-08-01T00:00:00.000Z" };
    const emAndamento = { status: "Em andamento", urgencia: "Leve", createdAt: "2026-08-01T00:00:00.000Z" };
    expect(compararTarefasAuto(pendente, emAndamento)).toBeLessThan(0);
  });
});

describe("proximoCI", () => {
  it("sem nenhuma tarefa ainda, começa em CI-000001", () => {
    expect(proximoCI([])).toBe("CI-000001");
  });
  it("continua do maior número já usado", () => {
    expect(proximoCI([{ ci: "CI-000003" }, { ci: "CI-000001" }])).toBe("CI-000004");
  });
  it("ignora tarefas sem protocolo (dados antigos, de antes desta funcionalidade)", () => {
    expect(proximoCI([{ ci: "CI-000002" }, {}])).toBe("CI-000003");
  });
});

describe("recorrência de tarefa", () => {
  const base = { id: "tsk_1", titulo: "Follow-up", createdAt: "2026-08-01T10:00:00.000Z" };

  it("sem recorrência ativa, não tem próxima ocorrência nem vence", () => {
    expect(proximaOcorrenciaRecorrencia(base)).toBeNull();
    expect(recorrenciaVencida(base, "2026-12-01")).toBe(false);
  });

  it("calcula a próxima ocorrência a cada N dias, contando a partir da criação", () => {
    const t = { ...base, recorrencia: { ativa: true, intervalo: 3, unidade: "dias", fim: { tipo: "nunca" }, ocorrenciasGeradas: 0 } };
    expect(proximaOcorrenciaRecorrencia(t)).toBe("2026-08-04");
  });

  it("considera ocorrências já geradas ao calcular a próxima", () => {
    const t = { ...base, recorrencia: { ativa: true, intervalo: 1, unidade: "semanas", fim: { tipo: "nunca" }, ocorrenciasGeradas: 2 } };
    expect(proximaOcorrenciaRecorrencia(t)).toBe("2026-08-22");
  });

  it("vencida quando a data de hoje já passou da próxima ocorrência", () => {
    const t = { ...base, recorrencia: { ativa: true, intervalo: 1, unidade: "dias", fim: { tipo: "nunca" }, ocorrenciasGeradas: 0 } };
    expect(recorrenciaVencida(t, "2026-08-02")).toBe(true);
    expect(recorrenciaVencida(t, "2026-08-01")).toBe(false);
  });

  it("encerra por número de ocorrências atingido", () => {
    const t = { ...base, recorrencia: { ativa: true, intervalo: 1, unidade: "dias", fim: { tipo: "vezes", vezes: 2 }, ocorrenciasGeradas: 2 } };
    expect(recorrenciaEncerrada(t)).toBe(true);
    expect(recorrenciaVencida(t, "2026-12-01")).toBe(false);
  });

  it("encerra quando a próxima ocorrência passaria da data-fim configurada", () => {
    const t = { ...base, recorrencia: { ativa: true, intervalo: 1, unidade: "semanas", fim: { tipo: "data", data: "2026-08-03" }, ocorrenciasGeradas: 0 } };
    expect(recorrenciaEncerrada(t)).toBe(true);
  });

  it("gera uma nova ocorrência limpa, mantendo vínculos e apontando pra tarefa original", () => {
    const original = {
      ...base, status: "Concluído", concludedAt: "2026-08-01T12:00:00.000Z", comments: [{ id: "c1" }],
      log: [{ acao: "x" }], ciente: { u1: "2026-08-01" }, processo: "clm_1", oficinaId: "of_1",
      recorrencia: { ativa: true, intervalo: 1, unidade: "dias", fim: { tipo: "nunca" }, ocorrenciasGeradas: 0 },
    };
    const nova = gerarOcorrenciaRecorrente(original, "2026-08-04T09:00:00.000Z");
    expect(nova.id).not.toBe(original.id);
    expect(nova.status).toBe("Pendente");
    expect(nova.comments).toEqual([]);
    expect(nova.ciente).toEqual({});
    expect(nova.recorrencia).toBeNull();
    expect(nova.origemRecorrenciaId).toBe("tsk_1");
    expect(nova.processo).toBe("clm_1");
    expect(nova.oficinaId).toBe("of_1");
  });

  it("resume a configuração em texto legível", () => {
    expect(resumoRecorrencia({ ativa: true, intervalo: 2, unidade: "semanas", fim: { tipo: "nunca" } })).toBe("Repete a cada 2 semana(s), sem data de término");
    expect(resumoRecorrencia({ ativa: true, intervalo: 1, unidade: "meses", fim: { tipo: "vezes", vezes: 5 } })).toBe("Repete a cada 1 mês(es), por 5 vez(es)");
    expect(resumoRecorrencia(null)).toBe("");
  });

  it("descreve a mudança de recorrência na auditoria da tarefa", () => {
    const antes = { titulo: "T", recorrencia: null };
    const depois = { titulo: "T", recorrencia: { ativa: true, intervalo: 1, unidade: "dias", fim: { tipo: "nunca" } } };
    expect(descreverAlteracoesTarefa(antes, depois, {})).toContain("Recorrência configurada: Repete a cada 1 dia(s), sem data de término");
  });
});

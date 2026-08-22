import { describe, it, expect } from "vitest";
import { isTarefaEmergencia, isTarefaArquivada, descreverAlteracoesTarefa } from "./tasks";

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
});

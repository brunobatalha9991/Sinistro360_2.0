import { describe, it, expect } from "vitest";
import {
  leituraDestinatario, montarLinhasComunicacao, filtrarLinhasComunicacao, FILTRO_COMUNICACAO_PADRAO,
} from "./relatorioComunicacaoInterna";
import { isoToExcelSerialDateTime } from "./xlsxExport";

const users = [{ id: "a", nome: "Ana" }, { id: "b", nome: "Bruno" }, { id: "c", nome: "Carla" }];
const t = {
  id: "t1", ci: "CI-000001", tipo: "Comunicação", status: "Pendente", urgencia: "Urgente",
  origem: "a", destinatarios: ["b", "c"], titulo: "Cobrar oficina", descricao: "x",
  createdAt: "2026-10-10T12:00:00.000Z", updatedAt: "2026-10-12T12:00:00.000Z",
  ciente: { b: "2026-10-13T08:00:00.000Z", c: "2026-10-11T08:00:00.000Z" },
  flags: ["Aguard. cliente"], proximaAcaoData: "2026-10-14", comments: [{ userId: "b", text: "ok", at: "2026-10-12T12:00:00.000Z" }],
};
const notifs = [
  { taskId: "t1", userId: "b", read: true },
  { taskId: "t1", userId: "c", read: false },
];

describe("leituraDestinatario", () => {
  it("ciente depois da última ação", () => {
    expect(leituraDestinatario(t, "b", notifs).situacao).toBe("Ciente");
  });
  it("ciente antes da última ação = versão anterior", () => {
    expect(leituraDestinatario(t, "c", notifs).situacao).toBe("Ciente (versão anterior)");
  });
  it("abriu sem ciente / não lida", () => {
    const t2 = { ...t, ciente: {} };
    expect(leituraDestinatario(t2, "b", notifs).situacao).toBe("Lida, sem ciente");
    expect(leituraDestinatario(t2, "c", notifs).situacao).toBe("Não lida");
  });
});

describe("montarLinhasComunicacao + filtros", () => {
  const agora = new Date("2026-10-16T12:00:00.000Z");
  const [l] = montarLinhasComunicacao({ tasks: [t], notifs, users, claims: [], overrides: {}, config: {}, agora });

  it("monta origem, destinatários e indicadores", () => {
    expect(l).toMatchObject({
      origem: "Ana", destinatarios: "Bruno, Carla", leituraResumo: "1 de 2 ciente(s)", todosCientes: false,
      pendentesCiencia: "Carla", atrasada: "Sim", semInteracao2h: "Sim", qtdComentarios: 1, sinalizadores: "Aguard. cliente",
    });
    expect(l.leituraDetalhe.split("\n")).toHaveLength(2);
  });
  it("filtra por destinatário, leitura e período", () => {
    const f = (patch) => filtrarLinhasComunicacao([l], { ...FILTRO_COMUNICACAO_PADRAO, ...patch }).length;
    expect(f({})).toBe(1);
    expect(f({ destinatario: "c" })).toBe(1);
    expect(f({ destinatario: "a" })).toBe(0);
    expect(f({ leitura: "todos_cientes" })).toBe(0);
    expect(f({ leitura: "pendente_ciencia" })).toBe(1);
    expect(f({ criadaDe: "2026-10-11" })).toBe(0);
    expect(f({ criadaAte: "2026-10-31", status: "em_aberto", sinalizador: "Aguard. cliente" })).toBe(1);
    expect(f({ q: "ci-000001" })).toBe(1);
  });
});

describe("isoToExcelSerialDateTime", () => {
  it("data pura vira serial inteiro; timestamp tem fração", () => {
    expect(isoToExcelSerialDateTime("2026-10-16")).toBe(46311);
    const v = isoToExcelSerialDateTime(new Date(2026, 9, 16, 18, 0).toISOString());
    expect(v).toBeCloseTo(46311.75, 5);
  });
});

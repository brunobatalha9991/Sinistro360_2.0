import { describe, it, expect } from "vitest";
import { ultimoHistorico, linhaAcompanhamento, ordenarLinhas } from "./relatorioAcompanhamento";
import { buildXlsxFiles, zipStore, isoToExcelSerial } from "./xlsxExport";

describe("ultimoHistorico", () => {
  it("pega o de data mais recente, não o último do array", () => {
    const r = ultimoHistorico([
      { date: "2026-10-10", at: "2026-10-10T10:00:00Z", text: "novo", canal: "Cliente" },
      { date: "2026-09-01", at: "2026-09-01T10:00:00Z", text: "velho", canal: "Cliente" },
    ]);
    expect(r).toEqual({ data: "2026-10-10", texto: "[Cliente] novo" });
  });
  it("junta comunicações salvas no mesmo registro", () => {
    const at = "2026-10-10T10:00:00Z";
    const r = ultimoHistorico([
      { date: "2026-10-10", at, titulo: "Vistoria", canal: "Cliente", text: "a" },
      { date: "2026-10-10", at, titulo: "Vistoria", canal: "Oficina", text: "b" },
    ]);
    expect(r.texto).toBe("Vistoria\n[Cliente] a\n[Oficina] b");
  });
  it("sem histórico devolve null", () => { expect(ultimoHistorico([])).toBeNull(); });
});

describe("linhaAcompanhamento", () => {
  it("monta a linha com responsável, cliente e próxima ação", () => {
    const overrides = { c1: {
      responsavelUser: { id: "u", nome: "Marina" },
      nextAction: { title: "Ligar", date: "2026-10-20" },
      campos: { segurado: "FULANO" },
    } };
    const l = linhaAcompanhamento(overrides, { id: "c1", partyType: "Aviso", segurado: "X" });
    expect(l).toMatchObject({ tipo: "Atendimento", responsavel: "Marina", cliente: "FULANO", proxData: "2026-10-20", proxTitulo: "Ligar", ultHistData: "" });
  });
});

describe("ordenarLinhas", () => {
  it("responsável, depois próxima ação (vazios por último)", () => {
    const base = { cliente: "", ultHistData: "", ultHistTexto: "", proxTitulo: "", tipo: "Segurado" };
    const out = ordenarLinhas([
      { ...base, id: 1, responsavel: "", proxData: "2026-01-01" },
      { ...base, id: 2, responsavel: "Bia", proxData: "" },
      { ...base, id: 3, responsavel: "Bia", proxData: "2026-05-01" },
      { ...base, id: 4, responsavel: "Ana", proxData: "" },
    ]);
    expect(out.map((x) => x.id)).toEqual([4, 3, 2, 1]);
  });
});

describe("xlsxExport", () => {
  it("converte data ISO no serial do Excel", () => {
    expect(isoToExcelSerial("1900-01-01")).toBe(2);
    expect(isoToExcelSerial("2026-10-16")).toBe(46311);
    expect(isoToExcelSerial("")).toBeNull();
  });
  it("escapa XML e gera ZIP válido", async () => {
    const files = buildXlsxFiles({ sheetName: "Teste", columns: [{ label: "A" }, { label: "D", type: "date" }], rows: [["<x> & \"y\"", "2026-10-16"]] });
    const sheet = files.find(([n]) => n === "xl/worksheets/sheet1.xml")[1];
    expect(sheet).toContain("&lt;x&gt; &amp; &quot;y&quot;");
    expect(sheet).toContain("<v>46311</v>");
    const bytes = new Uint8Array(await zipStore(files).arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});

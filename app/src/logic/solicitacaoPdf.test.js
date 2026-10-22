import { describe, expect, it } from "vitest";
import { estruturarSolicitacao, formatarValorCampo, labelTipoAtendimento, montarHtmlSolicitacao } from "./solicitacaoPdf";

describe("formatarValorCampo", () => {
  it("texto vazio vira travessão marcado como vazio", () => {
    expect(formatarValorCampo({ tipo: "texto" }, "  ")).toEqual({ vazio: true, html: "—" });
  });
  it("escapa HTML e preserva quebras de linha em texto longo", () => {
    expect(formatarValorCampo({ tipo: "textarea" }, "a <b>\nc").html).toBe("a &lt;b&gt;<br>c");
  });
  it("data e hora no formato brasileiro", () => {
    expect(formatarValorCampo({ tipo: "datahora" }, "2026-10-05T14:30").html).toMatch(/^05\/10\/2026 14:30$/);
  });
  it("arquivos viram lista de links", () => {
    const f = formatarValorCampo({ tipo: "arquivo" }, [{ nome: "bo.pdf", url: "https://drive/x" }, { nome: "semlink" }]);
    expect(f.vazio).toBe(false);
    expect(f.html).toBe('<a href="https://drive/x">bo.pdf</a><br>semlink');
    expect(formatarValorCampo({ tipo: "arquivo" }, []).vazio).toBe(true);
  });
});

describe("estruturarSolicitacao", () => {
  it("esconde 'Dados do Terceiro' quando o atendimento é só pro segurado e repete a seção pra terceiros extras", () => {
    const soSegurado = estruturarSolicitacao("sinistro", { atendimento_desejado: "Apenas para o segurado" }, {});
    expect(soSegurado.blocos.map((b) => b.titulo)).not.toContain("Dados do Terceiro");

    const comTerceiros = estruturarSolicitacao("sinistro", {
      atendimento_desejado: "Para o Segurado e o Terceiro",
      nome_terceiro: "T1",
      terceirosExtra: [{ nome_terceiro: "T2" }, { nome_terceiro: "T3" }],
    }, {});
    const titulos = comTerceiros.blocos.map((b) => b.titulo);
    expect(titulos).toContain("Dados do Terceiro");
    expect(titulos).toContain("Dados do Terceiro — Terceiro #2");
    expect(titulos).toContain("Dados do Terceiro — Terceiro #3");
    expect(comTerceiros.blocos.find((b) => b.titulo.endsWith("#3")).valores.nome_terceiro).toBe("T3");
  });
  it("usa o formulário personalizado do admin quando existir", () => {
    const config = { corp_solicitacao_formularios: { assistencia_24h: { titulo: "Meu form", campos: [{ id: "x", secao: "S", label: "X", tipo: "texto" }] } } };
    const e = estruturarSolicitacao("assistencia_24h", { x: "1" }, config);
    expect(e.titulo).toBe("Meu form");
    expect(e.blocos).toHaveLength(1);
    expect(e.blocos[0].campos[0].id).toBe("x");
  });
  it("retorna null pra tipo sem formulário", () => {
    expect(estruturarSolicitacao("inexistente", {}, {})).toBeNull();
  });
});

describe("montarHtmlSolicitacao", () => {
  it("gera documento completo com cabeçalho, seções, valores e vazios", () => {
    const html = montarHtmlSolicitacao({
      tipoAtendimento: "sinistro",
      valores: { nome_segurado: "João <Silva>", atendimento_desejado: "Apenas para o segurado", upload_bo: [{ nome: "bo.pdf", url: "https://d/1" }] },
      config: {},
      contexto: { tituloTarefa: "Sinistro do João", processoLabel: "123 — João", solicitante: "Maria", geradoPor: "Ana" },
    });
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("Atendimento — Sinistros (Interno)");
    expect(html).toContain("<b>Tipo de atendimento:</b> Sinistro");
    expect(html).toContain("<b>Tarefa:</b> Sinistro do João");
    expect(html).toContain("<b>Processo vinculado:</b> 123 — João");
    expect(html).toContain("por Ana");
    expect(html).toContain("João &lt;Silva&gt;");
    expect(html).toContain('<a href="https://d/1">bo.pdf</a>');
    expect(html).toContain('class="vazio">—</td>');
    expect(html).not.toContain("Dados do Terceiro");
  });
  it("omite linhas de contexto não informadas e avisa quando o formulário não existe", () => {
    const html = montarHtmlSolicitacao({ tipoAtendimento: "nada", valores: {}, config: {}, contexto: {} });
    expect(html).not.toContain("<b>Tarefa:</b>");
    expect(html).toContain("ainda não foi configurado");
  });
});

describe("labelTipoAtendimento", () => {
  it("resolve o rótulo e devolve a chave quando desconhecida", () => {
    expect(labelTipoAtendimento("assistencia_vidros")).toBe("Assistência de Vidros e Pequenos Reparos");
    expect(labelTipoAtendimento("zzz")).toBe("zzz");
  });
});

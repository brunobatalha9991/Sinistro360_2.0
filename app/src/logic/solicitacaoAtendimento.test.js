import { describe, it, expect } from "vitest";
import { formularioDisponivel, validarSolicitacao, secoesDoFormulario, caminhoPastaSolicitacao, getFormularioEfetivo, secaoRepetivel } from "./solicitacaoAtendimento";

describe("formularioDisponivel", () => {
  it("os 3 formulários estão disponíveis", () => {
    expect(formularioDisponivel("sinistro")).toBe(true);
    expect(formularioDisponivel("assistencia_24h")).toBe(true);
    expect(formularioDisponivel("assistencia_vidros")).toBe(true);
  });
  it("um tipo desconhecido não está disponível", () => {
    expect(formularioDisponivel("outro")).toBe(false);
  });
});

describe("validarSolicitacao", () => {
  it("acusa campos obrigatórios faltando (assistencia_24h)", () => {
    const erro = validarSolicitacao("assistencia_24h", {});
    expect(erro).toMatch(/Nome do Comercial Solicitante/);
  });

  it("sinistro: não exige campos da seção Terceiro quando é só para o segurado", () => {
    const erro = validarSolicitacao("sinistro", {
      comercial_solicitante: "Ana", nome_segurado: "Carlos", contato_segurado: "11999990000",
      atendimento_desejado: "Apenas para o segurado", tipo_ocorrencia: "Colisão",
      data_hora_ocorrencia: "2026-08-22T10:00", endereco_ocorrencia: "Rua X, 123",
      descricao_ocorrencia: "Relato...", condutor_se_considera_responsavel: "Não",
      proposta_assinada: "Sim", realizou_bo: "Não",
    });
    // campos obrigatórios de upload (CNH, CRLV) ainda faltam, mas nenhum campo de Terceiro deve ser cobrado
    expect(erro).not.toMatch(/Terceiro/);
  });

  it("sinistro: exige dados quando envolve terceiro (mas Dados do Terceiro em si não tem campo obrigatório)", () => {
    const secoes = secoesDoFormulario("sinistro");
    expect(secoes).toContain("Dados do Terceiro");
  });

  it("passa quando todos os obrigatórios de assistencia_vidros estão preenchidos", () => {
    const erro = validarSolicitacao("assistencia_vidros", {
      comercial_solicitante: "Ana", nome_segurado: "Carlos", contato_segurado: "11999990000",
      atendimento_desejado: "Pequenos Reparos", proposta_assinada: "Sim",
    });
    expect(erro).toBeNull();
  });
});

describe("secaoRepetivel (mais de um terceiro)", () => {
  it("'Dados do Terceiro' do sinistro é repetível", () => {
    expect(secaoRepetivel("sinistro", "Dados do Terceiro")).toBe(true);
  });
  it("outras seções/tipos não são repetíveis", () => {
    expect(secaoRepetivel("sinistro", "Dados do Sinistro e do Segurado")).toBe(false);
    expect(secaoRepetivel("assistencia_24h", "Dados do Terceiro")).toBe(false);
  });
});

describe("validarSolicitacao — terceiros extras", () => {
  const base = {
    comercial_solicitante: "Ana", nome_segurado: "Carlos", contato_segurado: "11999990000",
    atendimento_desejado: "Para o Segurado e o Terceiro", tipo_ocorrencia: "Colisão",
    data_hora_ocorrencia: "2026-08-22T10:00", endereco_ocorrencia: "Rua X, 123",
    descricao_ocorrencia: "Relato...", condutor_se_considera_responsavel: "Não",
    proposta_assinada: "Sim", realizou_bo: "Não",
  };

  it("terceiro extra sem nenhum campo obrigatório na seção: não bloqueia (padrão de fábrica não tem obrigatório em Terceiro)", () => {
    const erro = validarSolicitacao("sinistro", { ...base, terceirosExtra: [{ nome_terceiro: "João" }, {}] });
    expect(erro).not.toMatch(/terceiro adicional/);
  });

  it("com um campo de Terceiro marcado obrigatório pelo admin, cobra em cada terceiro extra", () => {
    const config = {
      corp_solicitacao_formularios: {
        sinistro: {
          titulo: "Custom",
          campos: [
            { id: "nome_terceiro", secao: "Dados do Terceiro", label: "Nome do Terceiro", tipo: "texto", obrigatorio: true },
          ],
        },
      },
    };
    const erro = validarSolicitacao("sinistro", { nome_terceiro: "Primeiro", terceirosExtra: [{ nome_terceiro: "João" }, {}] }, config);
    expect(erro).toMatch(/terceiro adicional/);
    expect(erro).toMatch(/Nome do Terceiro/);
  });
});

describe("getFormularioEfetivo", () => {
  it("sem personalização, usa o formulário padrão de fábrica", () => {
    const def = getFormularioEfetivo("assistencia_24h", {});
    expect(def.campos.length).toBeGreaterThan(0);
    expect(def.titulo).toMatch(/Assistências 24h/);
  });

  it("com personalização do admin, usa os campos configurados", () => {
    const config = { corp_solicitacao_formularios: { assistencia_24h: { titulo: "Custom", campos: [{ id: "x", label: "Campo X", tipo: "texto", obrigatorio: true }] } } };
    const def = getFormularioEfetivo("assistencia_24h", config);
    expect(def.titulo).toBe("Custom");
    expect(def.campos).toHaveLength(1);
    expect(def.campos[0].id).toBe("x");
  });

  it("personalização vazia (campos: []) não sobrescreve o padrão", () => {
    const config = { corp_solicitacao_formularios: { sinistro: { titulo: "", campos: [] } } };
    const def = getFormularioEfetivo("sinistro", config);
    expect(def.campos.length).toBeGreaterThan(1);
  });
});

describe("caminhoPastaSolicitacao", () => {
  it("organiza por tipo de atendimento e nome do segurado", () => {
    const caminho = caminhoPastaSolicitacao("sinistro", { nome_segurado: "Carlos Andrade" }, "abc12345");
    expect(caminho).toMatch(/^Sinistro\/\d{4}-\d{2}-\d{2}_Carlos Andrade_abc12345$/);
  });

  it("usa 'Sem nome' quando o segurado ainda não foi preenchido", () => {
    const caminho = caminhoPastaSolicitacao("assistencia_24h", {}, "xyz");
    expect(caminho).toContain("Sem nome");
  });

  it("sanitiza caracteres inválidos de nome de pasta (não vaza barra extra no caminho)", () => {
    const caminho = caminhoPastaSolicitacao("assistencia_vidros", { nome_segurado: 'Carlos / "Testando" \\ *' }, "1");
    expect(caminho.split("/")).toHaveLength(2); // só a barra entre tipoLabel e o resto
  });
});

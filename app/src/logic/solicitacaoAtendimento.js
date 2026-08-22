// Formulário de Solicitação de Atendimento (Mesa de Atendimento) — a
// pedido do usuário, espelha os 3 formulários Google Forms já usados pela
// operação ("ATENDIMENTO - SINISTROS", "ATENDIMENTO - ASSISTÊNCIAS 24 HRS",
// "ATENDIMENTO - ASSISTÊNCIA DE VIDROS E PEQUENOS REPAROS", todos
// "(INTERNO)"). Diferente do checklist (marcação do que já foi coletado),
// este é um formulário de PREENCHIMENTO de dados, usado pelo solicitante
// (inclusive usuários "consulta") para abrir o pedido de atendimento.
//
// Campos tipo "arquivo" fazem upload para o Google Drive via Apps Script
// (ver logic/driveUpload.js e docs/mesa-atendimento.md) — nenhum login
// Google é exigido de quem está enviando o arquivo.
import { sanitizarNomePasta } from "./driveUpload";

const OP_SIM_NAO = ["Sim", "Não"];
const OP_SIM_NAO_OUTRO = ["Sim", "Não", "Outro"];

export const TIPOS_ATENDIMENTO = [
  ["sinistro", "Sinistro"],
  ["assistencia_24h", "Assistência 24h"],
  ["assistencia_vidros", "Assistência de Vidros e Pequenos Reparos"],
];

export const TIPOS_CAMPO = [
  ["texto", "Texto curto"],
  ["textarea", "Texto longo (parágrafo)"],
  ["select", "Seleção (lista de opções)"],
  ["datahora", "Data e hora"],
  ["arquivo", "Upload de arquivo"],
];

// Regra de seção condicional por tipo de atendimento — fixa no código (não
// editável pelo admin): só a seção "Dados do Terceiro" do formulário de
// Sinistro é condicional. Se o admin renomear/remover essa seção no editor,
// a condição simplesmente deixa de encontrar campos correspondentes, sem
// travar nada.
const SECAO_VISIVEL_POR_TIPO = {
  sinistro: (nomeSecao, valores) => (
    nomeSecao !== "Dados do Terceiro" || (valores.atendimento_desejado || "") !== "Apenas para o segurado"
  ),
};

// Formulários padrão de fábrica — usados quando o admin ainda não
// personalizou nada em Configurações (corp_solicitacao_formularios).
export const FORMULARIOS_SOLICITACAO = {
  sinistro: {
    titulo: "Atendimento — Sinistros (Interno)",
    campos: [
      // Seção 1: Dados Iniciais e Identificação da Apólice
      { id: "comercial_solicitante", secao: "Dados Iniciais e Identificação da Apólice", label: "Nome do Comercial Solicitante", tipo: "texto", obrigatorio: true, ajuda: "Identifica o responsável comercial interno que está abrindo o processo de sinistro." },
      { id: "nome_segurado", secao: "Dados Iniciais e Identificação da Apólice", label: "Nome do Segurado", tipo: "texto", obrigatorio: true, ajuda: "Nome completo do titular do contrato de seguro." },
      { id: "contato_segurado", secao: "Dados Iniciais e Identificação da Apólice", label: "Contato do Segurado / Representante", tipo: "texto", obrigatorio: true, ajuda: "Telefone/WhatsApp ou canal direto de contato com quem acompanhará a regulação." },
      { id: "atendimento_desejado", secao: "Dados Iniciais e Identificação da Apólice", label: "Atendimento Desejado", tipo: "select", obrigatorio: true, opcoes: ["Apenas para o segurado", "Apenas para o Terceiro", "Para o Segurado e o Terceiro"] },
      { id: "apolice_frota", secao: "Dados Iniciais e Identificação da Apólice", label: 'Se a apólice do segurado for modalidade "Frota", descreva o número da apólice, placa e nº do item', tipo: "texto", obrigatorio: false, ajuda: "Localização exata do veículo segurado dentro de uma apólice coletiva/empresarial." },
      // Seção 2: Dados do Sinistro e do Segurado
      { id: "tipo_ocorrencia", secao: "Dados do Sinistro e do Segurado", label: "Qual o Tipo da Ocorrência", tipo: "select", obrigatorio: true, opcoes: ["Colisão", "Incêndio", "Roubo", "Furto", "Outro"] },
      { id: "data_hora_ocorrencia", secao: "Dados do Sinistro e do Segurado", label: "Data e Hora da Ocorrência", tipo: "datahora", obrigatorio: true },
      { id: "endereco_ocorrencia", secao: "Dados do Sinistro e do Segurado", label: "Endereço da Ocorrência Completo com CEP", tipo: "texto", obrigatorio: true },
      { id: "descricao_ocorrencia", secao: "Dados do Sinistro e do Segurado", label: "Descrição da Ocorrência", tipo: "textarea", obrigatorio: true, ajuda: 'Modelo: "Eu, [Nome], portador do CPF [Número], estava trafegando no endereço [Local com CEP], na data [Data] por volta das [Horas], quando [Relato do ocorrido e envolvidos]."' },
      { id: "condutor_se_considera_responsavel", secao: "Dados do Sinistro e do Segurado", label: "O condutor do veículo do segurado se considera responsável pela ocorrência?", tipo: "select", obrigatorio: true, opcoes: OP_SIM_NAO },
      { id: "oficina_segurado", secao: "Dados do Sinistro e do Segurado", label: "Em qual oficina o segurado deseja realizar os reparos", tipo: "texto", obrigatorio: false, ajuda: "Razão Social, CNPJ, endereço completo e contato — a oficina precisa emitir nota fiscal e passar por homologação/análise da seguradora." },
      { id: "veiculo_locomove", secao: "Dados do Sinistro e do Segurado", label: "O veículo segurado tem condição de se locomover enquanto aguarda chegada de peças / agendamento da oficina?", tipo: "select", obrigatorio: false, opcoes: OP_SIM_NAO_OUTRO },
      { id: "proposta_assinada", secao: "Dados do Sinistro e do Segurado", label: "Proposta Assinada", tipo: "select", obrigatorio: true, opcoes: OP_SIM_NAO_OUTRO },
      { id: "upload_proposta_assinada", secao: "Dados do Sinistro e do Segurado", label: "Upload da Proposta Assinada", tipo: "arquivo", obrigatorio: false, maxArquivos: 5, maxTamanhoMb: 10 },
      { id: "realizou_bo", secao: "Dados do Sinistro e do Segurado", label: "Realizou Boletim de Ocorrência?", tipo: "select", obrigatorio: true, opcoes: OP_SIM_NAO_OUTRO },
      { id: "upload_bo", secao: "Dados do Sinistro e do Segurado", label: "Upload do Boletim de Ocorrência", tipo: "arquivo", obrigatorio: false, maxArquivos: 5, maxTamanhoMb: 10 },
      { id: "upload_cnh_segurado", secao: "Dados do Sinistro e do Segurado", label: "Upload da CNH (Segurado)", tipo: "arquivo", obrigatorio: true, maxArquivos: 5, maxTamanhoMb: 10 },
      { id: "upload_cnh_condutor", secao: "Dados do Sinistro e do Segurado", label: "Upload da CNH (Condutor)", tipo: "arquivo", obrigatorio: true, maxArquivos: 5, maxTamanhoMb: 10, ajuda: "Documento de quem estava dirigindo no momento do sinistro." },
      { id: "upload_dut_crlv_segurado", secao: "Dados do Sinistro e do Segurado", label: "Upload do DUT / CRLV (Veículo Segurado)", tipo: "arquivo", obrigatorio: true, maxArquivos: 5, maxTamanhoMb: 10 },
      { id: "upload_fotos_veiculo_segurado", secao: "Dados do Sinistro e do Segurado", label: "Upload de Fotos (Veículo Segurado)", tipo: "arquivo", obrigatorio: false, maxArquivos: 10, maxTamanhoMb: 100, ajuda: "Recomendado: frontal, traseira, ambas as laterais e fotos focadas nos danos." },
      { id: "outros_anexos_segurado", secao: "Dados do Sinistro e do Segurado", label: "Outros Anexos (Segurado)", tipo: "arquivo", obrigatorio: false, maxArquivos: 10, maxTamanhoMb: 100 },
      { id: "observacoes_segurado", secao: "Dados do Sinistro e do Segurado", label: "Observações (Segurado)", tipo: "textarea", obrigatorio: false },
      // Seção 3: Dados do Terceiro — só relevante se o atendimento envolve terceiro
      { id: "nome_terceiro", secao: "Dados do Terceiro", label: "Nome do Terceiro", tipo: "texto", obrigatorio: false },
      { id: "contato_terceiro", secao: "Dados do Terceiro", label: "Contato do Terceiro", tipo: "texto", obrigatorio: false },
      { id: "endereco_terceiro", secao: "Dados do Terceiro", label: "Endereço de Residência Completo com CEP (Terceiro)", tipo: "texto", obrigatorio: false },
      { id: "oficina_terceiro", secao: "Dados do Terceiro", label: "Em qual oficina o terceiro deseja realizar os reparos", tipo: "texto", obrigatorio: false, ajuda: "Razão Social, CNPJ, endereço e contato — sujeita a NF e vistoria." },
      { id: "veiculo_terceiro_locomove", secao: "Dados do Terceiro", label: "O veículo terceiro tem condição de se locomover enquanto aguarda chegada de peças / agendamento da oficina?", tipo: "select", obrigatorio: false, opcoes: OP_SIM_NAO_OUTRO },
      { id: "upload_cnh_terceiro", secao: "Dados do Terceiro", label: "Upload da CNH (Terceiro)", tipo: "arquivo", obrigatorio: false, maxArquivos: 5, maxTamanhoMb: 10 },
      { id: "upload_dut_crlv_terceiro", secao: "Dados do Terceiro", label: "Upload do DUT / CRLV (Veículo Terceiro)", tipo: "arquivo", obrigatorio: false, maxArquivos: 5, maxTamanhoMb: 10 },
      { id: "upload_fotos_terceiro", secao: "Dados do Terceiro", label: "Upload de Fotos (Veículo Terceiro)", tipo: "arquivo", obrigatorio: false, maxArquivos: 10, maxTamanhoMb: 100 },
      { id: "outros_anexos_terceiro", secao: "Dados do Terceiro", label: "Outros Anexos (Terceiro)", tipo: "arquivo", obrigatorio: false, maxArquivos: 10, maxTamanhoMb: 100 },
      { id: "observacoes_terceiro", secao: "Dados do Terceiro", label: "Observações (Terceiro)", tipo: "textarea", obrigatorio: false },
    ],
  },

  assistencia_24h: {
    titulo: "Atendimento — Assistências 24h (Interno)",
    campos: [
      // Seção 1: Dados Iniciais e Tipo de Assistência
      { id: "comercial_solicitante", secao: "Dados Iniciais e Tipo de Assistência", label: "Nome do Comercial Solicitante", tipo: "texto", obrigatorio: true },
      { id: "nome_segurado", secao: "Dados Iniciais e Tipo de Assistência", label: "Nome do Segurado", tipo: "texto", obrigatorio: true },
      { id: "contato_segurado", secao: "Dados Iniciais e Tipo de Assistência", label: "Contato do Segurado / Representante", tipo: "texto", obrigatorio: true },
      { id: "atendimento_desejado", secao: "Dados Iniciais e Tipo de Assistência", label: "Atendimento Desejado", tipo: "select", obrigatorio: true, opcoes: ["Guincho (Pane)", "Guincho (Colisão)", "Transporte Alternativo (Taxi)", "Chaveiro", "Mecânico", "Outro"] },
      { id: "apolice_frota", secao: "Dados Iniciais e Tipo de Assistência", label: 'Se a apólice do segurado for modalidade "Frota", descreva o número da apólice, placa e nº do item', tipo: "texto", obrigatorio: false },
      { id: "observacoes_geral", secao: "Dados Iniciais e Tipo de Assistência", label: "Observações (Geral)", tipo: "textarea", obrigatorio: false },
      // Seção 2: Atendimento de Guincho / Transporte Alternativo
      { id: "tipo_veiculo", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Qual o Tipo do Veículo", tipo: "select", obrigatorio: false, opcoes: ["Carro", "Moto", "Caminhão sem Carga", "Caminhão com Carga"], ajuda: "Se for caminhão, detalhe em Observações: altura, comprimento, largura, eixos, tração (bitruck/trucado/traçado/toco), teto, defletor, interclima, acessórios, se é cavalo mecânico ou conjunto, desatrelado, rodas travadas ou tombado." },
      { id: "placa_guincho", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Qual a Placa do Veículo", tipo: "texto", obrigatorio: false },
      { id: "facil_acesso", secao: "Atendimento de Guincho / Transporte Alternativo", label: "O veículo está em localização de fácil acesso, no nível de rua?", tipo: "select", obrigatorio: false, opcoes: OP_SIM_NAO },
      { id: "roda_travada", secao: "Atendimento de Guincho / Transporte Alternativo", label: "O veículo está com alguma roda travada?", tipo: "select", obrigatorio: false, opcoes: OP_SIM_NAO },
      { id: "consegue_neutro", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Consegue colocar o veículo em neutro?", tipo: "select", obrigatorio: false, opcoes: OP_SIM_NAO },
      { id: "nome_pessoa_origem", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Nome da pessoa que está no endereço de origem", tipo: "texto", obrigatorio: false },
      { id: "contato_pessoa_origem", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Contato da pessoa que está no endereço de origem", tipo: "texto", obrigatorio: false },
      { id: "endereco_origem", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Endereço de Origem", tipo: "texto", obrigatorio: false, ajuda: "Local exato onde o carro está parado (com CEP e ponto de referência)." },
      { id: "endereco_destino", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Endereço de Destino", tipo: "texto", obrigatorio: false, ajuda: "Local onde o carro será entregue (com CEP e ponto de referência)." },
      { id: "transporte_qtd_pessoas", secao: "Atendimento de Guincho / Transporte Alternativo", label: 'Se precisa de transporte — será para quantas pessoas?', tipo: "texto", obrigatorio: false },
      { id: "transporte_crianca_idoso_bagagem_animal", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Se precisa de transporte — tem criança? Idoso? Bagagem? Animal? (quantidade)", tipo: "texto", obrigatorio: false },
      { id: "transporte_endereco_destino", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Se precisa de transporte — endereço de destino", tipo: "texto", obrigatorio: false },
      { id: "agendamento_data_hora", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Se for por agendamento — qual a data e hora desejada", tipo: "datahora", obrigatorio: false },
      { id: "observacoes_guincho", secao: "Atendimento de Guincho / Transporte Alternativo", label: "Observações (Guincho)", tipo: "textarea", obrigatorio: false },
    ],
  },

  assistencia_vidros: {
    titulo: "Atendimento — Assistência de Vidros e Pequenos Reparos (Interno)",
    campos: [
      // Seção 1: Dados do Solicitante e Tipo de Atendimento
      { id: "comercial_solicitante", secao: "Dados do Solicitante e Tipo de Atendimento", label: "Nome do Comercial Solicitante", tipo: "texto", obrigatorio: true },
      { id: "nome_segurado", secao: "Dados do Solicitante e Tipo de Atendimento", label: "Nome do Segurado", tipo: "texto", obrigatorio: true },
      { id: "contato_segurado", secao: "Dados do Solicitante e Tipo de Atendimento", label: "Contato do Segurado / Representante", tipo: "texto", obrigatorio: true },
      { id: "atendimento_desejado", secao: "Dados do Solicitante e Tipo de Atendimento", label: "Atendimento Desejado", tipo: "select", obrigatorio: true, opcoes: ["Vidros / Faróis / Lanternas / Retrovisores", "Pequenos Reparos", "Outro"] },
      { id: "apolice_frota", secao: "Dados do Solicitante e Tipo de Atendimento", label: 'Se a apólice do segurado for modalidade "Frota", descreva o número da apólice, placa e nº do item', tipo: "texto", obrigatorio: false },
      { id: "observacoes_geral", secao: "Dados do Solicitante e Tipo de Atendimento", label: "Observações (Geral)", tipo: "textarea", obrigatorio: false },
      // Seção 2: Detalhamento do Sinistro / Reparo
      { id: "placa_veiculo", secao: "Detalhamento do Sinistro / Reparo", label: "Qual a Placa do Veículo", tipo: "texto", obrigatorio: false },
      { id: "peca_danificada", secao: "Detalhamento do Sinistro / Reparo", label: "Qual é a Peça Danificada", tipo: "texto", obrigatorio: false, ajuda: "Ex.: para-brisa, farol direito, parachoque." },
      { id: "lado_peca", secao: "Detalhamento do Sinistro / Reparo", label: "Qual o Lado da Peça Danificada", tipo: "select", obrigatorio: false, opcoes: ["Lado do Motorista", "Lado do Carona", "Outro"] },
      { id: "data_hora_ocorrencia", secao: "Detalhamento do Sinistro / Reparo", label: "Data e Hora da Ocorrência", tipo: "datahora", obrigatorio: false },
      { id: "endereco_ocorrencia", secao: "Detalhamento do Sinistro / Reparo", label: "Endereço da Ocorrência Completo com CEP", tipo: "texto", obrigatorio: false, ajuda: "Recomendado incluir ponto de referência." },
      { id: "descricao_ocorrencia", secao: "Detalhamento do Sinistro / Reparo", label: "Descrição da Ocorrência", tipo: "textarea", obrigatorio: false, ajuda: 'Modelo: "Eu, [Nome], CPF [Número], trafegava no endereço [Local], na data [Data] por volta das [Horas], quando [Relato do fato e envolvidos]."' },
      { id: "cidade_estado_atendimento", secao: "Detalhamento do Sinistro / Reparo", label: "Em qual Cidade e Estado deseja ser atendido", tipo: "texto", obrigatorio: false },
      { id: "proposta_assinada", secao: "Detalhamento do Sinistro / Reparo", label: "Proposta Assinada", tipo: "select", obrigatorio: true, opcoes: OP_SIM_NAO_OUTRO },
      { id: "upload_proposta_assinada", secao: "Detalhamento do Sinistro / Reparo", label: "Upload da Proposta Assinada", tipo: "arquivo", obrigatorio: false, maxArquivos: 5, maxTamanhoMb: 10 },
      { id: "fotos_documentos_outros", secao: "Detalhamento do Sinistro / Reparo", label: "Fotos / Documentos / Outros Anexos", tipo: "arquivo", obrigatorio: false, maxArquivos: 10, maxTamanhoMb: 100, ajuda: "Fotos da avaria, CRLV ou documentos complementares." },
      { id: "observacoes_assistencia", secao: "Detalhamento do Sinistro / Reparo", label: "Observações (Assistência)", tipo: "textarea", obrigatorio: false },
    ],
  },
};

// Resolve o formulário que vale de verdade: personalização do admin
// (config.corp_solicitacao_formularios[tipo]) quando existir e tiver pelo
// menos 1 campo, senão o padrão de fábrica. `secaoVisivel` sempre vem do
// código (não é editável), mantendo a regra de negócio segura mesmo que o
// admin reorganize os campos.
export function getFormularioEfetivo(tipoAtendimento, config) {
  const base = FORMULARIOS_SOLICITACAO[tipoAtendimento];
  const overrides = (config && config.corp_solicitacao_formularios) || {};
  const personalizado = overrides[tipoAtendimento];
  const secaoVisivel = SECAO_VISIVEL_POR_TIPO[tipoAtendimento];

  if (personalizado && Array.isArray(personalizado.campos) && personalizado.campos.length) {
    return { titulo: personalizado.titulo || (base && base.titulo) || tipoAtendimento, campos: personalizado.campos, secaoVisivel };
  }
  if (!base) return null;
  return { ...base, secaoVisivel };
}

export function formularioDisponivel(tipoAtendimento, config) {
  return !!getFormularioEfetivo(tipoAtendimento, config);
}

export function secoesDoFormulario(tipoAtendimento, config) {
  const def = getFormularioEfetivo(tipoAtendimento, config);
  if (!def) return [];
  const vistas = [];
  def.campos.forEach((c) => { if (c.secao && vistas.indexOf(c.secao) < 0) vistas.push(c.secao); });
  return vistas;
}

const LABEL_TIPO_ATENDIMENTO = {
  sinistro: "Sinistro",
  assistencia_24h: "Assistencia 24h",
  assistencia_vidros: "Assistencia Vidros e Pequenos Reparos",
};

// Caminho de pasta organizado dentro do Drive: Tipo de Atendimento / Data +
// Nome do Segurado + sufixo único (evita colisão entre duas solicitações do
// mesmo segurado no mesmo dia). Recalculado a cada render — se o nome do
// segurado for preenchido depois do primeiro upload, os próximos anexos já
// vão para a pasta com o nome certo (o(s) primeiro(s) ficam na pasta
// anterior — best effort, não retroage).
export function caminhoPastaSolicitacao(tipoAtendimento, valores, sufixoUnico) {
  const tipoLabel = LABEL_TIPO_ATENDIMENTO[tipoAtendimento] || "Outros";
  const hoje = new Date().toISOString().slice(0, 10);
  const nome = sanitizarNomePasta((valores || {}).nome_segurado);
  const sufixo = String(sufixoUnico || "").slice(-8);
  return `${tipoLabel}/${hoje}_${nome}_${sufixo}`;
}

export function validarSolicitacao(tipoAtendimento, valores, config) {
  const def = getFormularioEfetivo(tipoAtendimento, config);
  if (!def) return "Este formulário ainda não foi configurado.";
  const v = valores || {};
  const visivel = (c) => !def.secaoVisivel || def.secaoVisivel(c.secao, v);
  const faltando = def.campos.filter((c) => c.obrigatorio && visivel(c) && !String(v[c.id] || "").trim());
  if (faltando.length) return "Preencha: " + faltando.map((c) => c.label).join(", ");
  return null;
}

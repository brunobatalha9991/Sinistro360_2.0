// Checklist de abertura de sinistro via Mesa de Atendimento — usado só nas
// tarefas com tipo "Mesa de Atendimento" e atendimento "Sinistro"
// (TaskModal.jsx). É um checklist de itens a MARCAR como coletados, não um
// formulário de preenchimento de dados.
//
// Cada item pode ter um `campoVinculado` — o id de um campo do formulário
// de Solicitação de Sinistro (ver solicitacaoAtendimento.js). Quando esse
// campo é preenchido pela primeira vez, o item é marcado automaticamente;
// a partir daí o controle é do usuário (pode desmarcar/remarcar livremente
// — a sincronização automática só acontece UMA VEZ por item, nunca força
// de volta). Itens sem campoVinculado (ou campos puramente identificadores,
// como nome/contato) não são sincronizados — são só marcação manual.
//
// Listas abaixo são o padrão de fábrica. O admin pode personalizar em
// Configurações (config.corp_checklist_mesa_atendimento) — ver
// getChecklistEfetivo() e components/config/ChecklistMesaAtendimentoCard.jsx.
export const CHECKLIST_SEGURADO = [
  { id: "atendimento_definido", label: "Tipo de atendimento definido (segurado/terceiro/ambos)", campoVinculado: "atendimento_desejado" },
  { id: "tipo_ocorrencia", label: "Tipo da ocorrência definido", campoVinculado: "tipo_ocorrencia" },
  { id: "data_hora_ocorrencia", label: "Data e hora da ocorrência informada", campoVinculado: "data_hora_ocorrencia" },
  { id: "endereco_ocorrencia", label: "Endereço da ocorrência informado", campoVinculado: "endereco_ocorrencia" },
  { id: "relato_segurado", label: "Relato do segurado registrado", campoVinculado: "descricao_ocorrencia" },
  { id: "culpabilidade", label: "Definido se o condutor se considera responsável", campoVinculado: "condutor_se_considera_responsavel" },
  { id: "oficina_segurado", label: "Oficina do segurado definida", campoVinculado: "oficina_segurado" },
  { id: "proposta_assinada", label: "Status da proposta assinada informado", campoVinculado: "proposta_assinada" },
  { id: "upload_proposta", label: "Upload da proposta assinada", campoVinculado: "upload_proposta_assinada" },
  { id: "boletim_ocorrencia", label: "Status do Boletim de Ocorrência informado", campoVinculado: "realizou_bo" },
  { id: "upload_bo", label: "Upload do Boletim de Ocorrência", campoVinculado: "upload_bo" },
  { id: "cnh_segurado", label: "CNH do segurado anexada", campoVinculado: "upload_cnh_segurado" },
  { id: "cnh_condutor", label: "CNH do condutor anexada", campoVinculado: "upload_cnh_condutor" },
  { id: "doc_veiculo_segurado", label: "DUT/CRLV do veículo do segurado anexado", campoVinculado: "upload_dut_crlv_segurado" },
  { id: "fotos_veiculo_segurado", label: "Fotos do veículo do segurado anexadas", campoVinculado: "upload_fotos_veiculo_segurado" },
];

export const CHECKLIST_TERCEIRO = [
  { id: "contato_terceiro", label: "Contato do terceiro coletado", campoVinculado: "contato_terceiro" },
  { id: "endereco_terceiro", label: "Endereço do terceiro informado", campoVinculado: "endereco_terceiro" },
  { id: "oficina_terceiro", label: "Oficina do terceiro definida", campoVinculado: "oficina_terceiro" },
  { id: "cnh_terceiro", label: "CNH do terceiro anexada", campoVinculado: "upload_cnh_terceiro" },
  { id: "doc_veiculo_terceiro", label: "DUT/CRLV do veículo do terceiro anexado", campoVinculado: "upload_dut_crlv_terceiro" },
  { id: "fotos_veiculo_terceiro", label: "Fotos do veículo do terceiro anexadas", campoVinculado: "upload_fotos_terceiro" },
];

// `sincronizados` registra quais itens (por id, mais o sentinela
// "__temTerceiro") já passaram pela sincronização automática pelo menos uma
// vez — depois disso, sincronizarComFormulario() nunca mais mexe neles.
export function checklistVazio() { return { temTerceiro: false, itens: {}, sincronizados: {} }; }

// Resolve as listas que valem de verdade: personalização do admin quando
// existir e tiver pelo menos 1 item em cada grupo, senão o padrão de fábrica
// — grupo a grupo (dá pra personalizar só "segurado" e manter "terceiro" no
// padrão, por exemplo).
export function getChecklistEfetivo(config) {
  const overrides = (config && config.corp_checklist_mesa_atendimento) || {};
  const segurado = Array.isArray(overrides.segurado) && overrides.segurado.length ? overrides.segurado : CHECKLIST_SEGURADO;
  const terceiro = Array.isArray(overrides.terceiro) && overrides.terceiro.length ? overrides.terceiro : CHECKLIST_TERCEIRO;
  return { segurado, terceiro };
}

function campoPreenchido(valor) {
  return Array.isArray(valor) ? valor.length > 0 : !!String(valor || "").trim();
}

// Marca automaticamente (só UMA VEZ por item, nunca desmarca) os itens
// vinculados a campos do formulário que já têm valor preenchido, e liga
// "Houve terceiro envolvido?" quando o campo "atendimento_desejado" indicar
// terceiro. Devolve a MESMA referência de checklistMesa se nada mudou (evita
// re-render/loop desnecessário).
export function sincronizarComFormulario(checklistMesa, solicitacao, config) {
  const atual = checklistMesa || checklistVazio();
  const { segurado, terceiro } = getChecklistEfetivo(config);
  const valores = solicitacao || {};
  const itens = { ...(atual.itens || {}) };
  const sincronizados = { ...(atual.sincronizados || {}) };
  let temTerceiro = atual.temTerceiro;
  let mudou = false;

  if (!sincronizados.__temTerceiro) {
    const desejado = valores.atendimento_desejado || "";
    if (desejado === "Apenas para o Terceiro" || desejado === "Para o Segurado e o Terceiro") {
      temTerceiro = true;
      sincronizados.__temTerceiro = true;
      mudou = true;
    }
  }

  [...segurado, ...terceiro].forEach((item) => {
    if (!item.campoVinculado || sincronizados[item.id]) return;
    if (campoPreenchido(valores[item.campoVinculado])) {
      itens[item.id] = true;
      sincronizados[item.id] = true;
      mudou = true;
    }
  });

  return mudou ? { ...atual, itens, sincronizados, temTerceiro } : atual;
}

export function checklistProgresso(checklistMesa, config) {
  if (!checklistMesa) return { feitos: 0, total: 0 };
  const { segurado, terceiro } = getChecklistEfetivo(config);
  const itens = checklistMesa.itens || {};
  const grupos = checklistMesa.temTerceiro ? [...segurado, ...terceiro] : segurado;
  const feitos = grupos.filter((i) => itens[i.id]).length;
  return { feitos, total: grupos.length };
}

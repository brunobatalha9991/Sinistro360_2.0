// Checklist de abertura de sinistro via Mesa de Atendimento — usado só nas
// tarefas com tipo "Mesa de Atendimento" (TaskModal.jsx). É um checklist de
// itens a MARCAR como coletados, não um formulário de preenchimento de
// dados — a pedido explícito do usuário.
export const CHECKLIST_SEGURADO = [
  { id: "cnh_condutor", label: "Foto da CNH do condutor" },
  { id: "doc_veiculo", label: "Foto do documento do veículo" },
  { id: "boletim_ocorrencia", label: "Boletim de Ocorrência (B.O.)" },
  { id: "proposta_assinada", label: "Proposta assinada" },
  { id: "fotos_4_lados", label: "Fotos dos 4 lados do veículo" },
  { id: "fotos_danos", label: "Fotos dos danos" },
  { id: "relato_segurado", label: "Relato do segurado (dinâmica do sinistro)" },
  { id: "cnh_proprietario", label: "CNH do proprietário do veículo" },
  { id: "endereco_completo", label: "Endereço completo do segurado" },
  { id: "verificado_terceiro", label: "Verificado se houve terceiro envolvido" },
  { id: "culpabilidade", label: "Definido se o segurado se considera culpado" },
  { id: "oficina_escolha", label: "Definida oficina: livre escolha ou referenciada" },
];

export const CHECKLIST_TERCEIRO = [
  { id: "contato_terceiro", label: "Contato do terceiro coletado" },
  { id: "atendimento_terceiro", label: "Definido se vai ter atendimento para o terceiro" },
  { id: "cnh_condutor_terceiro", label: "Foto da CNH do condutor do terceiro" },
  { id: "doc_veiculo_terceiro", label: "Foto do documento do veículo do terceiro" },
  { id: "endereco_terceiro", label: "Endereço completo com CEP do terceiro" },
  { id: "fotos_terceiro", label: "Fotos do veículo do terceiro" },
  { id: "dinamica_terceiro", label: "Dinâmica do acidente por parte do terceiro" },
  { id: "relato_terceiro", label: "Relato do terceiro" },
  { id: "oficina_terceiro", label: "Oficina do terceiro definida" },
];

export function checklistVazio() { return { temTerceiro: false, itens: {} }; }

export function checklistProgresso(checklistMesa) {
  if (!checklistMesa) return { feitos: 0, total: 0 };
  const itens = checklistMesa.itens || {};
  const grupos = checklistMesa.temTerceiro ? [...CHECKLIST_SEGURADO, ...CHECKLIST_TERCEIRO] : CHECKLIST_SEGURADO;
  const feitos = grupos.filter((i) => itens[i.id]).length;
  return { feitos, total: grupos.length };
}

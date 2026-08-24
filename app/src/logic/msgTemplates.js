// Templates de mensagem (WhatsApp) por etapa da jornada — botão "Mensagem
// para o cliente" no Histórico do sinistro (CommsPanel.jsx). Administrados
// em Configurações (MensagemTemplatesEditor.jsx), guardados em
// config.corp_msg_templates: [{ id, nome, etapaVinculada, texto }].
// etapaVinculada é o TÍTULO da etapa (mesma lista de allJourneyStages(),
// já usada no seletor de Título do Histórico) — "" significa "genérico",
// sem vínculo com etapa nenhuma.
import { campoEfetivo, getUserJourney } from "./claims";
import { fmtDateBR, todayISO, uid } from "./format";
import { clienteIdFromNome } from "./clientes";

export const MSG_ETAPA_GENERICA = "";

// Variáveis disponíveis pra montar um template — usado tanto pra resolver
// o texto final quanto pra alimentar os botões "+ inserir" no editor
// (Configurações). label é só pra exibição no editor.
export const MSG_VARIAVEIS = [
  { chave: "cliente", label: "Nome do cliente" },
  { chave: "seguradora", label: "Seguradora" },
  { chave: "oficina", label: "Oficina" },
  { chave: "numero_sinistro", label: "Número do sinistro (protocolo)" },
  { chave: "apolice", label: "Apólice" },
  { chave: "placa", label: "Placa do veículo" },
  { chave: "ramo", label: "Ramo" },
  { chave: "etapa", label: "Etapa atual da jornada" },
  { chave: "data_etapa", label: "Data preenchida na etapa atual" },
  { chave: "observacao_etapa", label: "Observação preenchida na etapa atual" },
  { chave: "data_hoje", label: "Data de hoje" },
];

// Monta o mapa {chave: valor} pra este sinistro, na etapa atual (stageTitle
// já resolvido por currentStage() — passado de fora pra não duplicar aqui a
// lógica de ramo/atendimento/caminho).
export function buildTemplateVars(c, overrides, stageTitle) {
  const steps = (getUserJourney(overrides, c.id) || {}).steps || {};
  const stepData = Object.values(steps).find((sd) => sd && sd.title === stageTitle) || {};
  return {
    cliente: campoEfetivo(overrides, c, "segurado") || "",
    seguradora: campoEfetivo(overrides, c, "cia") || "",
    oficina: campoEfetivo(overrides, c, "oficina") || "",
    numero_sinistro: c.numsin || "",
    apolice: c.numapo || "",
    placa: c.placa || "",
    ramo: c.ramo || "",
    etapa: stageTitle || "",
    data_etapa: stepData.date ? fmtDateBR(stepData.date) : "",
    observacao_etapa: stepData.note || "",
    data_hoje: fmtDateBR(todayISO()),
  };
}

// Substitui [[chave]] pelo valor em vars. Chave conhecida mas vazia vira
// string vazia (o trecho some da frase); chave desconhecida fica como
// está — visível de propósito, pra ficar óbvio no preview que faltou
// alguma coisa antes de enviar.
export function renderTemplate(texto, vars) {
  return String(texto || "").replace(/\[\[(\w+)\]\]/g, (m, chave) => (
    Object.prototype.hasOwnProperty.call(vars, chave) ? vars[chave] : m
  ));
}

// Telefone do cliente (cadastro manual do módulo Clientes — Fase 3), já
// normalizado pra um link wa.me (só dígitos, com DDI 55 se não tiver).
export function clienteWhatsappDigits(clientes, nomeCliente) {
  const id = clienteIdFromNome(nomeCliente);
  const cad = (clientes || {})[id];
  const telefone = cad && cad.contatos && cad.contatos[0] && cad.contatos[0].telefone;
  if (!telefone) return "";
  const digits = String(telefone).replace(/\D/g, "");
  if (!digits) return "";
  return digits.length <= 11 ? "55" + digits : digits;
}

export function defaultMsgTemplates() {
  return [
    {
      id: uid("msgtpl"),
      nome: "Cobrança de vistoria",
      etapaVinculada: "Vistoria",
      texto: "Olá, [[cliente]]! Aqui é da equipe responsável pelo seu sinistro [[numero_sinistro]] junto à [[seguradora]]. Ainda estamos aguardando a realização da vistoria do veículo placa [[placa]]. Poderia nos confirmar a disponibilidade para agendarmos o quanto antes? Ficamos no aguardo, obrigado!",
    },
    {
      id: uid("msgtpl"),
      nome: "Atendimento inicial (protocolo)",
      etapaVinculada: "Atendimento inicial",
      texto: "Olá, [[cliente]]! Seu atendimento foi registrado com o protocolo [[numero_sinistro]], placa [[placa]]. Previsão: [[data_etapa]]. [[observacao_etapa]] Qualquer dúvida, estamos à disposição!",
    },
  ];
}

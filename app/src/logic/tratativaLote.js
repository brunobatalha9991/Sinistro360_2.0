// "Tratativa em lote" (módulo Oficinas, a pedido do usuário) — em vez de
// abrir processo por processo pra cobrar a oficina, um botão único reúne
// todos os processos em aberto daquela oficina e monta duas mensagens
// prontas pra copiar/colar no WhatsApp: uma pelo template configurado
// (Configurações → Tratativa em lote) repetido por placa, outra gerada por
// IA com base no contexto de cada processo (etapa, histórico, próxima
// ação). Nada é enviado automaticamente.
import { renderTemplate } from "./msgTemplates";
import { campoEfetivo, currentStage, loadComms, getNextAction, isFinalizado } from "./claims";
import { oficinaClaims } from "./oficinas";
import { fmtDateBR, txt } from "./format";

export const DEFAULT_TRATATIVA_LOTE_TEMPLATE =
`[[placa]]: Todas as peças chegaram?

* Se "NÃO", qual a previsão para chegada?

* Se "SIM", qual a previsão para conclusão dos reparos e o que está acontecendo agora com o veículo?`;

// Processos em aberto desta oficina — tratativa em lote não faz sentido
// pra processo já finalizado (Indenizado/Sem Indenização), então esses
// nunca entram, mesmo que ainda apareçam listados na aba Atendimentos.
export function claimsAbertosDaOficina(claims, overrides, oficinaNome, templates, atendTemplateCfg) {
  return oficinaClaims(claims, overrides, oficinaNome).filter((c) => !isFinalizado(overrides, c, atendTemplateCfg, templates));
}

// Mensagem 1: o template (config.corp_tratativa_lote_template, ou o
// padrão de fábrica) renderizado uma vez por processo, com [[placa]]
// substituída — blocos separados por linha em branco.
export function montarMensagemLote(template, claims, overrides) {
  const tpl = template && template.trim() ? template : DEFAULT_TRATATIVA_LOTE_TEMPLATE;
  return claims
    .map((c) => renderTemplate(tpl, { placa: txt(campoEfetivo(overrides, c, "placa")) || "placa não identificada" }))
    .join("\n\n");
}

// Contexto de UM processo pra alimentar a IA na mensagem 2 — etapa atual,
// último histórico já trocado com a oficina e a próxima ação registrada,
// exatamente o que o usuário pediu pra "obter retorno mais preciso".
export function contextoClaimParaIA(c, overrides, templates, atendTemplateCfg) {
  const etapa = currentStage(overrides, templates, atendTemplateCfg, c) || "—";
  const comsOficina = loadComms(overrides, c.id).filter((m) => m.canal === "Oficina");
  const ultimo = comsOficina.length ? comsOficina[comsOficina.length - 1] : null;
  const na = getNextAction(overrides, c.id);
  return [
    `Placa ${txt(campoEfetivo(overrides, c, "placa"))} — ${campoEfetivo(overrides, c, "numsin") || "#" + c.nosnum} — ${txt(campoEfetivo(overrides, c, "segurado"))}`,
    `Etapa atual: ${etapa}`,
    ultimo ? `Último histórico com a oficina (${fmtDateBR(ultimo.date)}): ${ultimo.text}` : "Sem histórico registrado com a oficina ainda.",
    na && na.title ? `Próxima ação: ${na.title}${na.date ? ` — prazo ${fmtDateBR(na.date)}` : ""}` : "Sem próxima ação definida.",
  ].join("\n");
}

export function montarContextoLoteParaIA(claims, overrides, templates, atendTemplateCfg) {
  return claims.map((c) => contextoClaimParaIA(c, overrides, templates, atendTemplateCfg)).join("\n\n");
}

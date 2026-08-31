// Link de acompanhamento público (a pedido do usuário) — o cliente recebe
// um link com um token aleatório e vê um resumo curado do andamento do
// processo, sem precisar fazer login no Sinistro360.
//
// IMPORTANTE (segurança): este resumo é a ÚNICA coisa exposta fora do
// sistema — nunca inclui histórico interno, auditoria, valores
// financeiros, nem o texto livre da próxima ação (pode conter anotação
// interna não pensada pra o cliente ler); só a DATA da próxima ação,
// quando houver. É gravado numa coleção própria (corp_public_tracking),
// separada de tudo o mais, justamente pra poder ter uma regra de leitura
// pública no Firestore restrita só a ela — ver hooks/usePublicTrackingSync.js
// e o passo a passo de configuração no Firebase Console.
import { campoEfetivo, situacaoEfetiva, currentStage, getNextAction } from "./claims";
import { txt } from "./format";

// Token longo e imprevisível — não é sequencial nem baseado em dado do
// processo, pra não dar pra "adivinhar" o link de outro cliente.
export function gerarTokenPublico() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  let s = "";
  for (let i = 0; i < 4; i++) s += Math.random().toString(36).slice(2, 10);
  return s;
}

// Resumo seguro exposto na coleção pública — ver aviso de segurança acima.
export function montarSnapshotPublico(c, overrides, templates, atendTemplateCfg) {
  const sit = situacaoEfetiva(overrides, c, atendTemplateCfg, templates);
  const na = getNextAction(overrides, c.id);
  return {
    ativo: true,
    claimId: c.id,
    numsin: campoEfetivo(overrides, c, "numsin") || ("#" + c.nosnum),
    segurado: txt(campoEfetivo(overrides, c, "segurado")),
    placa: txt(campoEfetivo(overrides, c, "placa")),
    cia: txt(campoEfetivo(overrides, c, "cia")),
    situacaoLabel: sit.label,
    situacaoCls: sit.cls,
    etapa: currentStage(overrides, templates, atendTemplateCfg, c) || "",
    previsaoRetorno: (na && na.date) || null,
    atualizadoEm: new Date().toISOString(),
  };
}

// Compara ignorando `atualizadoEm` — evita regravar a cada render só
// porque o carimbo de hora mudou, sem nenhum conteúdo visível diferente.
export function snapshotsIguais(a, b) {
  if (!a || !b) return a === b;
  const { atualizadoEm: _a, ...restoA } = a;
  const { atualizadoEm: _b, ...restoB } = b;
  return JSON.stringify(restoA) === JSON.stringify(restoB);
}

export function urlAcompanhamento(token) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/acompanhar/${token}`;
}

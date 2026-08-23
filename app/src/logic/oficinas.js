// Módulo Oficinas (Fase 1) — funções puras de agregação, seguindo o estilo
// de src/logic/claims.js. A "oficina" não é uma entidade sincronizada da
// API: hoje ela só existe como texto livre no campo `oficina` de cada
// sinistro. O cadastro (corp_oficinas) é inteiramente manual, guardado
// numa coleção própria, então nunca é afetado por uma sincronização de
// corp_claims.
import { campoEfetivo, getUserJourney, loadComms, getPesquisaSatisfacao } from "./claims";
import { diasEntre } from "./format";

// Slug determinístico a partir do nome da oficina — vira o id do registro
// em corp_oficinas (e o doc-id no Firestore, que não aceita "/" e tem
// outras restrições de caractere).
export function oficinaIdFromNome(nome) {
  const diacriticos = new RegExp("[\\u0300-\\u036f]", "g");
  const base = String(nome || "")
    .normalize("NFD").replace(diacriticos, "") // remove acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (base || "SEM_NOME").slice(0, 120);
}

// Lista {id, nome} de todas as oficinas distintas vistas nos sinistros —
// fonte única pra listas/seletores (Oficinas.jsx, vínculo de Tarefa). Não
// depende de existir um cadastro em corp_oficinas.
export function listaOficinas(claims, overrides) {
  const seen = new Map();
  (claims || []).forEach((c) => {
    const nome = String(campoEfetivo(overrides, c, "oficina") || "").trim();
    if (nome && !seen.has(nome)) seen.set(nome, oficinaIdFromNome(nome));
  });
  return Array.from(seen.entries()).map(([nome, id]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
}

// Caminho inverso: dado um id (slug), acha o nome exibível procurando entre
// os sinistros existentes — não depende do cadastro existir.
export function oficinaNomeFromId(claims, overrides, oficinaId) {
  for (const c of claims || []) {
    const nome = String(campoEfetivo(overrides, c, "oficina") || "").trim();
    if (nome && oficinaIdFromNome(nome) === oficinaId) return nome;
  }
  return "";
}

// Sinistros cujo campo "oficina" (já considerando override manual) bate
// com o nome exato desta oficina.
export function oficinaClaims(claims, overrides, oficinaNome) {
  const nome = String(oficinaNome || "").trim();
  if (!nome) return [];
  return (claims || []).filter((c) => String(campoEfetivo(overrides, c, "oficina") || "").trim() === nome);
}

// Todos os comentários de Histórico com canal "Oficina" nos sinistros
// desta oficina — usado pra nota média e contagem de
// Aguardando retorno/Limitação de comunicação.
export function oficinaComsOficina(claims, overrides, oficinaNome) {
  const cs = oficinaClaims(claims, overrides, oficinaNome);
  const out = [];
  cs.forEach((c) => {
    loadComms(overrides, c.id).forEach((m) => { if (m.canal === "Oficina") out.push(m); });
  });
  return out;
}

// Média de avaliação (estrelas) — ignora entradas sem nota (0/ausente).
export function oficinaAvaliacaoMedia(coms) {
  const notas = (coms || []).map((m) => Number(m.avaliacao) || 0).filter((n) => n > 0);
  if (!notas.length) return null;
  return notas.reduce((a, b) => a + b, 0) / notas.length;
}

// Contagem de "Aguardando retorno" e "Limitação de comunicação" — a
// pedido do usuário, evidência pra alinhar com a oficina em reuniões.
export function oficinaAguardandoLimitacaoCounts(coms) {
  let aguardandoRetorno = 0, limitacaoComunicacao = 0;
  (coms || []).forEach((m) => {
    if (m.aguardandoRetorno) aguardandoRetorno++;
    if (m.limitacaoComunicacao) limitacaoComunicacao++;
  });
  return { aguardandoRetorno, limitacaoComunicacao };
}

// Tempo médio (em dias) entre a etapa "Reparo" da Jornada do cliente
// começar (firstSetAt) e ser concluída (concludedAt), pros sinistros
// desta oficina. "Reparo" só existe no caminho Perda Parcial — sinistros
// de Perda Integral ou sem a etapa concluída simplesmente não entram na
// média (não é um erro, é esperado).
export function oficinaTempoMedioReparo(claims, overrides, oficinaNome) {
  const cs = oficinaClaims(claims, overrides, oficinaNome);
  const dias = [];
  cs.forEach((c) => {
    const steps = (getUserJourney(overrides, c.id) || {}).steps || {};
    const reparo = steps.reparo;
    if (!reparo || !reparo.firstSetAt || !reparo.concludedAt) return;
    const d = diasEntre(String(reparo.firstSetAt).slice(0, 10), String(reparo.concludedAt).slice(0, 10));
    if (d != null && d >= 0) dias.push(d);
  });
  if (!dias.length) return null;
  return dias.reduce((a, b) => a + b, 0) / dias.length;
}

// Média das notas da Pesquisa de satisfação (Fase 4) pro alvo "oficina",
// entre os sinistros desta oficina — ignora sinistros sem pesquisa
// registrada ou marcados como "não se aplica".
export function oficinaSatisfacaoMedia(claims, overrides, oficinaNome) {
  const cs = oficinaClaims(claims, overrides, oficinaNome);
  const notas = cs
    .map((c) => (getPesquisaSatisfacao(overrides, c.id) || {}).oficina)
    .filter((a) => a && !a.naoAplica && Number(a.nota) > 0)
    .map((a) => Number(a.nota));
  if (!notas.length) return null;
  return notas.reduce((a, b) => a + b, 0) / notas.length;
}

// Pra cada seguradora (cia efetiva) associada a sinistros desta oficina,
// quantos foram atendidos como "Referenciada" vs. "Livre Escolha" (campo
// manual vinculoOficina, ver GeralPanel.jsx) — alimenta "em quais
// seguradoras ela é referenciada, com quantitativo".
export function oficinaReferenciadaLivreEscolhaPorSeguradora(claims, overrides, oficinaNome) {
  const cs = oficinaClaims(claims, overrides, oficinaNome);
  const map = {};
  cs.forEach((c) => {
    const cia = String(campoEfetivo(overrides, c, "cia") || "").trim() || "—";
    const vinculo = campoEfetivo(overrides, c, "vinculoOficina") || "";
    if (!map[cia]) map[cia] = { referenciada: 0, livreEscolha: 0, semVinculo: 0 };
    if (vinculo === "Referenciada") map[cia].referenciada++;
    else if (vinculo === "Livre Escolha") map[cia].livreEscolha++;
    else map[cia].semVinculo++;
  });
  return map;
}

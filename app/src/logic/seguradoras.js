// Módulo Seguradoras (Fase 2) — mesma lógica do módulo Oficinas
// (src/logic/oficinas.js), adaptada: usa o campo "cia" em vez de "oficina".
// Duas diferenças reais em relação a oficinas: não existe "tempo médio de
// reparo" (métrica de oficina, não de seguradora) e o cruzamento
// Referenciada/Livre Escolha é visto do lado inverso — por OFICINA, não
// por seguradora (já que aqui a entidade central é a própria seguradora).
import { campoEfetivo, loadComms } from "./claims";

export function seguradoraIdFromNome(nome) {
  const diacriticos = new RegExp("[\\u0300-\\u036f]", "g");
  const base = String(nome || "")
    .normalize("NFD").replace(diacriticos, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (base || "SEM_NOME").slice(0, 120);
}

export function listaSeguradoras(claims, overrides) {
  const seen = new Map();
  (claims || []).forEach((c) => {
    const nome = String(campoEfetivo(overrides, c, "cia") || "").trim();
    if (nome && !seen.has(nome)) seen.set(nome, seguradoraIdFromNome(nome));
  });
  return Array.from(seen.entries()).map(([nome, id]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
}

export function seguradoraNomeFromId(claims, overrides, seguradoraId) {
  for (const c of claims || []) {
    const nome = String(campoEfetivo(overrides, c, "cia") || "").trim();
    if (nome && seguradoraIdFromNome(nome) === seguradoraId) return nome;
  }
  return "";
}

export function seguradoraClaims(claims, overrides, seguradoraNome) {
  const nome = String(seguradoraNome || "").trim();
  if (!nome) return [];
  return (claims || []).filter((c) => String(campoEfetivo(overrides, c, "cia") || "").trim() === nome);
}

export function seguradoraComsSeguradora(claims, overrides, seguradoraNome) {
  const cs = seguradoraClaims(claims, overrides, seguradoraNome);
  const out = [];
  cs.forEach((c) => {
    loadComms(overrides, c.id).forEach((m) => { if (m.canal === "Seguradora") out.push(m); });
  });
  return out;
}

export function seguradoraAvaliacaoMedia(coms) {
  const notas = (coms || []).map((m) => Number(m.avaliacao) || 0).filter((n) => n > 0);
  if (!notas.length) return null;
  return notas.reduce((a, b) => a + b, 0) / notas.length;
}

export function seguradoraAguardandoLimitacaoCounts(coms) {
  let aguardandoRetorno = 0, limitacaoComunicacao = 0;
  (coms || []).forEach((m) => {
    if (m.aguardandoRetorno) aguardandoRetorno++;
    if (m.limitacaoComunicacao) limitacaoComunicacao++;
  });
  return { aguardandoRetorno, limitacaoComunicacao };
}

// Pra cada oficina associada a sinistros desta seguradora, quantos foram
// atendidos como "Referenciada" vs. "Livre Escolha" — visão inversa da
// mesma tabela mostrada em Oficinas (lá agrupada por seguradora, aqui por
// oficina).
export function seguradoraReferenciadaLivreEscolhaPorOficina(claims, overrides, seguradoraNome) {
  const cs = seguradoraClaims(claims, overrides, seguradoraNome);
  const map = {};
  cs.forEach((c) => {
    const oficina = String(campoEfetivo(overrides, c, "oficina") || "").trim() || "—";
    const vinculo = campoEfetivo(overrides, c, "vinculoOficina") || "";
    if (!map[oficina]) map[oficina] = { referenciada: 0, livreEscolha: 0, semVinculo: 0 };
    if (vinculo === "Referenciada") map[oficina].referenciada++;
    else if (vinculo === "Livre Escolha") map[oficina].livreEscolha++;
    else map[oficina].semVinculo++;
  });
  return map;
}

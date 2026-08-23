// Módulo Clientes (Fase 3) — mesma lógica dos módulos Oficinas/
// Seguradoras (src/logic/oficinas.js, src/logic/seguradoras.js), adaptada:
// usa o campo "segurado" (nome do cliente) em vez de "oficina"/"cia". Sem
// Referenciada/Livre Escolha (não se aplica a cliente); em troca, resume
// Agente/Produtor vinculados às apólices do cliente (já sincronizados por
// sinistro via /documento do CORP — ver useDocumentoCorp.js).
import { campoEfetivo, loadComms, getAgenteProdutor } from "./claims";

export function clienteIdFromNome(nome) {
  const diacriticos = new RegExp("[\\u0300-\\u036f]", "g");
  const base = String(nome || "")
    .normalize("NFD").replace(diacriticos, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (base || "SEM_NOME").slice(0, 120);
}

export function listaClientes(claims, overrides) {
  const seen = new Map();
  (claims || []).forEach((c) => {
    const nome = String(campoEfetivo(overrides, c, "segurado") || "").trim();
    if (nome && !seen.has(nome)) seen.set(nome, clienteIdFromNome(nome));
  });
  return Array.from(seen.entries()).map(([nome, id]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
}

export function clienteNomeFromId(claims, overrides, clienteId) {
  for (const c of claims || []) {
    const nome = String(campoEfetivo(overrides, c, "segurado") || "").trim();
    if (nome && clienteIdFromNome(nome) === clienteId) return nome;
  }
  return "";
}

export function clienteClaims(claims, overrides, clienteNome) {
  const nome = String(clienteNome || "").trim();
  if (!nome) return [];
  return (claims || []).filter((c) => String(campoEfetivo(overrides, c, "segurado") || "").trim() === nome);
}

export function clienteComsCliente(claims, overrides, clienteNome) {
  const cs = clienteClaims(claims, overrides, clienteNome);
  const out = [];
  cs.forEach((c) => {
    loadComms(overrides, c.id).forEach((m) => { if (m.canal === "Cliente") out.push(m); });
  });
  return out;
}

export function clienteAvaliacaoMedia(coms) {
  const notas = (coms || []).map((m) => Number(m.avaliacao) || 0).filter((n) => n > 0);
  if (!notas.length) return null;
  return notas.reduce((a, b) => a + b, 0) / notas.length;
}

// Agentes/Produtores distintos já vistos nos sinistros deste cliente (dado
// sincronizado via /documento do CORP, guardado em
// overrides[claimId].agenteProdutor — ver useDocumentoCorp.js/GeralPanel.jsx).
// Não busca nada nova aqui; só resume o que cada sinistro já carregou.
export function clienteAgentesProdutores(claims, overrides, clienteNome) {
  const cs = clienteClaims(claims, overrides, clienteNome);
  const agentes = new Set(), produtores = new Set();
  cs.forEach((c) => {
    const ap = getAgenteProdutor(overrides, c.id);
    (ap && ap.agentes || []).forEach((a) => a && agentes.add(a));
    (ap && ap.produtores || []).forEach((p) => p && produtores.add(p));
  });
  return { agentes: Array.from(agentes).sort(), produtores: Array.from(produtores).sort() };
}

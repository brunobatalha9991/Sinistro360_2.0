import { campoEfetivo, getResponsavel, getNextAction, loadComms, tipoPartyLabel } from "./claims";

// Relatório "Acompanhamento" (a pedido do usuário): uma linha por processo
// com Tipo, Responsável, Cliente, último histórico e próxima ação — exportado
// em Excel e PDF a partir da página Relatórios.

export const COLUNAS_ACOMPANHAMENTO = [
  { key: "tipo", label: "Tipo", width: 13 },
  { key: "responsavel", label: "Responsável", width: 22 },
  { key: "cliente", label: "Nome do cliente", width: 32 },
  { key: "ultHistData", label: "Data último histórico", width: 14, type: "date" },
  { key: "ultHistTexto", label: "Conteúdo do último histórico", width: 70, type: "wrap" },
  { key: "proxData", label: "Data próx. ação", width: 14, type: "date" },
  { key: "proxTitulo", label: "Título da próxima ação", width: 36, type: "wrap" },
];

function chaveComm(m) {
  return (m.date || (m.at ? String(m.at).slice(0, 10) : "")) + "|" + (m.at || "");
}

// O último histórico é o de data mais recente (com `at` de desempate), não o
// último do array — históricos importados via planilha ou editados podem
// estar fora de ordem. Um registro do Histórico salvo de uma vez com várias
// caixas preenchidas (Cliente + Oficina + ...) vira várias comunicações com
// o mesmo `at`; todas entram juntas no conteúdo, uma por linha.
export function ultimoHistorico(comms) {
  const lista = (comms || []).filter((m) => m && (m.text || m.texto || m.date || m.at));
  if (!lista.length) return null;
  let maior = "";
  lista.forEach((m) => { const k = chaveComm(m); if (k > maior) maior = k; });
  const grupo = lista.filter((m) => chaveComm(m) === maior);
  const data = grupo[0].date || (grupo[0].at ? String(grupo[0].at).slice(0, 10) : "");
  const titulo = grupo[0].titulo || "";
  const corpo = grupo
    .map((m) => ((m.canal ? `[${m.canal}] ` : "") + String(m.text || m.texto || "").trim()).trim())
    .filter(Boolean)
    .join("\n");
  const texto = titulo && corpo ? titulo + (grupo.length > 1 ? "\n" : ": ") + corpo : titulo || corpo;
  return { data, texto };
}

export function linhaAcompanhamento(overrides, c) {
  const resp = getResponsavel(overrides, c.id);
  const ult = ultimoHistorico(loadComms(overrides, c.id));
  const na = getNextAction(overrides, c.id);
  return {
    id: c.id,
    tipo: tipoPartyLabel(c.partyType === "Aviso" || c.partyType === "Terceiro" ? c.partyType : "Segurado"),
    responsavel: (resp && resp.nome) || "",
    cliente: campoEfetivo(overrides, c, "segurado") || "",
    ultHistData: (ult && ult.data) || "",
    ultHistTexto: (ult && ult.texto) || "",
    proxData: (na && na.date) || "",
    proxTitulo: (na && na.title) || "",
  };
}

// Ordem: Responsável (sem responsável por último), depois data da próxima
// ação (mais urgente primeiro; sem data por último), depois cliente.
export function ordenarLinhas(linhas) {
  const vaz = (s) => (s ? 0 : 1);
  return [...linhas].sort((a, b) =>
    vaz(a.responsavel) - vaz(b.responsavel)
    || a.responsavel.localeCompare(b.responsavel, "pt-BR")
    || vaz(a.proxData) - vaz(b.proxData)
    || a.proxData.localeCompare(b.proxData)
    || a.cliente.localeCompare(b.cliente, "pt-BR"));
}

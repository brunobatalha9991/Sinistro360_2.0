import { PartyBadge } from "../components/PartyBadge.jsx";
import { campoEfetivo, situacaoEfetiva, getSitAtend, getNextAction, isManualClaim, relatedClaims } from "./claims";
import { txt, val, fmtDateBR } from "./format";

// Porte 1:1 de ALL_COLS do HTML original — cada coluna possível da tabela de
// Sinistros, com sua célula. Recebe overrides/allClaimsRaw/navigate porque as
// células dependem de dados derivados e de navegação para o detalhe.
export function getAllCols({ overrides, allClaimsRaw, navigate }) {
  return [
    { key: "tipo", label: "Tipo", cell: (c) => <PartyBadge pt={c.partyType} /> },
    {
      key: "origem", label: "Origem",
      cell: (c) => isManualClaim(c)
        ? <span className="badge purple" title={"Criado por " + (c.criadoPor || "—")}>✎ Manual</span>
        : <span className="badge gray">API CORP</span>,
    },
    {
      key: "numsin", label: "Nº Sinistro",
      cell: (c) => <a className="mono" onClick={() => navigate("sinistro", c.id)}>{campoEfetivo(overrides, c, "numsin") || "#" + c.nosnum}</a>,
    },
    { key: "segurado", label: "Nome", cell: (c) => txt(campoEfetivo(overrides, c, "segurado")) },
    { key: "placa", label: "Placa", cell: (c) => <span className="mono">{txt(campoEfetivo(overrides, c, "placa"))}</span> },
    { key: "cia", label: "Seguradora", cell: (c) => txt(campoEfetivo(overrides, c, "cia")) },
    { key: "ramo", label: "Ramo", cell: (c) => txt(campoEfetivo(overrides, c, "ramo")) },
    {
      key: "situacao", label: "Situação",
      cell: (c) => { const s = situacaoEfetiva(overrides, c); return <span className={"badge " + s.cls}>{s.label}</span>; },
    },
    {
      key: "sitatend", label: "Situação atend.",
      cell: (c) => { const v = getSitAtend(overrides, c.id); return v ? <span className="badge blue">{v}</span> : <span className="muted">—</span>; },
    },
    { key: "numapo", label: "Apólice", cell: (c) => <span className="mono">{val(campoEfetivo(overrides, c, "numapo"))}</span> },
    { key: "oficina", label: "Oficina", cell: (c) => txt(campoEfetivo(overrides, c, "oficina")) },
    { key: "datoco", label: "Dt. Ocorrência", cell: (c) => fmtDateBR(c.datoco) },
    { key: "datavi", label: "Dt. Aviso", cell: (c) => fmtDateBR(c.datavi) },
    { key: "datenc", label: "Encerramento", cell: (c) => fmtDateBR(c.datenc) },
    {
      key: "proxacao", label: "Próxima ação",
      cell: (c) => { const na = getNextAction(overrides, c.id); return na && na.date ? fmtDateBR(na.date) : "—"; },
    },
    {
      key: "vinculos", label: "Vínculos",
      cell: (c) => { const rel = relatedClaims(overrides, allClaimsRaw, c); return rel.length ? <span className="badge purple">{rel.length} vinculado(s)</span> : <span className="muted">—</span>; },
    },
    { key: "acoes", label: "Ações", cell: (c) => <button className="btn sec sm" onClick={() => navigate("sinistro", c.id)}>Abrir</button> },
  ];
}

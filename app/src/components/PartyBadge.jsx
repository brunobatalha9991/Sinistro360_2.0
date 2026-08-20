// Porte 1:1 de partyBadge() do HTML original.
export function PartyBadge({ pt }) {
  if (pt === "Terceiro") return <span className="badge red">Terceiro</span>;
  if (pt === "Aviso") return <span className="badge amber">Atendimento</span>;
  return <span className="badge green">Segurado</span>;
}

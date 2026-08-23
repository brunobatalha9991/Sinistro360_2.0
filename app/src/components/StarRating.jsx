// Avaliação de 5 estrelas — extraído de CommsPanel.jsx (onde nasceu, pra
// Oficina/Seguradora) pra ser reaproveitado também pela Pesquisa de
// satisfação. Clicar na mesma nota já marcada zera (permite "desmarcar").
function Star({ filled, onClick, readOnly }) {
  return (
    <svg
      onClick={readOnly ? undefined : onClick} viewBox="0 0 24 24" width={16} height={16}
      fill={filled ? "var(--warn)" : "none"} stroke="var(--warn)" strokeWidth="1.5"
      style={{ cursor: readOnly ? "default" : "pointer" }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
export function StarRating({ value, onChange, readOnly }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= value} onClick={() => onChange(value === n ? 0 : n)} readOnly={readOnly} />
      ))}
    </div>
  );
}

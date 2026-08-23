import { useState } from "react";
import { txt } from "../logic/format";

// Busca de processo por nome/nº sinistro/placa — extraído de TaskModal.jsx
// (era só de lá) pra ser reaproveitado também no vínculo manual de e-mail
// (Emails.jsx). `value.label` é o texto já exibido (ex.: editando algo já
// vinculado); `onChange(claimId)` recebe "" quando o usuário escolhe
// "Nenhum".
export function ProcSearch({ value, onChange, claims }) {
  const [q, setQ] = useState(value.label || "");
  const [open, setOpen] = useState(false);
  const results = q.trim().length >= 2
    ? claims.filter((c) => [c.segurado, c.numsin, c.placa, c.nosnum].join(" ").toLowerCase().indexOf(q.toLowerCase().trim()) >= 0).slice(0, 25)
    : [];

  function pick(c) {
    onChange(c ? c.id : "");
    setQ(c ? (c.numsin || "#" + c.nosnum) + " — " + txt(c.segurado) + (c.placa ? ` (${c.placa})` : "") : "");
    setOpen(false);
  }

  return (
    <div>
      <input
        placeholder="Buscar por nome, nº sinistro ou placa..." value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginTop: 4, maxHeight: 200, overflow: "auto", background: "var(--card)" }}>
          <div style={{ padding: "8px 10px", cursor: "pointer", color: "var(--muted)", borderBottom: "1px solid var(--border-soft)" }} onMouseDown={(e) => { e.preventDefault(); pick(null); }}>
            — Nenhum (sem vínculo) —
          </div>
          {q.trim().length >= 2 && !results.length && <div style={{ padding: "8px 10px", color: "var(--muted)" }}>Nenhum processo encontrado.</div>}
          {results.map((c) => (
            <div key={c.id} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid var(--border-soft)" }} onMouseDown={(e) => { e.preventDefault(); pick(c); }}>
              <span className="mono" style={{ fontWeight: 600 }}>{c.numsin || "#" + c.nosnum}</span>
              <span> — {txt(c.segurado)}{c.placa ? ` • ${c.placa}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

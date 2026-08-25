import { useState } from "react";
import { driveImagemEmbutivel } from "../logic/driveUpload";

// Avatar de usuário (foto ou iniciais) — componente único, a pedido do
// usuário: "quando mudar uma [foto] muda a outra" — como todo mundo lê o
// mesmo campo (corp_users[].fotoUrl) e renderiza com o mesmo componente,
// Desempenho, Configurações → Usuários e a barra superior (perto do "Sair")
// ficam automaticamente sincronizados entre si, sem precisar de nenhuma
// lógica extra de sincronização.
export function Avatar({ url, nome, size = 36 }) {
  const [broken, setBroken] = useState(false);
  const iniciais = String(nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase() || "?";
  if (!url || broken) {
    return (
      <div style={{
        width: size, height: size, minWidth: size, borderRadius: "50%", flexShrink: 0,
        background: "var(--chip-bg, #1e293b)", color: "var(--text)", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.38), fontWeight: 700,
      }}>{iniciais}</div>
    );
  }
  return (
    <img src={driveImagemEmbutivel(url)} alt={nome} onError={() => setBroken(true)}
      style={{ width: size, height: size, minWidth: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
  );
}

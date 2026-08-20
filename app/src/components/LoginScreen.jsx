import { useRef, useState } from "react";
import { Icon } from "./icons.jsx";

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const senhaRef = useRef(null);

  async function tentar() {
    const e = email.trim();
    if (!e || !senha) { setError("Informe e-mail e senha."); return; }
    setLoading(true);
    const res = await onLogin(e, senha);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setError("");
  }

  return (
    <div
      style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, backgroundImage: "var(--body-bg-image)", backgroundColor: "var(--bg)",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 400, background: "var(--card)", backdropFilter: "var(--card-blur)",
          border: "1px solid var(--border)", borderRadius: "var(--r-xl)", padding: "34px 30px",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 6 }}>
          <Icon name="pulse" />
          <h1 style={{ margin: 0, fontSize: 24 }}>Sinistro360</h1>
        </div>
        <p className="muted" style={{ textAlign: "center", margin: "0 0 24px" }}>
          Acesse com seu e-mail e senha
        </p>
        <div className="field">
          <label>E-mail</label>
          <input
            type="text" placeholder="seu@email.com" autoFocus value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") senhaRef.current?.focus(); }}
          />
        </div>
        <div className="field">
          <label>Senha</label>
          <input
            ref={senhaRef} type="password" placeholder="••••••" value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") tentar(); }}
          />
        </div>
        {error && <div className="status err">{error}</div>}
        <button className="btn" style={{ width: "100%", marginTop: 8, padding: 11 }} onClick={tentar} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}

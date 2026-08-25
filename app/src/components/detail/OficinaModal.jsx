import { useState } from "react";
import { createPortal } from "react-dom";
import { useOficinaActions } from "../../hooks/useOficinaActions";
import { oficinaIdFromNome } from "../../logic/oficinas";
import { campoEfetivo } from "../../logic/claims";
import { CadastroPanel } from "../oficina/CadastroPanel.jsx";

// Abre direto do campo "Oficina" (GeralPanel.jsx) o mesmo cadastro do
// módulo Oficinas (CNPJ, endereço, contatos, seguradoras referenciadas) —
// a pedido do usuário, pra não precisar sair do processo só pra completar
// o cadastro da oficina que acabou de vincular/trocar. Primeiro escolhe/
// cria o nome da oficina deste processo, depois (com nome definido) mostra
// o cadastro, lido/gravado na mesma coleção corp_oficinas do módulo.
export function OficinaModal({ c, overrides, ofOpts, actions, canEdit, navigate, onClose }) {
  const oficinaActions = useOficinaActions();
  const [nome, setNome] = useState(() => String(campoEfetivo(overrides, c, "oficina") || ""));

  const oficinaId = nome.trim() ? oficinaIdFromNome(nome) : "";
  const cadastro = oficinaId ? (oficinaActions.oficinas[oficinaId] || {}) : null;

  function commitNome(v) {
    setNome(v);
    actions.setOverrideCampo(c.id, "oficina", v);
  }
  function onSelectChange(e) {
    if (e.target.value === "__nova__") {
      const nv = window.prompt("Nome da nova oficina:");
      if (nv && nv.trim()) commitNome(nv.trim());
      return;
    }
    commitNome(e.target.value);
  }
  function abrirOficinaCompleta() {
    onClose();
    navigate("oficina", oficinaId);
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <div style={{ width: 640, maxWidth: "100%", background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Oficina do processo</h3>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Escolha ou crie a oficina deste processo e complete o cadastro — os dados são os mesmos do módulo Oficinas, disponíveis lá pra todos os processos vinculados a ela.
        </p>

        <div className="field" style={{ marginTop: 10 }}>
          <label>Oficina deste processo</label>
          {canEdit ? (
            <select className="inline" style={{ minWidth: 220 }} value={nome} onChange={onSelectChange}>
              <option value="">— Nenhuma —</option>
              {[...new Set([...(nome ? [nome] : []), ...ofOpts])].map((n) => <option key={n} value={n}>{n}</option>)}
              <option value="__nova__">+ Nova oficina...</option>
            </select>
          ) : (
            <div style={{ padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)" }}>{nome || "—"}</div>
          )}
        </div>

        {oficinaId && cadastro && (
          <div style={{ marginTop: 14 }}>
            <CadastroPanel oficinaId={oficinaId} cadastro={cadastro} actions={oficinaActions} canEdit={canEdit} />
            {canEdit && (
              <button type="button" className="btn sec sm" style={{ marginTop: 12 }} onClick={abrirOficinaCompleta}>
                Abrir oficina completa (Métricas, Ocorrências, Comunicação...)
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

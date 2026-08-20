import { KvList } from "../KvList.jsx";
import { EditableCell } from "../EditableCell.jsx";
import { distinctComputed, campoEfetivo } from "../../logic/claims";

// Porte 1:1 de atendimentoInfoPanel() do HTML original.
export function AtendimentoPanel({ c, claims, overrides, actions, canEdit }) {
  const ofOpts = distinctComputed(claims, (x) => campoEfetivo(overrides, x, "oficina"));
  function cell(campo, opts) {
    return (
      <EditableCell
        c={c} campo={campo} overrides={overrides} canEdit={canEdit}
        onCommit={(v) => actions.setOverrideCampo(c.id, campo, v)}
        {...(opts || {})}
      />
    );
  }
  const rows = [
    ["Oficina/Prestador", cell("oficina", { type: "select", options: ofOpts, emptyLabel: "Nenhuma", novoLabel: "+ Nova oficina...", promptMsg: "Nome da nova oficina:" })],
    ["Tipo de atendimento", cell("tipo_atendimento")],
  ];
  return (
    <div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Atendimento</h3>
          <span className="tag-manual">Clique para editar • preservado na sincronização</span>
        </div>
        <KvList rows={rows} />
      </div>
      <div className="card"><h3 style={{ marginTop: 0 }}>Descrição</h3>{cell("descricao")}</div>
      <div className="card"><h3 style={{ marginTop: 0 }}>Observações</h3>{cell("observacoes")}</div>
    </div>
  );
}

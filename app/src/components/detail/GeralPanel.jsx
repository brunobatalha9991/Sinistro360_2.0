import { KvList } from "../KvList.jsx";
import { EditableCell } from "../EditableCell.jsx";
import { distinctComputed, campoEfetivo, situacaoEfetiva } from "../../logic/claims";
import { txt } from "../../logic/format";

// Porte 1:1 de geralPanel() do HTML original.
export function GeralPanel({ c, claims, overrides, actions, canEdit }) {
  const segOpts = distinctComputed(claims, (x) => campoEfetivo(overrides, x, "cia"));
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
    ["Tipo de parte", <span>{c.partyType}</span>],
    ["Nº do sinistro", cell("numsin")],
    ["Tipo (API)", <span>{txt(c.tipo)}</span>],
    ["Nome", cell("segurado")],
    ["Placa", cell("placa")],
    ["Seguradora", cell("cia", { type: "select", options: segOpts, emptyLabel: "Nenhuma", novoLabel: "+ Nova seguradora...", promptMsg: "Nome da nova seguradora:" })],
    ["Ramo", cell("ramo")],
    ["Apólice", cell("numapo")],
    ["Endosso", cell("numend")],
    ["Item", cell("item")],
    ["Filial", cell("codfil")],
    ["Nº controle", <span>{txt(c.nosnum)}</span>],
    ["Código", cell("codigo")],
    ["Situação", <span>{situacaoEfetiva(overrides, c).label}</span>],
    ["Oficina", cell("oficina", { type: "select", options: ofOpts, emptyLabel: "Nenhuma", novoLabel: "+ Nova oficina...", promptMsg: "Nome da nova oficina:" })],
    ["Dt. Ocorrência", cell("datoco", { type: "date" })],
    ["Dt. Aviso", cell("datavi", { type: "date" })],
    ["Encerramento", cell("datenc", { type: "date" })],
    ["Observações", cell("observacoes")],
  ];
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Informações gerais</h3>
        <span className="tag-manual">Clique num campo para editar • edições preservadas na sincronização</span>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        O valor que você digitar prevalece sobre o dado da API e não se perde ao sincronizar. Nº controle e Tipo (API) não são editáveis. O dado bruto original continua visível na aba "Dados brutos (API)".
      </p>
      <KvList rows={rows} />
    </div>
  );
}

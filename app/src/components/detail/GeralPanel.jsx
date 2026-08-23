import { KvList } from "../KvList.jsx";
import { EditableCell } from "../EditableCell.jsx";
import { distinctComputed, campoEfetivo, situacaoEfetiva, isManualClaim } from "../../logic/claims";
import { txt } from "../../logic/format";
import { extractProdDocs } from "../../logic/corpApi";
import { useDocumentoCorp } from "../../hooks/useDocumentoCorp";

// Agente/Produtor vêm de um endpoint separado do CORP (/documento, não faz
// parte da sincronização normal de sinistros) — busca sob demanda ao abrir
// a aba, usando o "nosnum" do processo (chave universal no CORP) + codfil.
// Processos criados manualmente (sem nosnum real da API) não têm o que
// buscar aqui.
function AgenteProdutorBox({ c, config }) {
  const { resp, carregando, erro } = useDocumentoCorp(c, config);
  const prodDocs = extractProdDocs(resp);

  if (isManualClaim(c)) return null;

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <label style={{ margin: 0 }}>Agente / Produtor</label>
        {carregando && <span className="muted" style={{ fontSize: 12 }}>Buscando...</span>}
      </div>
      {erro && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{erro}</div>}
      {!carregando && !erro && !prodDocs.length && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nenhum agente/produtor encontrado para este processo.</div>
      )}
      {prodDocs.map((p, idx) => (
        <div key={idx} style={{ fontSize: 13, marginTop: 6 }}>
          <b>{txt(p.produtor)}</b> <span className="muted">— agente: {txt(p.agente)}</span>
        </div>
      ))}
    </div>
  );
}

// Porte 1:1 de geralPanel() do HTML original.
export function GeralPanel({ c, claims, overrides, actions, canEdit, config }) {
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
      <AgenteProdutorBox c={c} config={config} />
    </div>
  );
}
